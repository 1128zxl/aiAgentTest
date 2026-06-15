/**
 * =============================================================================
 * 【测试 2】智谱 API 测试
 * =============================================================================
 * 
 * 【文件作用】
 *   验证智谱 GLM-4 LLM API 是否能正常调用
 * 
 * 【为什么被创建】
 *   项目使用智谱 API 作为 LLM 服务，需要先确认 API Key 和接口是否正常
 *   排除了 API 调用失败的可能性
 * 
 * 【使用方法】
 *   npx tsx test/2.zhipu-test.ts
 * 
 * 【测试内容】
 *   直接调用智谱 /chat/completions 接口
 *   发送一个简单的对话请求，验证返回是否正常
 */

import dotenv from "dotenv";
dotenv.config();

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

async function test() {
  console.log("🧪 测试智谱 API\n");

  if (!ZHIPU_API_KEY) {
    console.error("❌ 缺少 ZHIPU_API_KEY，请检查 .env 文件");
    return;
  }

  console.log(`API Key: ${ZHIPU_API_KEY.substring(0, 10)}...`);
  console.log(`模型: glm-4-flash\n`);

  try {
    const res = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [{ role: "user", content: "你好，请介绍一下你自己" }],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("❌ API 调用失败:");
      console.error(JSON.stringify(json, null, 2));
      return;
    }

    const answer = json.choices?.[0]?.message?.content;
    console.log("✅ API 调用成功！");
    console.log(`\n回答:\n${answer}`);
  } catch (e) {
    console.error("❌ 请求失败:", (e as Error).message);
  }
}

test().catch(console.error);
