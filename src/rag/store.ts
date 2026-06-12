import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";

let globalStore: MemoryVectorStore | null = null;

export async function addDocumentsToStore(docs: Document[]) {
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.ZHIPU_API_KEY,
    configuration: {
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
    },
    model: "embedding-3",
  });

  globalStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
  console.log(`已添加 ${docs.length} 个文档块到内存向量库`);
  return globalStore;
}

export async function initVectorStore() {
  if (!globalStore) {
    throw new Error("向量库未初始化，请先调用 addDocumentsToStore");
  }
  return globalStore;
}