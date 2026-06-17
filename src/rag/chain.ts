import * as path from "path";
import {
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { retrieve } from "./store";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

/**
 * 根据分数分布计算动态阈值
 * - 如果分数差异大（标准差大），提高阈值，只保留高质量结果
 * - 如果分数差异小（标准差小），降低阈值，保留更多结果
 * - 关键约束：阈值不能超过最高分，避免过滤掉所有文档
 */
function calculateDynamicThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.25;
  
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  
  const variance = scores.reduce((sum, score) => {
    return sum + Math.pow(score - mean, 2);
  }, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  
  const baseThreshold = 0.25;
  const adjustmentFactor = stdDev * 1.5;
  
  let dynamicThreshold = baseThreshold + adjustmentFactor;
  
  // 关键修复：动态阈值不能超过最高分的95%，避免过滤掉所有文档
  // 留5%的余地，确保至少最高分的文档能通过
  dynamicThreshold = Math.min(dynamicThreshold, maxScore * 0.95);
  
  dynamicThreshold = Math.max(0.2, dynamicThreshold);
  dynamicThreshold = Math.min(0.6, dynamicThreshold);
  
  return dynamicThreshold;
}

/**
 * 把检索到的文档片段和用户问题拼成最终发给 LLM 的提示词
 */
function buildPrompt(input: { 
  context: string; 
  question: string; 
  knowledgeBaseOnly: boolean;
  history?: Array<{ role: string; content: string }>;
}): string {
  console.log("📜 buildPrompt 收到的 history:", JSON.stringify(input.history));
  
  // ========== 对话历史部分 ==========
  let historySection = "";
  if (input.history && input.history.length > 0) {
    // 把历史对话格式化为可读的文本
    const historyText = input.history
      .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
      .join('\n');
    
    historySection = `
【对话历史】
以下是我们之前的对话内容，请结合历史上下文来回答当前问题：
${historyText}

`;
  }
  // ========== 对话历史部分结束 ==========

  if (!input.knowledgeBaseOnly && !input.context) {
    return `${historySection}你是一位专业的智能助手，拥有丰富的知识储备。请根据你的专业知识，结合上面的对话历史，详细、准确地回答用户的问题。

用户问题：${input.question}

请给出直接、准确的答案。`;
  }
  
  if (!input.knowledgeBaseOnly) {
    return `${historySection}你是一个专业的业务问答助手。

任务：根据提供的参考信息和对话历史回答用户问题。

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
  
  return `${historySection}你是一个专业的业务问答助手，负责根据参考信息准确回答用户问题。

参考信息：
${input.context}

**重要提醒：**
- 以上参考信息可能包含多个文档的内容，但并非所有文档都与当前问题相关
- 请仔细判断每个文档片段是否与用户问题真正相关
- 如果某个文档与问题无关，请忽略它的内容，不要使用其中的任何信息
- 如果某个文档只部分相关，请只提取与问题相关的部分
- 只使用真正相关的内容来回答，不要被无关信息干扰

用户问题：${input.question}

**回答格式要求：**

【分析过程】
1. 用户问题中的关键条件：{请提取问题中的数字、时间、条件等关键信息}
2. 参考信息中的相关内容：{请列出参考信息中与问题相关的所有条款}
3. 逻辑判断：{请说明条件如何匹配参考信息中的条款，如果涉及范围判断，请明确指出条件落在哪个区间}

【最终答案】
{直接给出答案，保持适当的换行和格式，使用数字序号(1. 2. 3.)或项目符号(-)来组织内容}

**回答规则：**
1. **必须完全基于参考信息中与问题相关的内容回答，不使用任何外部知识**
2. 严格按照上述格式回答，先输出分析过程，再输出最终答案
3. 如果参考信息中**完全没有相关内容**，请在【最终答案】中回答"抱歉，我暂时没有找到相关信息"
4. 如果参考信息中有相关内容但信息不完整（如缺少部分条件），请根据已有信息给出部分答案，并说明需要补充的信息
5. 对于涉及范围或条件的问题，如果用户未提供完整条件，应列出所有可能的情况和对应的结果
6. 【最终答案】中的内容如果包含多条信息，请使用数字序号(1. 2. 3.)或项目符号(-)分行列出，保持清晰的换行格式

请根据以上规则回答用户的问题。`;
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
      model: "glm-4",
      messages: [{ role: "user", content: promptText }],
      temperature: 0,
      max_tokens: 4096,
      timeout: 300,
    }),
    signal: AbortSignal.timeout(300_000),
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
    func: async (input: { question: string; knowledgeBaseOnly: boolean; history: any[] }) => {
      console.log(`🔍 检索模式: ${input.knowledgeBaseOnly ? '仅知识库' : '允许外部搜索'}`);
      const docs = await retrieve(input.question, 5);
      console.log(`🔍 检索到 ${docs.length} 条相关文档`);
      
      const scores = docs.map(d => d.metadata.combinedScore as number || 0);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const dynamicThreshold = calculateDynamicThreshold(scores);
      
      console.log(`📊 分数分布 - 最高分: ${maxScore.toFixed(3)}, 平均分: ${avgScore.toFixed(3)}, 动态阈值: ${dynamicThreshold.toFixed(3)}`);
      
      const hasRelevantDocs = maxScore >= 0.3 && avgScore >= 0.15;
      console.log(`🎯 相关性检测 - 是否有相关文档: ${hasRelevantDocs} (最高分>=0.3: ${maxScore >= 0.3}, 平均分>=0.15: ${avgScore >= 0.15})`);
      
      let relevantDocs = docs.filter(d => {
        const combinedScore = d.metadata.combinedScore as number || 0;
        return combinedScore >= dynamicThreshold;
      });
      
      if (!hasRelevantDocs) {
        console.log(`⚠️  检测到无高相关性文档，清空参考信息`);
        relevantDocs = [];
      }
      
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
        return { context: "", sources: [], history: input.history };
      }
      
      return {
        context: relevantDocs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n\n"),
        sources,
        history: input.history,
      };
    },
  });

  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
      retrieved: retriever,
    }),
    new RunnableLambda({
      func: (input: { question: string; knowledgeBaseOnly: boolean; retrieved: { context: string; sources: string[]; history: any[] } }) => {
        const prompt = buildPrompt({
          context: input.retrieved.context,
          question: input.question,
          knowledgeBaseOnly: input.knowledgeBaseOnly,
          history: input.retrieved.history,
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
