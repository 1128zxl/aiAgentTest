/**
 * 端到端测试 RAG 流程
 *
 * - 加载文档 -> 切分 -> 向量化 -> 初始化 RAG chain -> 问一个问题
 * - 不启动服务器，便于快速调试
 *
 * 运行: npx tsx src/test-rag.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { loadLocalFile } from "./rag/loader";
import { splitDocuments } from "./rag/splitter";
import { addDocumentsToStore } from "./rag/store";
import { createRAGChain } from "./rag/chain";

async function main() {
  console.log("======== 1) 加载文档 ========");
  const docs = await loadLocalFile("./data/sample.md");
  console.log("文档内容长度:", docs.pageContent.length, "字符");

  console.log("\n======== 2) 切分 ========");
  const splits = await splitDocuments([docs]);
  console.log("切分成", splits.length, "块");

  console.log("\n======== 3) 向量化 ========");
  const store = await addDocumentsToStore(splits);
  console.log("向量库已就绪");

  console.log("\n======== 4) 初始化 RAG chain ========");
  const chain = createRAGChain(store);
  console.log("RAG chain 已就绪");

  const questions = [
    "年假有几天？",
    "病假需要什么证明？",
    "加班怎么算工资？",
  ];

  for (const q of questions) {
    console.log(`\n======== 问题: ${q} ========`);
    try {
      const answer = await chain.invoke(q);
      console.log("回答:", answer);
    } catch (err: any) {
      console.error("❌ 出错了:", err.message);
      console.error("完整错误栈:", err.stack);
    }
  }

  console.log("\n======== 全部测试完成 ========");
}

main().catch((e) => {
  console.error("脚本内部错误:", e);
  process.exit(1);
});
