import { Document } from "@langchain/core/documents";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

// 加载网页文档
export async function loadWebPage(url: string): Promise<Document> {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  // 提取正文，去掉 script/style
  $("script, style").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return new Document({
    pageContent: text,
    metadata: { source: url },
  });
}

// 加载本地 Markdown/TXT 文件
export async function loadLocalFile(filePath: string): Promise<Document> {
  const content = fs.readFileSync(path.resolve(filePath), "utf-8");
  return new Document({
    pageContent: content,
    metadata: { source: filePath },
  });
}