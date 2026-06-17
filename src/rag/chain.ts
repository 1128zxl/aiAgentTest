import * as path from "path";
import {
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { retrieve } from "./store";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

/**
 * 把检索到的文档片段和用户问题拼成最终发给 LLM 的提示词
 */
function buildPrompt(input: { context: string; question: string; knowledgeBaseOnly: boolean }): string {
  if (!input.knowledgeBaseOnly && !input.context) {
    return `你是一位专业的智能助手，拥有丰富的知识储备。请根据你的专业知识，详细、准确地回答用户的问题。

用户问题：${input.question}

请给出直接、准确的答案。`;
  }
  
  if (!input.knowledgeBaseOnly) {
    return `你是一个专业的业务问答助手。

任务：根据提供的参考信息回答用户问题。

参考信息：
${input.context}

用户问题：${input.question}

回答规则：
1. 仔细阅读并理解参考信息中的所有内容
2. 如果参考信息中有明确相关的内容，优先使用参考信息中的数据和规则进行回答
3. 如果参考信息不完整或没有直接答案，可以结合你的专业知识进行补充说明
4. 如果完全无法回答，请说"抱歉，我暂时无法回答这个问题"

请给出详细、准确的回答。`;
  }
  
  return `你是一个专业的业务问答助手，负责根据参考信息准确回答用户问题。

参考信息：
${input.context}

用户问题：${input.question}

**回答规则：**
1. **必须完全基于参考信息回答，不使用任何外部知识**
2. **仔细分析用户问题中的关键条件**（如入职年限、金额、时间等）
3. **如果问题涉及年限判断，找到参考信息中所有相关的年限节点**
4. **确定用户的年限落在哪个区间范围内**：
   - 如果用户年限 >= 某个节点，且 < 下一个节点，则适用当前节点的规则
   - 如果用户年限 >= 最大节点，则适用最大节点的规则
5. **根据匹配的规则，直接给出答案**，不需要列出所有可能的情况
6. **如果参考信息中没有相关内容或无法确定答案，请说"抱歉，我暂时没有找到相关信息"**

**示例：**
- 参考信息："入职满1年后，享有5天年假。入职满5年后，年假增加至10天。"
- 用户问："入职2年有几天年假？"
- 分析：2年 >= 1年 且 2年 < 5年，所以适用"满1年"的规则
- 正确回答："入职2年后，您享有5天年假。"

**另一个示例：**
- 参考信息："入职满1年后，享有5天年假。入职满5年后，年假增加至10天。"
- 用户问："入职6年有几天年假？"
- 分析：6年 >= 5年，所以适用"满5年"的规则
- 正确回答："入职6年后，您享有10天年假。"

请根据以上规则直接回答用户的问题。`;
}

/**
 * 直接用 fetch 调智谱 chat/completions 接口
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

/**
 * 功能 4：Chain 直接走 Qdrant 混合检索，不再依赖 MemoryVectorStore
 * - 检索层：`retrieve()` 内部做混合搜索（向量 + 关键词）
 * - 推理层：`callZhipuLLM()` 调智谱 LLM
 * - 支持两种模式：仅知识库 / 允许外部搜索
 */
export function createRAGChain() {
  const retriever = new RunnableLambda({
    func: async (input: { question: string; knowledgeBaseOnly: boolean }) => {
      console.log(`🔍 检索模式: ${input.knowledgeBaseOnly ? '仅知识库' : '允许外部搜索'}`);
      const docs = await retrieve(input.question, 5);
      console.log(`🔍 检索到 ${docs.length} 条相关文档`);
      
      const MIN_SCORE = 0.35;
      const relevantDocs = docs.filter(d => {
        const combinedScore = d.metadata.combinedScore as number || 0;
        const content = d.pageContent.toLowerCase();
        const question = input.question.toLowerCase();
        const hasRelevantContent = content.includes("年假") || content.includes("休假") || content.includes("假期");
        return combinedScore >= MIN_SCORE && hasRelevantContent;
      });
      
      console.log(`📝 过滤后有效参考文档: ${relevantDocs.length} 条`);
      
      const sourcesSet = new Set<string>();
      relevantDocs.forEach((d, i) => {
        const vs = (d.metadata.vectorScore as number)?.toFixed?.(3) ?? "-";
        const ks = (d.metadata.keywordScore as number)?.toFixed?.(3) ?? "-";
        const cs = (d.metadata.combinedScore as number)?.toFixed?.(3) ?? "-";
        const source = d.metadata.source as string;
        if (source) {
          const basename = path.basename(source);
          sourcesSet.add(basename);
        }
        console.log(
          `   [${i + 1}] cs=${cs} vs=${vs} ks=${ks} ${d.pageContent.substring(0, 70)}...`,
        );
      });
      
      const sources = Array.from(sourcesSet);
      
      if (relevantDocs.length === 0) {
        console.log(`ℹ️  知识库无匹配结果，${input.knowledgeBaseOnly ? '返回空上下文' : '将使用LLM知识库回答'}`);
        return { context: "", sources: [] };
      }
      
      return {
        context: relevantDocs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n\n"),
        sources,
      };
    },
  });

  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
      retrieved: retriever,
    }),
    new RunnableLambda({
      func: (input: { question: string; knowledgeBaseOnly: boolean; retrieved: { context: string; sources: string[] } }) => {
        const prompt = buildPrompt({
          context: input.retrieved.context,
          question: input.question,
          knowledgeBaseOnly: input.knowledgeBaseOnly,
        });
        console.log(
          `\n📤 发送给 LLM 的 prompt (前 200 字):\n${prompt.substring(0, 200)}...\n`,
        );
        
        let sources = input.retrieved.sources;
        if (!input.knowledgeBaseOnly) {
          sources = [];
        }
        
        return { prompt, sources, knowledgeBaseOnly: input.knowledgeBaseOnly };
      },
    }),
    new RunnableLambda({
      func: async (input: { prompt: string; sources: string[]; knowledgeBaseOnly: boolean }) => {
        const answer = await callZhipuLLM(input.prompt);
        return { answer, sources: input.sources };
      },
    }),
  ]);

  return chain;
}
