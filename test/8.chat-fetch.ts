/**
 * =============================================================================
 * 【测试 8】RAG 问答接口最终测试
 * =============================================================================
 * 
 * 【文件作用】
 *   通过 HTTP 接口测试完整的 RAG 问答流程
 *   这是最终验收测试，验证整个系统端到端是否正常
 * 
 * 【为什么被创建】
 *   PowerShell 的 Invoke-WebRequest 发送中文时使用 GBK 编码
 *   导致 Express 服务端收到乱码，无法正确处理中文问题
 *   使用 Node.js 的 fetch 发送 UTF-8 编码的请求，绕过编码问题
 * 
 * 【使用方法】
 *   1. 先启动服务: npx tsx src/index.ts
 *   2. 再运行测试: npx tsx test/8.chat-fetch.ts
 * 
 * 【测试内容】
 *   向 /api/chat 接口发送多个中文问题
 *   验证回答是否基于 data/sample.md 中的文档内容
 */

import fetch from "node-fetch";

async function test() {
  console.log("🧪 RAG 问答接口测试\n");

  const questions = [
    "年假有几天？",
    "病假怎么规定？",
    "周末加班工资怎么算？",
    "每周能远程办公几天？",
    "你今年几岁了？"
  ];

  for (const q of questions) {
    console.log(`Q: ${q}`);
    try {
      const res = await fetch("http://localhost:8081/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json() as any;
      if (data.answer) {
        console.log(`A: ${data.answer}\n`);
      } else {
        console.log(`❌ 响应: ${JSON.stringify(data)}\n`);
      }
    } catch (e) {
      console.log(`❌ 错误: ${(e as Error).message}\n`);
    }
  }

  console.log("✅ 测试完成");
}

test().catch(console.error);
