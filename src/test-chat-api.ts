/**
 * 测试 /api/chat 接口
 *
 * 运行: npx tsx src/test-chat-api.ts
 */

async function askQuestion(question: string): Promise<void> {
  const res = await fetch("http://localhost:8081/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(30_000),
  });

  const json = await res.json();
  console.log(`Q: ${question}`);
  if (res.ok) {
    console.log(`A: ${json.answer}`);
  } else {
    console.log(`❌ 错误: ${JSON.stringify(json)}`);
  }
  console.log();
}

async function main() {
  const questions = [
    "年假有几天？",
    "远程办公怎么申请？",
  ];
  for (const q of questions) {
    await askQuestion(q);
  }
}

main().catch((e) => {
  console.error("脚本失败:", e);
  process.exit(1);
});
