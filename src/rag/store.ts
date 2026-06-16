import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const COLLECTION_NAME = "company_docs";
const STATE_FILE = ".qdrant-state.json";

interface FileState {
  [source: string]: number;
}

// -------- Embeddings --------

class ZhipuEmbeddings extends Embeddings {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    super();
    this.apiKey = process.env.ZHIPU_API_KEY || "";
    this.baseURL = "https://open.bigmodel.cn/api/paas/v4";
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) throw new Error("缺少 ZHIPU_API_KEY");
    const res = await fetch(`${this.baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: "embedding-2", input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`嵌入失败: ${JSON.stringify(json)}`);
    return json.data.map((item: any) => item.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedDocuments([text]);
    return embeddings[0];
  }
}

let globalEmbeddings: ZhipuEmbeddings | null = null;

function getEmbeddings(): ZhipuEmbeddings {
  if (!globalEmbeddings) {
    globalEmbeddings = new ZhipuEmbeddings();
  }
  return globalEmbeddings;
}

// -------- Qdrant 低层 API --------

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: { text: string; source?: string; type?: string; [key: string]: any };
}

async function qdrantRequest(path: string, method: string = "GET", body?: any) {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Qdrant ${method} ${path} 失败: ${JSON.stringify(json)}`);
  }
  return json;
}

async function collectionExists(): Promise<boolean> {
  try {
    const res = await qdrantRequest(`/collections/${COLLECTION_NAME}`);
    return res.result && (res.result.status === "green" || res.result.status === "yellow");
  } catch {
    return false;
  }
}

async function createCollection(vectorSize: number) {
  await qdrantRequest(`/collections/${COLLECTION_NAME}`, "PUT", {
    vectors: { size: vectorSize, distance: "Cosine" },
  });
  console.log(`✅ Qdrant 集合 ${COLLECTION_NAME} 创建成功 (维度: ${vectorSize})`);
}

