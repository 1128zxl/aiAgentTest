import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

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
    // 1. 加载文档（换成你自己的文档路径）
    const docs = await loadLocalFile("./data/sample.md");
    console.log(`加载文档: ${docs.metadata.source}`);

    // 2. 切分文档
    const splits = await splitDocuments([docs]);

    // 3. 存入向量库
    await addDocumentsToStore(splits);

    // 4. 初始化 RAG Chain
    await initChat();

    // 5. 启动服务 - 将 server 赋值给变量，保持进程运行
    const server = app.listen(PORT, () => {
      console.log(`服务已启动: http://localhost:${PORT}`);
      console.log(`测试: curl -X POST http://localhost:${PORT}/api/chat -H "Content-Type: application/json" -d '{"question":"你的问题"}'`);
    });

    // 保持进程运行，监听关闭事件
    server.on("close", () => {
      console.log("服务已关闭");
    });

    // 处理进程终止信号
    process.on("SIGINT", () => {
      console.log("\n接收到 SIGINT，正在关闭服务...");
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

bootstrap();
