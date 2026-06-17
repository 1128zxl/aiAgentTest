<template>
  <div class="chat-messages" ref="messagesContainer">
    <div v-if="chatHistory.length === 0" class="welcome">
      <div class="welcome-icon">🤖</div>
      <h3>你好，我是企业知识库助手</h3>
      <p>请向我提问公司制度、流程、规范等问题</p>
      <div class="quick-questions">
        <div class="quick-title">💡 你可以试试：</div>
        <button
          v-for="(q, i) in quickQuestions"
          :key="i"
          class="quick-btn"
          @click="$emit('quickQuestion', q)"
        >
          {{ q }}
        </button>
      </div>
    </div>

    <div
      v-for="(msg, index) in chatHistory"
      :key="index"
      class="message-item"
      :class="msg.type"
    >
      <div class="avatar">
        {{ msg.type === 'user' ? '👤' : '🤖' }}
      </div>
      <div class="message-bubble">
        <div class="message-meta">
          <span class="message-name">{{ msg.type === 'user' ? '我' : '知识库助手' }}</span>
          <span class="message-time">{{ msg.time }}</span>
        </div>
        <div v-if="msg.type === 'assistant'" class="assistant-content">
          <template v-if="hasAnalysis(msg.content)">
            <div class="analysis-section">
              <div class="analysis-header" @click="toggleAnalysis(index)">
                <div class="analysis-title">
                  <span class="analysis-icon">🔍</span>
                  <span>分析过程</span>
                </div>
                <span class="toggle-icon">{{ expandedIndices.has(index) ? '▼' : '▶' }}</span>
              </div>
              <div v-if="expandedIndices.has(index)" class="analysis-body">
                <div v-for="(line, i) in parseAnalysis(msg.content)" :key="i" class="analysis-line">
                  <span class="analysis-num">{{ i + 1 }}.</span>
                  <span class="analysis-text" v-html="parseMarkdown(line)"></span>
                </div>
              </div>
            </div>
          </template>
          <div class="answer-section">
            <div class="answer-content" v-html="parseMarkdown(hasAnalysis(msg.content) ? parseAnswer(msg.content) : msg.content)"></div>
          </div>
        </div>
        <div v-else class="message-text" v-html="parseMarkdown(msg.content)"></div>
        <div v-if="msg.sources && msg.sources.length" class="message-sources">
          <span class="sources-label">📎 参考：</span>
          <span v-for="(src, i) in msg.sources" :key="i" class="source-tag">{{ src }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="message-item assistant">
      <div class="avatar">🤖</div>
      <div class="message-bubble">
        <div class="message-meta">
          <span class="message-name">知识库助手</span>
        </div>
        <div class="message-text">
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-text">正在检索知识库...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  chatHistory: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['quickQuestion'])

const messagesContainer = ref(null)
const expandedIndices = ref(new Set())

function toggleAnalysis(index) {
  if (expandedIndices.value.has(index)) {
    expandedIndices.value.delete(index)
  } else {
    expandedIndices.value.add(index)
  }
}

function hasAnalysis(content) {
  return content.includes('【分析过程】') || content.includes('[分析过程]')
}

function parseAnalysis(content) {
  const analysisStart = content.indexOf('【分析过程】') >= 0 ? content.indexOf('【分析过程】') : content.indexOf('[分析过程]')
  const answerStart = content.indexOf('【最终答案】') >= 0 ? content.indexOf('【最终答案】') : content.indexOf('[最终答案]')
  
  if (analysisStart < 0) return []
  
  const end = answerStart > 0 ? answerStart : content.length
  const analysisContent = content.substring(analysisStart + 5, end).trim()
  
  return analysisContent.split('\n').filter(line => {
    const trimmed = line.trim()
    return trimmed && !trimmed.startsWith('【') && !trimmed.startsWith('】') && !trimmed.startsWith('[') && !trimmed.startsWith(']')
  }).map(line => {
    return line.replace(/^[\d\.\-\s]+/, '').trim().replace(/^[】\]]/, '').trim()
  })
}

