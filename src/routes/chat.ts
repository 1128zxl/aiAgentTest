import { Router, Request, Response } from "express";
import { createRAGChain } from "../rag/chain";
import { initVectorStore } from "../rag/store";

const router = Router();

let chain: any = null;

// 初始化（启动时调用一次）
export async function initChat() {
  const store = await initVectorStore();  // 去掉 "qa-docs" 参数
  chain = createRAGChain(store);
  console.log("RAG Chain 初始化完成");
}

// 问答接口
router.post("/chat", async (req: Request, res: Response) => {
  console.log("收到提问:", req.body.question);
  try {
    const { question } = req.body;
    if (!question) {
      res.status(400).json({ error: "请提供 question 字段" });
      return;
    }
    if (!chain) {
      res.status(500).json({ error: "RAG Chain 未初始化" });
      return;
    }
    const answer = await chain.invoke(question);
    res.json({ answer });
  } catch (error: any) {
    console.error("问答出错:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;