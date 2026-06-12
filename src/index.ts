import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// 加载环境变量 - 显式指定 .env 文件路径，确保能找到
const dotenvResult = dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

if (dotenvResult.error) {
  console.error("❌ 加载 .env 文件失败:", dotenvResult.error.message);
  console.log("当前工作目录:", process.cwd());
} else {
  console.log("✅ .env 文件加载成功");
  console.log("加载路径:", path.resolve(process.cwd(), ".env"));
}

import chatRouter, { initChat } from "./routes/chat";
import { loadLocalFile } from "./rag/loader";
import { splitDocuments } from "./rag/splitter";
import { addDocumentsToStore } from "./rag/store";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", chatRouter);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 检查环境变量
    console.log("环境变量检查:");
    console.log("  ZHIPU_API_KEY:", process.env.ZHIPU_API_KEY ? "已设置 ✅" : "未设置 ❌");
    console.log("  PORT:", process.env.PORT || "3000 (默认)");

    // 1. 加载文档
    const docs = await loadLocalFile("./data/sample.md");
    console.log(`✅ 加载文档: ${docs.metadata.source}`);

    // 2. 切分文档
    const splits = await splitDocuments([docs]);

    // 3. 存入向量库
    await addDocumentsToStore(splits);

    // 4. 初始化 RAG Chain
    await initChat();

    // 5. 启动服务
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

    // 处理进程终止信号
    process.on("SIGINT", () => {
      console.log("\n接收到 SIGINT，正在关闭服务...");
      server.close(() => {
        console.log("服务已关闭");
        process.exit(0);
      });
    });

    process.on("SIGTERM", () => {
      console.log("\n接收到 SIGTERM，正在关闭服务...");
      server.close(() => {
        console.log("服务已关闭");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

bootstrap();
