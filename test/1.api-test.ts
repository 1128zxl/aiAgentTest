/**
 * =============================================================================
 * 【测试 1】API 接口测试
 * =============================================================================
 * 
 * 【文件作用】
 *   测试 RAG 服务的 HTTP API 接口是否正常工作
 * 
 * 【为什么被创建】
 *   项目刚搭建好，需要验证 Express 服务能正常响应 HTTP 请求
 * 
 * 【使用方法】
 *   先启动服务: npx tsx src/index.ts
 *   再运行测试: npx tsx test/1.api-test.ts
 * 
 * 【测试内容】
 *   向 http://localhost:8081/api/chat 发送 POST 请求
 *   验证服务能正常返回 JSON 响应
 */

import fetch from "node-fetch";

async function test() {
  console.log("🧪 测试 API 接口\n");

  const question = "你好";
  console.log(`发送问题: ${question}\n`);

  try {
    const res = await fetch("http://localhost:8081/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    console.log(`状态码: ${res.status}`);
    console.log(`响应:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("❌ 请求失败:", (e as Error).message);
  }
}

test().catch(console.error);
