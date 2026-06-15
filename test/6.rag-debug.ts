/**
 * =============================================================================
 * 【测试 6】RAG 数据流调试
 * =============================================================================
 * 
 * 【文件作用】
 *   追踪 RAG 的完整数据流：文档加载 → 切分 → Qdrant存储 → 检索 → LLM
 *   找出数据在哪一步出了问题
 * 
 * 【为什么被创建】
 *   测试发现 LLM 回答"自由发挥"，没有使用文档内容
 *   需要诊断数据在哪个环节丢失或出错
 * 
 * 【使用方法】
 *   npx tsx test/6.rag-debug.ts
 * 
 * 【测试内容】
 *   1. 步骤 1: 验证文档是否正确加载
 *   2. 步骤 2: 验证文档是否正确切分
 *   3. 步骤 3: 验证 Qdrant 中是否存有数据
 *   4. 步骤 4: 验证检索功能是否正常工作
 */

import dotenv from "dotenv";
dotenv.config();

import { loadLocalFile } from "../src/rag/loader";
import { splitDocuments } from "../src/rag/splitter";
import { initVectorStore } from "../src/rag/store";

const QDRANT_URL = "http://localhost:6333";
const COLLECTION_NAME = "company_docs";

async function debug() {
  console.log("🔍 RAG 数据流调试\n");

  // 步骤 1: 检查文档加载
  console.log("=== 步骤 1: 加载文档 ===");
  const docs = await loadLocalFile("./data/sample.md");
  console.log(`✅ 加载到 ${docs.pageContent.length} 字的内容`);
  console.log(`前 200 字:\n${docs.pageContent.substring(0, 200)}\n`);

  // 步骤 2: 检查文档切分
  console.log("=== 步骤 2: 文档切分 ===");
  const splits = await splitDocuments([docs]);
  console.log(`✅ 切分为 ${splits.length} 个块`);
  splits.forEach((split, i) => {
    console.log(`\n--- 块 ${i + 1} (${split.pageContent.length} 字) ---`);
    console.log(`内容: ${split.pageContent.substring(0, 100)}...`);
  });

  // 步骤 3: 检查 Qdrant 中的实际数据
  console.log("\n=== 步骤 3: Qdrant 中的数据 ===");
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1000, with_payload: true, with_vector: false }),
    });
    const data = await res.json();
    const points = data.result?.points || [];
    console.log(`✅ Qdrant 中有 ${points.length} 条记录`);
    if (points.length === 0) {
      console.log(`⚠️  警告: Qdrant 为空！需要重新写入数据`);
    }
    points.forEach((p: any, i: number) => {
      console.log(`\n--- Qdrant 记录 ${i + 1} ---`);
      console.log(`文本: ${p.payload?.text?.substring(0, 150)}...`);
    });
  } catch (e) {
    console.log(`❌ Qdrant 读取失败: ${(e as Error).message}`);
  }

  // 步骤 4: 检查 MemoryVectorStore 检索
  console.log("\n=== 步骤 4: 检索测试 ===");
  try {
    const store = await initVectorStore();
    const retriever = store.asRetriever({ k: 3 });
    
    const testQueries = ["年假有几天？", "病假规定", "加班工资"];
    for (const q of testQueries) {
      const results = await retriever.invoke(q);
      console.log(`\n📝 问题: "${q}"`);
      console.log(`   检索到 ${results.length} 条文档`);
      if (results.length === 0) {
        console.log(`   ⚠️  警告: 没有检索到任何内容！`);
      }
      results.forEach((r: any, i: number) => {
        console.log(`   [${i + 1}] ${r.pageContent.substring(0, 80)}...`);
      });
    }
  } catch (e) {
    console.log(`❌ 检索测试失败: ${(e as Error).message}`);
  }

  console.log("\n✅ 调试完成\n");
}

debug().catch(console.error);
