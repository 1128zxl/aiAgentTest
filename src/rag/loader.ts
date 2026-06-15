import { Document } from "@langchain/core/documents";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

async function loadDocxFile(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export async function loadLocalFile(filePath: string): Promise<Document> {
  const ext = path.extname(filePath).toLowerCase();
  let content: string;

  if (ext === ".docx") {
    content = await loadDocxFile(filePath);
  } else {
    content = fs.readFileSync(path.resolve(filePath), "utf-8");
  }

  return new Document({
    pageContent: content,
    metadata: { source: filePath, type: ext.slice(1) },
  });
}