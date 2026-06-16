import { Router, Request, Response } from "express";
import { createRAGChain } from "../rag/chain";

const router = Router();

let chain: any = null;

/**
 * 初始化 Chain：因为 Chain 直连 Qdrant，不再需要构建 MemoryVectorStore
 */
export async function initChat() {
  chain = createRAGChain();
  console.log("✅ RAG Chain 初始化完成（直连 Qdrant + 混合检索）");
}

router.post("/chat", async (req: Request, res: Response) => {
  console.log("收到提问:", req.body?.question);
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
