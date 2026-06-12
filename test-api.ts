import fetch from 'node-fetch';

async function testChat() {
  try {
    const response = await fetch('http://localhost:8080/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: '年假有几天？' }),
    });
    
    const data = await response.json();
    console.log('API 响应:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('请求失败:', error);
  }
}

testChat();
