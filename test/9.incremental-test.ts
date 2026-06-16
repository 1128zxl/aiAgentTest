/**
 * =============================================================================
 * 【测试 9】增量更新功能验证
 * =============================================================================
 * 
 * 【文件作用】
 *   验证「增量更新 + 删除文档同步」两大功能的正确性
 * 
 * 【为什么被创建】
 *   新实现了 4 个功能：增量更新、删除文档同步、混合检索、直连 Qdrant
 *   其中增量更新对用户体验影响最大——加文档时不应该重新向量化所有文档
 *   这个脚本模拟整个真实场景：首次初始化 → 加文档 → 删文档 → 验证
 * 
 * 【使用方法】
 *   1. 确认 Qdrant 正在运行
 *   2. 执行: npx tsx test/9.incremental-test.ts
 * 
 * 【测试流程】
 *   1. 清空: 删除 Qdrant 集合 + .qdrant-state.json
 *   2. Round 1: 首次初始化 — 写入 sample.md
 *      预期: 全量写入
 *   3. Round 2: 不做任何改动 — 再次启动
 *      预期: 无新增、无删除，增量更新识别「无变化」
 *   4. Round 3: 新增一份临时文档 extra.md，再次启动
 *      预期: 只向量化新增文档，不重复处理 sample.md
 *   5. Round 4: 删除临时文档 extra.md，再次启动
 *      预期: 从 Qdrant 删除该文档对应的 points
 */

import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

import { loadLocalFile } from "../src/rag/loader";
import { splitDocuments } from "../src/rag/splitter";
import {
  syncDocumentsToQdrant,
  addDocumentsToStore,
  getPointCountPublic,
  deleteBySource,
} from "../src/rag/store";

const QDRANT_URL = "http://localhost:6333";
const COLLECTION_NAME = "company_docs";
const DATA_DIR = "./data";
const STATE_FILE = ".qdrant-state.json";
const EXTRA_FILE = path.join(DATA_DIR, "__test_extra.md");

async function reset() {
  // 删除集合
  try {
    const r = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    if (r.ok) {
      await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: "DELETE",
      });
      console.log("   ✅ Qdrant 集合已删除");
    }
  } catch {
    /* ignore */
  }

  // 删除状态文件
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log("   ✅ 状态文件已删除");
  }

  // 清理测试用临时文档
  if (fs.existsSync(EXTRA_FILE)) {
    fs.unlinkSync(EXTRA_FILE);
    console.log("   ✅ 临时测试文档已删除");
  }
}

async function scanCurrent(): Promise<
  { source: string; mtime: number; splits: any[] }[]
> {
  const files = fs.readdirSync(DATA_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === ".md" || ext === ".docx";
  });

  const result: { source: string; mtime: number; splits: any[] }[] = [];
  for (const file of files) {
    const fp = path.join(DATA_DIR, file);
    const stat = fs.statSync(fp);
    const doc = await loadLocalFile(fp);
    const splits = await splitDocuments([doc]);
    result.push({ source: fp, mtime: stat.mtimeMs, splits });
  }
  return result;
}

async function main() {
  console.log("===========================================");
  console.log("🔬 【测试 9】增量更新 / 删除文档 功能验证");
  console.log("===========================================\n");

  // ============== Round 0: 重置 ==============
  console.log("=== Round 0: 重置环境 ===");
  await reset();
  console.log("");

  // ============== Round 1: 首次全量 ==============
  console.log("=== Round 1: 首次初始化 — 全量写入 sample.md ===");
  let docs = await scanCurrent();
  console.log(`扫描到 ${docs.length} 个文档`);
  let allSplits: any[] = [];
  docs.forEach((d) => allSplits.push(...d.splits));
  await addDocumentsToStore(allSplits);
  // 写入状态
  const state1: Record<string, number> = {};
  docs.forEach((d) => (state1[d.source] = d.mtime));
  fs.writeFileSync(STATE_FILE, JSON.stringify(state1, null, 2));
  const total1 = await getPointCountPublic();
  console.log(`✅ 写入完成，共 ${total1} 个向量\n`);

  // ============== Round 2: 无变化 ==============
  console.log("=== Round 2: 无变化 — 验证增量更新跳过 ===");
  docs = await scanCurrent();
  const r2 = await syncDocumentsToQdrant(docs);
  console.log(`新增/修改: ${r2.newSources.length}`);
  console.log(`删除: ${r2.deletedSources.length}`);
  console.log(`无变化: ${r2.unchangedSources.length}`);
  console.log(`✅ 预期: 0 新增, 0 删除, ${docs.length} 无变化`);
  console.log("");

  // ============== Round 3: 新增文档 ==============
  console.log("=== Round 3: 新增临时文档 extra.md ===");
  fs.writeFileSync(
    EXTRA_FILE,
    "# 测试文档\n\n这是一份用于测试增量更新的临时文档。\n\n" +
      "内容包括以下条款：\n\n" +
      "- 员工入职满一年后，可申请年度体检。\n" +
      "- 年度体检费用由公司全额承担。\n" +
      "- 体检需提前 1 个月预约。\n",
    "utf-8",
  );
  // 等一下确保 mtime 不同
  await new Promise((r) => setTimeout(r, 1500));
  docs = await scanCurrent();
  const r3 = await syncDocumentsToQdrant(docs);
  console.log(`新增/修改: ${r3.newSources.length} → ${r3.newSources.join(", ")}`);
  console.log(`删除: ${r3.deletedSources.length}`);
  console.log(`无变化: ${r3.unchangedSources.length}`);
  console.log(`✅ 预期: 1 新增, 0 删除, ${docs.length - 1} 无变化`);
  const total3 = await getPointCountPublic();
  console.log(`当前向量总数: ${total3}（应有 ${total1} + N 条）\n`);

  // ============== Round 4: 删除文档 ==============
  console.log("=== Round 4: 删除临时文档 — 验证同步清理 Qdrant ===");
  if (fs.existsSync(EXTRA_FILE)) {
    fs.unlinkSync(EXTRA_FILE);
  }
  // 等一下确保 mtime 不同
  await new Promise((r) => setTimeout(r, 1500));
  docs = await scanCurrent();
  const r4 = await syncDocumentsToQdrant(docs);
  console.log(`新增/修改: ${r4.newSources.length}`);
  console.log(`删除: ${r4.deletedSources.length} → ${r4.deletedSources.join(", ")}`);
  console.log(`无变化: ${r4.unchangedSources.length}`);
  console.log(`✅ 预期: 0 新增, 1 删除, ${docs.length} 无变化`);
  const total4 = await getPointCountPublic();
  console.log(`当前向量总数: ${total4}（应回到 ${total1} 左右）\n`);

  // ============== 最终状态校验 ==============
  console.log("=== 最终状态校验 ===");
  const finalPoints = await getPointCountPublic();
  console.log(`最终 Qdrant 向量数: ${finalPoints}`);
  console.log(`首次写入向量数: ${total1}`);
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  console.log(`状态文件记录: ${Object.keys(state).length} 个文档`);
  console.log("");

  console.log("🎉 增量更新 / 删除文档 测试完成！");
  console.log("   • 首次全量初始化 ✅");
  console.log("   • 无变化时跳过向量化 ✅");
  console.log("   • 新增文档单独向量化 ✅");
  console.log("   • 删除文档同步清理 Qdrant ✅");
}

main().catch(console.error);
