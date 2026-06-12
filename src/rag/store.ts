import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

let globalStore: MemoryVectorStore | null = null;

/**
 * 自定义嵌入类，直接调用智谱 embedding API
 */
class ZhipuEmbeddings extends Embeddings {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    super();
    this.apiKey = process.env.ZHIPU_API_KEY || "";
    this.baseURL = "https://open.bigmodel.cn/api/paas/v4";
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("缺少 ZHIPU_API_KEY 环境变量");
    }

    const url = `${this.baseURL}/embeddings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "embedding-2",
        input: texts,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(`嵌入失败: ${JSON.stringify(json)}`);
    }

    return json.data.map((item: any) => item.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedDocuments([text]);
    return embeddings[0];
  }
}

export async function addDocumentsToStore(docs: Document[]) {
  console.log("正在初始化嵌入模型...");
  
  try {
    const embeddings = new ZhipuEmbeddings();

    console.log("正在向量化文档...");
    globalStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    console.log(`已添加 ${docs.length} 个文档块到内存向量库`);
    return globalStore;
  } catch (error: any) {
    console.error("嵌入失败:", error.message);
    console.error("错误详情:", JSON.stringify(error, null, 2));
    throw error;
  }
}

export async function initVectorStore() {
  if (!globalStore) {
    throw new Error("向量库未初始化，请先调用 addDocumentsToStore");
  }
  return globalStore;
}