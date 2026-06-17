import { Router, Request, Response } from "express";
import { createRAGChain } from "../rag/chain";
import { embedSingleFile, deleteSingleFile } from "../rag/store";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";

const router = Router();

const dataDir = path.resolve("./data");
const upload = multer({
  dest: path.join(dataDir, ".tmp"),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".md" || ext === ".docx") {
      cb(null, true);
    } else {
      cb(new Error("只支持 .md 和 .docx 格式"));
    }
  },
});

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
  console.log("knowledgeBaseOnly 参数:", req.body?.knowledgeBaseOnly);
  try {
    const { question, knowledgeBaseOnly = true } = req.body;
    if (!question) {
      res.status(400).json({ error: "请提供 question 字段" });
      return;
    }
    if (!chain) {
      res.status(500).json({ error: "RAG Chain 未初始化" });
      return;
    }
    const answer = await chain.invoke({ question, knowledgeBaseOnly });
    res.json({ answer: answer.answer, sources: answer.sources });
  } catch (error: any) {
    console.error("问答出错:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取文档列表接口
 * 返回 data/ 目录下的所有 .md 和 .docx 文件
 */
router.get("/docs", async (req: Request, res: Response) => {
  try {
    const dataDir = path.resolve("./data");
    
    if (!fs.existsSync(dataDir)) {
      res.json([]);
      return;
    }
    
    const files = fs.readdirSync(dataDir).filter((file: string) => {
      // 跳过目录
      const filePath = path.join(dataDir, file);
      if (fs.statSync(filePath).isDirectory()) return false;
      
      // 跳过隐藏文件（以 . 开头）
      if (file.startsWith(".")) return false;
      
      // 跳过 Word 临时文件（以 ~$ 开头）
      if (file.startsWith("~$")) return false;
      
      const ext = path.extname(file).toLowerCase();
      return ext === ".md" || ext === ".docx";
    });
    
    const docs = files.map((file: string) => ({
      name: file,
      type: path.extname(file).toLowerCase().slice(1),
      size: fs.statSync(path.join(dataDir, file)).size
    }));
    
    res.json(docs);
  } catch (error: any) {
    console.error("获取文档列表失败:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 健康检查接口
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * 上传文档接口（热更新版）
 * 上传成功后立即向量化并存入 Qdrant，无需重启
 */
router.post("/docs/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "请选择要上传的文件" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".md" && ext !== ".docx") {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "只支持 .md 和 .docx 格式" });
    }

    const destPath = path.join(dataDir, req.file.originalname);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "文件已存在" });
    }

    // 移动文件到 data 目录
    fs.renameSync(req.file.path, destPath);

    // 热更新：立即向量化并存入 Qdrant
    console.log(`\n🔄 热更新：正在向量化新上传的文件...`);
    const chunkCount = await embedSingleFile(destPath);

    res.json({
      success: true,
      filename: req.file.originalname,
      chunkCount: chunkCount,
      message: `上传成功！已向量化 ${chunkCount} 个知识块，AI 立即可用`,
    });
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除文档接口（热更新版）
 * 删除后立即从 Qdrant 中移除，无需重启
 */
router.delete("/docs/:filename", async (req: Request, res: Response) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(dataDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    const ext = path.extname(filename).toLowerCase();
    if (ext !== ".md" && ext !== ".docx") {
      return res.status(400).json({ error: "只能删除 .md 和 .docx 文件" });
    }

    // 热删除：立即从 Qdrant 中移除
    console.log(`\n🗑️  热删除：正在从向量库中移除...`);
    await deleteSingleFile(filePath);

    // 删除物理文件（带重试机制）
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        fs.unlinkSync(filePath);
        lastError = null;
        break;
      } catch (e: any) {
        lastError = e;
        if (e.code === 'EBUSY' || e.code === 'EPERM') {
          if (i < maxRetries - 1) {
            console.log(`⚠️  文件被占用，等待重试 (${i + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          throw e;
        }
      }
    }

    if (lastError) {
      // 如果文件删除失败但向量库已删除，尝试清理状态文件
      console.warn(`⚠️  文件物理删除失败，但向量库已清理: ${lastError.message}`);
      return res.status(500).json({ 
        error: `文件被其他程序占用，请先关闭相关程序后重试: ${filename}`,
        code: 'EBUSY'
      });
    }

    res.json({
      success: true,
      filename: filename,
      message: "删除成功！已从 AI 知识库中移除",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
