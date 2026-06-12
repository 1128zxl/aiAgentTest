import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const llm = new ChatOpenAI({
  model: "glm-4-flash",
  apiKey: process.env.ZHIPU_API_KEY,
  configuration: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
  },
  temperature: 0,
});

const prompt = PromptTemplate.fromTemplate(`
你是一个专业的业务问答助手。请根据以下参考信息回答用户的问题。

规则：
1. 只根据参考信息回答，不要编造
2. 如果参考信息中没有相关内容，请说"抱歉，我暂时没有找到相关信息"
3. 回答时引用信息来源

参考信息：
{context}

用户问题：{question}
`);

export function createRAGChain(vectorStore: MemoryVectorStore) {
  const retriever = vectorStore.asRetriever({ k: 3 });

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe((docs: any[]) =>
        docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n\n")
      ),
      question: new RunnablePassthrough(),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  return chain;
}