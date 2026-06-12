import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

export async function splitDocuments(docs: Document[]) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,    // 每块 500 字符（中文建议小一点）
    chunkOverlap: 100, // 重叠 100 字符，保持上下文连贯
  });
  const splits = await splitter.splitDocuments(docs);
  console.log(`文档切分为 ${splits.length} 个块`);
  return splits;
}