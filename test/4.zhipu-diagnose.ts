/**
 * =============================================================================
 * 【测试 4】智谱 API 诊断
 * =============================================================================
 * 
 * 【文件作用】
 *   诊断智谱 Embedding API 调用失败的具体原因
 * 
 * 【为什么被创建】
 *   RAG 测试中发现 Embedding API 调用报错 "Missing credentials"
 *   需要单独测试 Embedding 接口，排除问题
 * 
 * 【使用方法】
 *   npx tsx test/4.zhipu-diagnose.ts
 * 
 * 【测试内容】
 *   1. 测试智谱 /embeddings 接口
 *   2. 验证 API Key 是否正确传递
 *   3. 检查响应格式是否符合预期
 */

import dotenv from "dotenv";
dotenv.config();

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || "";
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

async function test() {
  console.log("🧪 诊断智谱 Embedding API\n");

  if (!ZHIPU_API_KEY) {
    console.error("❌ 缺少 ZHIPU_API_KEY");
    return;
  }

  const testTexts = ["年假有几天？", "病假怎么规定？"];

  console.log("📤 发送请求:");
  console.log(`URL: ${ZHIPU_BASE_URL}/embeddings`);
  console.log(`Model: embedding-2`);
  console.log(`Texts: ${testTexts.join(", ")}\n`);

  try {
    const res = await fetch(`${ZHIPU_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: "embedding-2",
        input: testTexts,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();
    console.log(`HTTP 状态码: ${res.status}`);
    console.log(`\n原始响应:\n${text.substring(0, 500)}`);

    try {
      const json = JSON.parse(text);
      console.log(`\n✅ JSON 解析成功`);

      if (json.data && json.data.length > 0) {
        console.log(`✅ 返回了 ${json.data.length} 个向量`);
        console.log(`   向量维度: ${json.data[0].embedding.length}`);
      } else if (json.error) {
        console.log(`\n❌ API 返回错误:`);
        console.log(`   Code: ${json.error.code}`);
        console.log(`   Message: ${json.error.message}`);
      }
    } catch {
      console.log(`\n❌ JSON 解析失败`);
    }
  } catch (e) {
    console.error("❌ 请求失败:", (e as Error).message);
  }
}

test().catch(console.error);
