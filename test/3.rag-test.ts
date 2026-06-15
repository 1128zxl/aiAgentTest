/**
 * =============================================================================
 * 【测试 3】RAG 基本功能测试
 * =============================================================================
 * 
 * 【文件作用】
 *   测试 RAG（检索增强生成）的完整流程
 *   文档加载 → 切分 → 向量化 → 检索 → LLM 生成
 * 
 * 【为什么被创建】
 *   确认 LangChain + 智谱 API 的 RAG 流程能跑通
 *   这是项目的核心功能验证
 * 
 * 【使用方法】
 *   npx tsx test/3.rag-test.ts
 * 
 * 【测试内容】
 *   1. 加载 data/sample.md 文档
 *   2. 调用智谱 Embedding API 向量化
 *   3. 构建 RAG 链
 *   4. 提问并验证回答是否基于文档
 */

import dotenv from "dotenv";
dotenv.config();

import { loadLocalFile } from "../src/rag/loader";
import { splitDocuments } from "../src/rag/splitter";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || "";
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

class ZhipuEmbeddings {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${ZHIPU_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({ model: "embedding-2", input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();
    return json.data.map((item: any) => item.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeds = await this.embedDocuments([text]);
    return embeds[0];
  }
}

async function test() {
  console.log("🧪 测试 RAG 基本功能\n");

  // 1. 加载文档
  console.log("步骤 1: 加载文档");
  const doc = await loadLocalFile("./data/sample.md");
  console.log(`✅ 加载完成 (${doc.pageContent.length} 字)\n`);

  // 2. 切分文档
  console.log("步骤 2: 切分文档");
  const splits = await splitDocuments([doc]);
  console.log(`✅ 切分为 ${splits.length} 个块\n`);

  // 3. 向量化
  console.log("步骤 3: 向量化文档");
  const embeddings = new ZhipuEmbeddings();
  const vectors = await embeddings.embedDocuments(splits.map(s => s.pageContent));
  console.log(`✅ 向量维度: ${vectors[0].length}\n`);

  // 4. 构建向量库
  console.log("步骤 4: 构建向量库");
  const store = new MemoryVectorStore(embeddings);
  await store.addVectors(vectors, splits);
  console.log(`✅ 向量库构建完成\n`);

  // 5. 检索测试
  console.log("步骤 5: 检索测试");
  const retriever = store.asRetriever({ k: 1 });
  const docs = await retriever.invoke("年假有几天？");
  console.log(`✅ 检索到 ${docs.length} 条相关文档`);
  docs.forEach((d, i) => {
    console.log(`   [${i + 1}] ${d.pageContent.substring(0, 80)}...`);
  });

  // 6. LLM 生成测试
  console.log("\n步骤 6: LLM 生成测试");
  const prompt = `根据以下文档回答问题。
文档: ${docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n")}
问题: 年假有几天？`;

  const res = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify({
      model: "glm-4-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  const json = await res.json();
  const answer = json.choices?.[0]?.message?.content;
  console.log(`\n回答: ${answer}`);
  console.log("\n✅ RAG 测试完成！");
}

test().catch(console.error);