async function getPointCount(): Promise<number> {
  try {
    const res = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/count`,
      "POST",
      {},
    );
    return res.result?.count || 0;
  } catch {
    return 0;
  }
}

async function upsertPoints(points: QdrantPoint[]) {
  await qdrantRequest(`/collections/${COLLECTION_NAME}/points`, "PUT", { points });
}

/**
 * 直接从 Qdrant 进行向量检索
 * 功能 4：去掉 MemoryVectorStore 中间层，检索直接走 Qdrant
 */
async function searchVector(queryVector: number[], topK: number = 5): Promise<Document[]> {
  const res = await qdrantRequest(
    `/collections/${COLLECTION_NAME}/points/search`,
    "POST",
    {
      vector: queryVector,
      limit: topK,
      with_payload: true,
    },
  );

  return (res.result || []).map((hit: any) => new Document({
    pageContent: hit.payload?.text || "",
    metadata: { ...hit.payload, score: hit.score },
  }));
}

/**
 * 获取 Qdrant 中全部 points（用于删除文档、调试、混合检索）
 */
async function getAllPoints(): Promise<QdrantPoint[]> {
  const res = await qdrantRequest(
    `/collections/${COLLECTION_NAME}/points/scroll`,
    "POST",
    {
      limit: 10000,
      with_payload: true,
      with_vector: false,
    },
  );
  return res.result?.points || [];
}

/**
 * 功能 2：按 source（文件名）删除对应的 points
 * 删除 data/ 中的文件后，调用此函数同步清理 Qdrant
 */
async function deletePointsBySource(source: string): Promise<number> {
  const res = await qdrantRequest(
    `/collections/${COLLECTION_NAME}/points/delete`,
    "POST",
    {
      filter: {
        must: [{ key: "source", match: { value: source } }],
      },
    },
  );
  const deleted = res.result?.operation_id ? "成功" : "执行";
  console.log(`🗑  删除文档 [${source}] 对应的向量 (${deleted})`);

  const after = await getPointCount();
  return after;
}

// -------- 功能 3：混合检索 (向量 + 关键词 BM25 风格) --------

/**
 * 简易关键词打分（BM25 风格的本地化实现，无需额外依赖）
 * - 将问题拆成 token（中文按字，英文按空格）
 * - 每个文档块中，匹配到的 token 数量越多分越高
 * - 与向量相似度做加权融合
 */
function keywordScore(query: string, docText: string): number {
  const q = query.toLowerCase();
  const t = docText.toLowerCase();

  const tokens = new Set<string>();
  q.split(/[\s,，。.、!?？!]+/).filter(Boolean).forEach((tok) => tokens.add(tok));
  for (const c of q) {
    if (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(c)) tokens.add(c);
  }

  let hitCount = 0;
  tokens.forEach((tok) => {
    if (tok.length >= 2 && t.includes(tok)) hitCount += 2;
    else if (t.includes(tok)) hitCount += 1;
  });

  const uniqueLen = Math.max(tokens.size, 1);
  return hitCount / uniqueLen;
}

/**
 * 混合检索：向量相似度（主要） + 关键词匹配（增强）
 * 解决场景：
 * - 纯向量检索对精确术语（如 "年假"、"年终奖"）可能被长文本稀释
 * - 关键词补充后，精准命中时排名更靠前
 */
async function hybridSearch(
  query: string,
  topK: number = 5,
  vectorWeight: number = 0.7,
  keywordWeight: number = 0.3,
): Promise<Document[]> {
  const embeddings = getEmbeddings();
  const qv = await embeddings.embedQuery(query);

  const vectorDocs = await searchVector(qv, Math.max(topK * 3, 15));

  if (vectorDocs.length === 0) return [];

  const allDocs = vectorDocs;

  // 计算混合分数
  const scored = allDocs.map((doc) => {
    const vs = (doc.metadata.score as number) || 0;
    const ks = keywordScore(query, doc.pageContent);
    const combined = vs * vectorWeight + ks * keywordWeight;
    return { doc, combined, vs, ks };
  });

  scored.sort((a, b) => b.combined - a.combined);

  return scored.slice(0, topK).map((s) => new Document({
    pageContent: s.doc.pageContent,
    metadata: {
      ...s.doc.metadata,
      combinedScore: s.combined,
      vectorScore: s.vs,
      keywordScore: s.ks,
    },
  }));
}

// -------- 文件状态管理（用于功能 1 增量更新） --------

function loadFileState(): FileState {
  try {
    const fs = require("fs") as typeof import("fs");
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // 忽略
  }
  return {};
}

function saveFileState(state: FileState) {
  try {
    const fs = require("fs") as typeof import("fs");
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.warn("⚠️  状态文件保存失败:", e);
  }
}

// -------- 对外高阶 API --------

/**
 * 功能 1：增量更新
 * - 读取之前记录的文件 mtime
 * - 对比当前 data/ 目录下文件的 mtime
 * - 只重新向量化「新增」和「修改时间变化」的文档
 * - 删除目录里已不存在但 Qdrant 中仍有的文档
 *
 * 返回：{ added: 新增块数, deleted: 删除的 sources, unchanged: 未变化的 sources }
 */
export interface IncrementalResult {
  addedCount: number;
  deletedSources: string[];
  unchangedSources: string[];
  newSources: string[];
}

export async function syncDocumentsToQdrant(
  currentDocsWithSplits: { source: string; mtime: number; splits: Document[] }[],
): Promise<IncrementalResult> {
  const fs = require("fs") as typeof import("fs");
  const state = loadFileState();
  const currentSources = new Set(currentDocsWithSplits.map((d) => d.source));

  // --- (a) 找出新增 / 修改 ---
  const toUpsert: Document[] = [];
  const newSources: string[] = [];
  const unchangedSources: string[] = [];

  for (const item of currentDocsWithSplits) {
    const prevTime = state[item.source];
    const isNew = prevTime === undefined;
    const isModified = !isNew && Math.abs(prevTime - item.mtime) > 1000;

    if (isNew || isModified) {
      if (isModified) {
        await deletePointsBySource(item.source); // 先删旧的
      }
      toUpsert.push(...item.splits);
      newSources.push(item.source);
    } else {
      unchangedSources.push(item.source);
    }
  }

  // --- (b) 找出删除 ---
  const deletedSources: string[] = [];
  for (const prevSource of Object.keys(state)) {
    if (!currentSources.has(prevSource)) {
      await deletePointsBySource(prevSource);
      deletedSources.push(prevSource);
    }
  }

  // --- (c) 写入 Qdrant ---
  if (toUpsert.length > 0) {
    await addDocumentsToStore(toUpsert);
  } else {
    console.log("ℹ️  没有新增 / 修改的文档，跳过向量化");
  }

  // --- (d) 更新状态文件 ---
  const nextState: FileState = {};
  for (const item of currentDocsWithSplits) {
    nextState[item.source] = item.mtime;
  }
  saveFileState(nextState);

  return {
    addedCount: toUpsert.length,
    deletedSources,
    unchangedSources,
    newSources,
  };
}

/**
 * 向量化 + 写入 Qdrant（通用）
 */
export async function addDocumentsToStore(docs: Document[]) {
  if (docs.length === 0) {
    console.log("⚠️  没有可写入的文档");
    return;
  }
  console.log(`正在向量化 ${docs.length} 个文档块并存入 Qdrant...`);

  const embeddings = getEmbeddings();

  // 分批：避免一次调用太多文本
  const batchSize = 20;
  let vectorSize: number | null = null;
  let allPoints: QdrantPoint[] = [];
  let idBase = Date.now();

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const vectors = await embeddings.embedDocuments(batch.map((d) => d.pageContent));
    if (vectorSize === null) vectorSize = vectors[0].length;

    const points: QdrantPoint[] = batch.map((doc, idx) => ({
      id: idBase + i + idx,
      vector: vectors[idx],
      payload: {
        text: doc.pageContent,
        source: doc.metadata?.source,
        type: doc.metadata?.type,
        ...doc.metadata,
      },
    }));
    allPoints = allPoints.concat(points);

    console.log(`  → 已处理 ${i + batch.length}/${docs.length} 块`);
  }

  if (vectorSize !== null) {
    const exists = await collectionExists();
    if (!exists) await createCollection(vectorSize);
    await upsertPoints(allPoints);
    console.log(`✅ 已添加 ${docs.length} 个文档块到 Qdrant 向量库`);
  }
}

/**
 * 功能 3 & 4 的统一入口：检索（混合）
 * Chain 直接调它，不再经过 MemoryVectorStore
 */
export async function retrieve(query: string, topK: number = 3): Promise<Document[]> {
  return hybridSearch(query, topK, 0.7, 0.3);
}

export async function getPointCountPublic(): Promise<number> {
  return getPointCount();
}

export async function vectorStoreExists(): Promise<boolean> {
  try {
    const exists = await collectionExists();
    if (!exists) return false;
    const count = await getPointCount();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * 暴露给其他模块（如 API 手动触发重新加载）
 */
export async function deleteBySource(source: string): Promise<void> {
  await deletePointsBySource(source);

  // 同步修改本地状态文件
  const state = loadFileState();
  delete state[source];
  saveFileState(state);
}

export { STATE_FILE };
