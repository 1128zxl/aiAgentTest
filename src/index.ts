import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

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
import { addDocumentsToStore, initVectorStore, vectorStoreExists } from "./rag/store";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", chatRouter);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    console.log("环境变量检查:");
    console.log("  ZHIPU_API_KEY:", process.env.ZHIPU_API_KEY ? "已设置 ✅" : "未设置 ❌");
    console.log("  PORT:", process.env.PORT || "3000 (默认)");

    const storeExists = await vectorStoreExists();
    if (!storeExists) {
      console.log("\n📦 未检测到向量库，开始初始化...");
      const docs = await loadLocalFile("./data/sample.md");
      console.log(`✅ 加载文档: ${docs.metadata.source}`);
      
      const splits = await splitDocuments([docs]);
      await addDocumentsToStore(splits);
    } else {
      console.log("\n✅ 检测到已存在的 Qdrant 向量库");
    }

    await initChat();

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 服务已启动: http://localhost:${PORT}`);
      console.log(`📖 测试命令: Invoke-WebRequest -Uri http://localhost:${PORT}/api/chat -Method POST -ContentType "application/json" -Body '{"question":"年假有几天？"}'`);
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