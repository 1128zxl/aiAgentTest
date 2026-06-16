/**
 * =============================================================================
 * 【测试 7】RAG 重置与重新测试
 * =============================================================================
 * 
 * 【文件作用】
 *   一站式脚本：清空 Qdrant 数据 → 重新扫描 data/ 目录 → 全量写入 → 问答测试
 *   用于验证「增量更新 / 删除 / 混合检索 / 直连 Qdrant」四大新功能
 * 
 * 【为什么被创建】
 *   升级到四个新功能后，需要一个一键式脚本，跳过 HTTP 接口，直接调用内部模块
 *   快速验证 RAG 是否正常。可在修改代码或文档后执行
 * 
 * 【使用方法】
 *   1. 确认 Qdrant 容器运行中（docker ps | grep qdrant）
 *   2. 执行: npx tsx test/7.reset-and-test.ts
 * 
 * 【测试内容】
 *   1. 检查当前 Qdrant 状态
 *   2. 删除旧的状态文件 .qdrant-state.json
 *   3. 删除 Qdrant 中 company_docs 集合
 *   4. 扫描 data/ 目录，加载全部 .md/.docx
 *   5. 向量化并写入 Qdrant
 *   6. 初始化 Chain（直连 Qdrant + 混合检索）
 *   7. 端到端问答测试
 */

import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

import { loadLocalFile } from "../src/rag/loader";
import { splitDocuments } from "../src/rag/splitter";
import { addDocumentsToStore, vectorStoreExists, retrieve } from "../src/rag/store";
import { createRAGChain } from "../src/rag/chain";

const QDRANT_URL = "http://localhost:6333";
const COLLECTION_NAME = "company_docs";
const DATA_DIR = "./data";

async function deleteCollectionIfExists() {
  console.log("🧹 清理旧数据...");
  try {
    const checkRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    if (checkRes.ok) {
      await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, { method: "DELETE" });
      console.log("   ✅ 已删除旧的 Qdrant 集合");
    } else {
      console.log("   ℹ️  集合不存在，跳过删除");
    }
  } catch (e) {
    console.log(`   ⚠️  删除失败: ${(e as Error).message}`);
  }

  const stateFile = ".qdrant-state.json";
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
    console.log("   ✅ 已删除状态文件 .qdrant-state.json");
  }
}

async function scanAndLoad(): Promise<any[]> {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`目录 ${DATA_DIR} 不存在`);
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === ".md" || ext === ".docx";
  });

  console.log(`\n📄 扫描到 ${files.length} 个文档:`);
  files.forEach((f) => console.log(`   • ${f}`));

  const docs = [];
  for (const file of files) {
    const doc = await loadLocalFile(path.join(DATA_DIR, file));
    const splits = await splitDocuments([doc]);
    docs.push(...splits);
  }
  return docs;
}

async function main() {
  console.log("========================================");
  console.log("🔄 RAG 重置与重新测试（新版：直连 Qdrant）");
  console.log("========================================\n");

  // 步骤 1: 清理旧数据
  await deleteCollectionIfExists();

  // 步骤 2: 扫描 & 加载 & 写入
  console.log("\n=== 步骤 1: 扫描文档并写入 Qdrant ===");
  const docs = await scanAndLoad();
  console.log(`\n📊 共 ${docs.length} 个文档块，开始向量化...`);
  await addDocumentsToStore(docs);

  // 步骤 3: 验证 Qdrant 写入
  console.log("\n=== 步骤 2: 验证 Qdrant 状态 ===");
  const exists = await vectorStoreExists();
  console.log(`向量库已建立: ${exists ? "✅" : "❌"}`);

  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 10000, with_payload: true, with_vector: false }),
    });
    const data = await res.json();
    const points = data.result?.points || [];
    console.log(`Qdrant 记录数: ${points.length}`);
    // 展示 payload 结构
    if (points.length > 0) {
      const keys = Object.keys(points[0].payload || {});
      console.log(`payload 字段: ${keys.join(", ")}`);
      console.log(`\n第一条预览: ${points[0].payload?.text?.substring(0, 150)}...`);
    }
  } catch (e) {
    console.log(`❌ 验证失败: ${(e as Error).message}`);
  }

  // 步骤 4: 检索调试（混合检索）
  console.log("\n=== 步骤 3: 混合检索调试 ===");
  const testQueries = ["年假有几天？", "病假规定", "周末加班"];
  for (const q of testQueries) {
    const results = await retrieve(q, 3);
    console.log(`\n🔍 查询: ${q}`);
    results.forEach((d, i) => {
      const vs = (d.metadata.vectorScore as number)?.toFixed?.(3) ?? "-";
      const ks = (d.metadata.keywordScore as number)?.toFixed?.(3) ?? "-";
      console.log(`  [${i + 1}] vs=${vs} ks=${ks} ${d.pageContent.substring(0, 80)}...`);
    });
  }

  // 步骤 5: 端到端 Chain 问答
  console.log("\n=== 步骤 4: Chain 问答测试（直连 Qdrant + 混合检索）===");
  const chain = createRAGChain();

  const questions = [
    "年假有几天？",
    "病假怎么规定？",
    "周末加班工资怎么算？",
    "婚假有几天？",
  ];

  for (const q of questions) {
    console.log(`\n📝 Q: ${q}`);
    try {
      const answer = await chain.invoke(q);
      console.log(`✅ A: ${answer}`);
    } catch (e) {
      console.log(`❌ 出错: ${(e as Error).message}`);
    }
  }

  console.log("\n🎉 测试完成！");
}

main().catch(console.error);
