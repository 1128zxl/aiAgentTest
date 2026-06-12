/**
 * 智谱 API 诊断脚本 - 零依赖，直接用 Node.js 内置能力调用 HTTP
 *
 * 运行方式:
 *   npx tsx src/diagnose-zhipu.ts
 *
 * 它会依次做以下检查:
 *   1) 打印当前环境变量 (ZHIPU_API_KEY / OPENAI_API_KEY)
 *   2) 尝试用不同 baseURL 调用智谱 chat/completions 端点
 *   3) 打印完整响应 / 错误信息，便于定位问题
 */

import dotenv from "dotenv";
import path from "path";

// 显式加载根目录的 .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// --------- 1) 环境信息检查 ----------
const zhipuKey = process.env.ZHIPU_API_KEY ?? "";
const openaiKey = process.env.OPENAI_API_KEY ?? "";

console.log("======== 环境信息 ========");
console.log("ZHIPU_API_KEY:", zhipuKey ? `已设置 (长度: ${zhipuKey.length})` : "❌ 未设置");
console.log("OPENAI_API_KEY:", openaiKey ? `已设置 (长度: ${openaiKey.length})` : "❌ 未设置");

// 强制把 ZHIPU_API_KEY 传给 OPENAI_API_KEY，方便 LangChain 里的 ChatOpenAI 读取
process.env.OPENAI_API_KEY = zhipuKey;

// --------- 2) 直接用 Node.js fetch 调智谱 chat/completions ----------
// 智谱常见的几个 baseURL 候选：
//   - https://open.bigmodel.cn/api/paas/v4
//   - https://api.zhipuai.cn/v4
//   - https://api.zhipuai.cn/v3
// OpenAI 兼容端点一般是 <baseURL>/chat/completions
const CANDIDATE_BASE_URLS = [
  "https://open.bigmodel.cn/api/paas/v4",
  "https://api.zhipuai.cn/v4",
  "https://api.zhipuai.cn/v3",
];

const BODY = JSON.stringify({
  model: "glm-4-flash",
  messages: [{ role: "user", content: "用一句话介绍你自己。" }],
  max_tokens: 100,
});

async function testOneEndpoint(baseURL: string) {
  const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${zhipuKey}`,
  };

  console.log("\n======== 尝试调用 ========");
  console.log("URL:", url);
  console.log("Headers: Content-Type + Authorization (已隐藏 key 内容)");

  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: BODY,
      // fetch 默认没有 timeout，这里给个 15 秒保险
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Date.now() - t0;

    const text = await res.text();
    console.log("Status:", res.status, res.statusText, `(耗时 ${elapsed}ms)`);
    console.log("响应头 content-type:", res.headers.get("content-type") ?? "无");
    console.log("响应体 (前 1000 字符):");
    console.log(text.slice(0, 1000));

    // 尝试解析 JSON 并把关键字段漂亮地打印
    try {
      const json = JSON.parse(text);
      console.log("\n解析后的 JSON 关键字段:");
      if (json.choices?.[0]?.message) {
        console.log("  answer:", json.choices[0].message.content);
      }
      if (json.error) {
        console.log("  error:", JSON.stringify(json.error));
      }
      if (json.code) {
        console.log("  code:", json.code, "msg:", json.msg ?? json.message ?? "");
      }
    } catch {
      // 不是 JSON 就忽略
    }
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    console.log("❌ 请求失败 (耗时", elapsed, "ms)");
    console.log("错误类型:", err.constructor.name);
    console.log("错误消息:", err.message);
    // 超时 / DNS / 代理 / 网络证书 错误各自的特征
    if (err.name === "TimeoutError") {
      console.log("  -> 请求超时，很可能是网络不通 / 需要代理");
    } else if (err.cause) {
      console.log("  cause:", JSON.stringify(err.cause));
    }
  }
}

async function main() {
  if (!zhipuKey) {
    console.error("\n❌ 缺少 ZHIPU_API_KEY，无法继续。请在 .env 中配置你的 API Key。");
    process.exit(1);
  }

  console.log("\n======== 开始逐个测试候选 baseURL ========");
  for (const url of CANDIDATE_BASE_URLS) {
    await testOneEndpoint(url);
  }

  console.log("\n======== 诊断完成 ========");
  console.log("如果上述请求里有一个成功了，就把对应的 baseURL 写到 src/rag/chain.ts 里即可。");
  console.log("如果全部失败，请把输出粘贴到聊天，我们可以进一步判断是网络/代理/证书问题还是 API Key 问题。");
}

main().catch((e) => {
  console.error("脚本内部错误:", e);
  process.exit(1);
});
