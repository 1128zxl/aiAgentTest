import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const COLLECTION_NAME = "company_docs";

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

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: { text: string; [key: string]: any };
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
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });
  console.log(`✅ Qdrant 集合 ${COLLECTION_NAME} 创建成功 (维度: ${vectorSize})`);
}

async function getPointCount(): Promise<number> {
  const res = await qdrantRequest(`/collections/${COLLECTION_NAME}/points/count`, "POST", {});
  return res.result?.count || 0;
}

async function upsertPoints(points: QdrantPoint[]) {
  await qdrantRequest(`/collections/${COLLECTION_NAME}/points`, "PUT", {
    points,
  });
}

async function searchPoints(queryVector: number[], topK: number): Promise<Document[]> {
  const res = await qdrantRequest(`/collections/${COLLECTION_NAME}/points/search`, "POST", {
    vector: queryVector,
    limit: topK,
    with_payload: true,
  });

  return (res.result || []).map((hit: any) => new Document({
    pageContent: hit.payload?.text || "",
    metadata: { ...hit.payload, score: hit.score },
  }));
}

async function getAllPoints(): Promise<{ vectors: number[][]; docs: Document[] }> {
  // 用 Qdrant scroll API 读取全部数据（ids: [] 不会返回任何内容）
  const res = await qdrantRequest(`/collections/${COLLECTION_NAME}/points/scroll`, "POST", {
    limit: 1000,
    with_payload: true,
    with_vector: true,
  });

  const points = res.result?.points || [];

  const docs: Document[] = points.map((point: any) => new Document({
    pageContent: point.payload?.text || "",
    metadata: point.payload || {},
  }));

  const vectors: number[][] = points.map((point: any) => point.vector || []);

  return { vectors, docs };
}

let globalEmbeddings: ZhipuEmbeddings | null = null;

function getEmbeddings(): ZhipuEmbeddings {
  if (!globalEmbeddings) {
    globalEmbeddings = new ZhipuEmbeddings();
  }
  return globalEmbeddings;
}

export async function addDocumentsToStore(docs: Document[]) {
  console.log("正在向量化文档并存入 Qdrant...");

  const embeddings = getEmbeddings();
  const vectors = await embeddings.embedDocuments(docs.map(d => d.pageContent));
  const vectorSize = vectors[0].length;

  const exists = await collectionExists();
  if (!exists) {
    await createCollection(vectorSize);
  }

  const points: QdrantPoint[] = docs.map((doc, idx) => ({
    id: Date.now() + idx,
    vector: vectors[idx],
    payload: { text: doc.pageContent, ...doc.metadata },
  }));

  await upsertPoints(points);
  console.log(`✅ 已添加 ${docs.length} 个文档块到 Qdrant 向量库`);
  console.log(`ℹ️  现在重启服务，数据不会丢失，也不会重新向量化！`);
}

export async function initVectorStore() {
  const count = await getPointCount();
  console.log(`✅ 从 Qdrant 加载已有向量数据 (${count} 条记录)`);

  const embeddings = getEmbeddings();
  const { vectors, docs } = await getAllPoints();

  const store = new MemoryVectorStore(embeddings);
  for (let i = 0; i < vectors.length; i++) {
    await store.addVectors([vectors[i]], [docs[i]]);
  }

  return store;
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