function parseAnswer(content) {
  const answerStart = content.indexOf('【最终答案】') >= 0 ? content.indexOf('【最终答案】') : content.indexOf('[最终答案]')
  
  if (answerStart < 0) return content
  
  let answerContent = content.substring(answerStart + 5).trim()
  answerContent = answerContent.replace(/^[】\]]/, '').trim()
  
  return answerContent
}

function parseMarkdown(text) {
  if (!text) return ''
  
  let result = text
  
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  result = result.replace(/\n/g, '<br>')
  
  return result
}

const quickQuestions = [
  '年假有几天？',
  '病假怎么规定？',
  '周末加班工资怎么算？',
  '婚假有几天？',
  '加班工资怎么计算？',
  '离职流程是什么？'
]

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => props.chatHistory.length, () => {
  scrollToBottom()
})

watch(() => props.loading, (newVal) => {
  if (newVal) {
    scrollToBottom()
  }
})
</script>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #fafafa;
}

.welcome {
  text-align: center;
  padding: 40px 20px;
  max-width: 600px;
  margin: 0 auto;
}

.welcome-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.welcome h3 {
  font-size: 22px;
  color: #333;
  margin-bottom: 10px;
}

.welcome p {
  color: #888;
  margin-bottom: 30px;
}

.quick-questions {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.quick-title {
  font-size: 13px;
  color: #888;
  margin-bottom: 12px;
  text-align: left;
}

.quick-btn {
  display: block;
  width: 100%;
  padding: 10px 16px;
  margin-bottom: 8px;
  background: #f8f8f8;
  border: 1px solid #eee;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #555;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: flex-start;
}

.message-item.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 38px;
  height: 38px;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.message-item.user .avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.message-item.assistant .avatar {
  background: #e3f2fd;
}

.message-bubble {
  max-width: 65%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.message-item.user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-top-right-radius: 4px;
}

.message-item.assistant .message-bubble {
  background: white;
  color: #333;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.assistant-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analysis-section {
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  background: #f1f5f9;
}

.analysis-header:hover {
  background: #e2e8f0;
}

.analysis-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #475569;
}

.analysis-icon {
  font-size: 16px;
}

.toggle-icon {
  font-size: 12px;
  color: #94a3b8;
  transition: transform 0.2s;
}

.analysis-body {
  padding: 12px 14px;
}

.analysis-line {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #e2e8f0;
}

.analysis-line:last-child {
  border-bottom: none;
}

.analysis-num {
  color: #6366f1;
  font-weight: 600;
  flex-shrink: 0;
}

.analysis-text {
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
}

.answer-section {
  background: linear-gradient(135deg, #eef2ff 0%, #f0f9ff 100%);
  border-radius: 8px;
  padding: 12px 14px;
  border-left: 3px solid #6366f1;
}

.answer-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.answer-icon {
  font-size: 14px;
}

.answer-label {
  font-weight: 600;
  color: #1e293b;
  font-size: 13px;
}

.answer-content {
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
}

.message-item.user .message-meta {
  color: rgba(255, 255, 255, 0.8);
}

.message-item.assistant .message-meta {
  color: #888;
}

.message-name {
  font-weight: 600;
}

.message-text {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-sources {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 12px;
}

.message-item.user .message-sources {
  border-top-color: rgba(255, 255, 255, 0.2);
}

.sources-label {
  color: #888;
  margin-right: 6px;
}

.message-item.user .sources-label {
  color: rgba(255, 255, 255, 0.8);
}

.source-tag {
  display: inline-block;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin-right: 4px;
}

.message-item.user .source-tag {
  background: rgba(255, 255, 255, 0.2);
}

.loading-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #667eea;
  border-radius: 50%;
  margin-right: 4px;
  animation: bounce 1.4s infinite ease-in-out;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
  margin-right: 8px;
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.loading-text {
  color: #888;
  font-size: 13px;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}
</style>