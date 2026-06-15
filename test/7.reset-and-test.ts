/**
 * =============================================================================
 * 【测试 7】RAG 重置与重新测试
 * =============================================================================
 * 
 * 【文件作用】
 *   一站式脚本：清空 Qdrant 数据 → 重新加载文档 → 验证 → 测试问答
 *   用于修复后验证 RAG 是否完全正常工作
 * 
 * 【为什么被创建】
 *   经过多次调试，发现 Qdrant 的 scroll API 查询方式有问题
 *   需要一个一键重置+测试的脚本，快速验证修复是否成功
 * 
 * 【使用方法】
 *   npx tsx test/7.reset-and-test.ts
 * 
 * 【测试内容】
 *   1. 检查 Qdrant 当前状态
 *   2. 重新加载 data/sample.md 并写入 Qdrant
 *   3. 验证 Qdrant 中的数据
 *   4. 初始化向量库并测试问答
 */

import dotenv from "dotenv";
dotenv.config();

import { loadLocalFile } from "../src/rag/loader";
import { splitDocuments } from "../src/rag/splitter";
import { initVectorStore, addDocumentsToStore } from "../src/rag/store";
import { createRAGChain } from "../src/rag/chain";

const QDRANT_URL = "http://localhost:6333";
const COLLECTION_NAME = "company_docs";

async function resetAndTest() {
  console.log("🔄 RAG 重置与重新测试\n");

  // 步骤 1: 检查 Qdrant 状态
  console.log("=== 步骤 1: 检查 Qdrant 状态 ===");
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1000, with_payload: true, with_vector: false }),
    });
    const data = await res.json();
    const points = data.result?.points || [];
    console.log(`当前 Qdrant 有 ${points.length} 条记录`);
    if (points.length > 0) {
      console.log(`第一条内容: ${points[0].payload?.text?.substring(0, 100)}...`);
    }
  } catch (e) {
    console.log(`❌ Qdrant 检查失败: ${(e as Error).message}`);
  }

  // 步骤 2: 重新写入数据
  console.log("\n=== 步骤 2: 重新加载文档并写入 Qdrant ===");
  const docs = await loadLocalFile("./data/sample.md");
  const splits = await splitDocuments([docs]);
  console.log(`文档已切分为 ${splits.length} 个块`);
  console.log("正在向量化并写入 Qdrant...");
  await addDocumentsToStore(splits);
  console.log("✅ 写入完成\n");

  // 步骤 3: 验证写入结果
  console.log("=== 步骤 3: 验证 Qdrant 数据 ===");
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1000, with_payload: true, with_vector: false }),
    });
    const data = await res.json();
    const points = data.result?.points || [];
    console.log(`✅ Qdrant 现在有 ${points.length} 条记录`);
    points.forEach((p: any, i: number) => {
      console.log(`\n[${i + 1}] ${p.payload?.text?.substring(0, 120)}...`);
    });
  } catch (e) {
    console.log(`❌ 验证失败: ${(e as Error).message}`);
  }

  // 步骤 4: 端到端问答测试
  console.log("\n=== 步骤 4: 端到端问答测试 ===");
  const store = await initVectorStore();
  const chain = createRAGChain(store);

  const testQuestions = [
    "年假有几天？",
    "病假怎么规定？",
    "周末加班工资怎么算？",
  ];

  for (const q of testQuestions) {
    console.log(`\n📝 问题: ${q}`);
    try {
      const answer = await chain.invoke(q);
      console.log(`✅ 回答: ${answer}`);
    } catch (e) {
      console.log(`❌ 出错: ${(e as Error).message}`);
    }
  }

  console.log("\n🎉 测试完成！");
}

resetAndTest().catch(console.error);
