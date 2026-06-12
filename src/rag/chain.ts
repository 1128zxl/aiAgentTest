import {
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

/**
 * 把检索到的文档片段和用户问题拼成最终发给 LLM 的提示词
 */
function buildPrompt(input: { context: string; question: string }): string {
  return `你是一个专业的业务问答助手。请根据以下参考信息回答用户的问题。

规则：
1. 只根据参考信息回答，不要编造
2. 如果参考信息中没有相关内容，请说"抱歉，我暂时没有找到相关信息"
3. 回答时引用信息来源

参考信息：
${input.context}

用户问题：${input.question}
`;
}

/**
 * 直接用 fetch 调智谱 chat/completions 接口
 * - 不依赖 @langchain/openai，避免它内部初始化 OpenAI client 时丢失 apiKey
 * - 完全可控：headers / body / error handling 都在这一个函数里
 */
async function callZhipuLLM(promptText: string): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 ZHIPU_API_KEY 环境变量");
  }

  const url = `${ZHIPU_BASE_URL}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-4-flash",
      messages: [{ role: "user", content: promptText }],
      temperature: 0,
    }),
    // 30 秒超时，避免卡住
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `智谱 API 返回非 JSON: status=${res.status} body=${text.slice(0, 300)}`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `智谱 API 调用失败: status=${res.status} body=${JSON.stringify(json)}`,
    );
  }

  const answer = json.choices?.[0]?.message?.content;
  if (typeof answer !== "string") {
    throw new Error(`智谱 API 响应里找不到 choices[0].message.content: ${JSON.stringify(json)}`);
  }
  return answer;
}

export function createRAGChain(vectorStore: MemoryVectorStore) {
  const retriever = vectorStore.asRetriever({ k: 3 });

  const chain = RunnableSequence.from([
    {
      // 1) 把用户问题传给检索器，拿到最相关的文档片段
      context: retriever.pipe((docs: any[]) =>
        docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n\n"),
      ),
      // 2) 原样透传用户问题，供提示词模板使用
      question: new RunnablePassthrough(),
    },
    // 3) 拼接成最终提示词字符串
    new RunnableLambda({ func: buildPrompt }),
    // 4) 调智谱 LLM
    new RunnableLambda({ func: callZhipuLLM }),
    // 5) 上面已经返回 string，不需要再 StringOutputParser
  ]);

  return chain;
}
