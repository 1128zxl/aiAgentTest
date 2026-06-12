import OpenAI from 'openai';

async function testZhipuAPI() {
  try {
    process.env.OPENAI_API_KEY = process.env.ZHIPU_API_KEY || '';
    
    const client = new OpenAI({
      apiKey: process.env.ZHIPU_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    });

    console.log('正在测试智谱 API...');
    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: '你好' }],
    });

    console.log('API 响应:', response.choices[0].message.content);
  } catch (error: any) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应体:', await error.response.text());
    }
  }
}

testZhipuAPI();
