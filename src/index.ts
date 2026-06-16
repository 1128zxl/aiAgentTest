import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Document } from "@langchain/core/documents";

const dotenvResult = dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

if (dotenvResult.error) {
  console.error("❌ 加载 .env 文件失败:", dotenvResult.error.message);
} else {
  console.log("✅ .env 文件加载成功");
}

import chatRouter, { initChat } from "./routes/chat";
import { loadLocalFile } from "./rag/loader";
import { splitDocuments } from "./rag/splitter";
import {
  syncDocumentsToQdrant,
  vectorStoreExists,
  getPointCountPublic,
  addDocumentsToStore,
  deleteBySource,
} from "./rag/store";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", chatRouter);

const PORT = process.env.PORT || 3000;
const DATA_DIR = "./data";

/**
 * 扫描 data/ 目录，读取每个文档的内容和修改时间
 * 为增量更新提供输入
 */
async function scanDataDir(): Promise<
  { source: string; mtime: number; splits: Document[] }[]
> {
  if (!fs.existsSync(DATA_DIR)) {
    console.warn(`⚠️  目录 ${DATA_DIR} 不存在`);
    return [];
  }

  const files = fs.readdirSync(DATA_DIR).filter((f: string) => {
    const ext = path.extname(f).toLowerCase();
    return ext === ".md" || ext === ".docx";
  });

  const result: { source: string; mtime: number; splits: Document[] }[] = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const stat = fs.statSync(filePath);
    const doc = await loadLocalFile(filePath);

    const splits = await splitDocuments([doc]);

    result.push({
      source: filePath,
      mtime: stat.mtimeMs,
      splits,
    });
  }

  return result;
}

/**
 * 打印同步结果（增量更新日志）
 */
function printSummary(
  currentDocs: any[],
  incrementalResult: Awaited<ReturnType<typeof syncDocumentsToQdrant>>,
) {
  const totalChunks = currentDocs.reduce(
    (sum: number, d: any) => sum + d.splits.length,
    0,
  );

  console.log("");
  console.log("======== 增量更新摘要 ========");
  console.log(`📄 data/ 目录文档数: ${currentDocs.length}`);
  console.log(`📊 总切块数: ${totalChunks}`);
  console.log(`➕ 本次新增/修改: ${incrementalResult.newSources.length}`);
  if (incrementalResult.newSources.length) {
    incrementalResult.newSources.forEach((s) => console.log(`   • ${s}`));
  }
  console.log(`🗑  已删除: ${incrementalResult.deletedSources.length}`);
  if (incrementalResult.deletedSources.length) {
    incrementalResult.deletedSources.forEach((s) => console.log(`   • ${s}`));
  }
  console.log(`🔁 无变化: ${incrementalResult.unchangedSources.length}`);
  console.log("==============================");
}

async function bootstrap() {
  try {
    console.log("环境变量检查:");
    console.log("  ZHIPU_API_KEY:", process.env.ZHIPU_API_KEY ? "已设置 ✅" : "未设置 ❌");
    console.log("  PORT:", process.env.PORT || "3000 (默认)");

    // --- 扫描当前文档 ---
    console.log(`\n🔍 扫描 ${DATA_DIR}/ 目录...`);
    const currentDocs = await scanDataDir();
    console.log(`共发现 ${currentDocs.length} 个文档`);

    // --- 判断是否需要首次全量初始化 ---
    const exists = await vectorStoreExists();
    let incrementalResult;

    if (!exists) {
      // 首次：将所有文档全部向量化
      console.log("\n📦 未检测到向量库，首次全量初始化...");
      const allSplits: Document[] = [];
      currentDocs.forEach((d) => allSplits.push(...d.splits));
      await addDocumentsToStore(allSplits);

      incrementalResult = {
        addedCount: allSplits.length,
        newSources: currentDocs.map((d) => d.source),
        deletedSources: [],
        unchangedSources: [],
      };

      // 写入状态文件，下次能做增量
      const state: Record<string, number> = {};
      currentDocs.forEach((d) => (state[d.source] = d.mtime));
      fs.writeFileSync(".qdrant-state.json", JSON.stringify(state, null, 2));
    } else {
      // 已有向量库 → 增量更新
      console.log("\n🔄 检测到已存在向量库，执行增量更新...");
      incrementalResult = await syncDocumentsToQdrant(currentDocs);
    }

    printSummary(currentDocs, incrementalResult);

    // --- 当前总量 ---
    const totalPoints = await getPointCountPublic();
    console.log(`\n📊 Qdrant 总向量数: ${totalPoints}`);

    // --- 初始化 Chain（Chain 直连 Qdrant，没有启动时加载步骤）---
    await initChat();

    // --- 启动服务 ---
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 服务已启动: http://localhost:${PORT}`);
      console.log(`📖 测试命令: Invoke-WebRequest -Uri http://localhost:${PORT}/api/chat -Method POST -ContentType "application/json" -Body '{\"question\":\"年假有几天？\"}'`);
    });

    server.on("error", (error: any) => {
      console.error("服务器启动失败:", error);
      process.exit(1);
    });

    server.on("listening", () => {
      console.log(`✅ 服务器正在监听端口 ${PORT}`);
    });

    process.on("SIGINT", () => {
      console.log("\n接收到 SIGINT，正在关闭服务...");
      server.close(() => process.exit(0));
    });

    process.on("SIGTERM", () => {
      console.log("\n接收到 SIGTERM，正在关闭服务...");
      server.close(() => process.exit(0));
    });
  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

bootstrap();
