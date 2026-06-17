<template>
  <div class="app-container">
    <AppHeader :online="online" />
    
    <div class="main-content">
      <Sidebar
        :documents="documents"
        :docCount="docCount"
        @refresh="loadDocuments"
        @upload="showUploadModal = true"
        @delete="deleteDoc"
      />
      
      <main class="chat-main">
        <ChatHeader
          :knowledgeBaseOnly="knowledgeBaseOnly"
          @toggleMode="knowledgeBaseOnly = !knowledgeBaseOnly"
          @clearChat="clearChat"
        />
        
        <ChatMessages
          :chatHistory="chatHistory"
          :loading="loading"
          @quickQuestion="submitQuestion"
        />
        
        <ChatInput
          :disabled="loading"
          @submit="submitQuestion"
        />
      </main>
    </div>
    
    <UploadModal
      :visible="showUploadModal"
      @close="showUploadModal = false"
      @uploadSuccess="loadDocuments"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppHeader from './components/AppHeader.vue'
import Sidebar from './components/Sidebar.vue'
import ChatHeader from './components/ChatHeader.vue'
import ChatMessages from './components/ChatMessages.vue'
import ChatInput from './components/ChatInput.vue'
import UploadModal from './components/UploadModal.vue'

const searchQuery = ref('')
const chatHistory = ref([])
const loading = ref(false)
const documents = ref([])
const docCount = ref(0)
const online = ref(true)
const showUploadModal = ref(false)
const knowledgeBaseOnly = ref(true)

onMounted(() => {
  loadDocuments()
  checkHealth()
  setInterval(checkHealth, 5000)
})

async function checkHealth() {
  try {
    const res = await axios.get('/api/health', { timeout: 3000 })
    online.value = res.data?.status === 'ok'
  } catch {
    online.value = false
  }
}

async function loadDocuments() {
  try {
    const res = await axios.get('/api/docs')
    documents.value = res.data || []
    docCount.value = documents.value.length
  } catch (e) {
    documents.value = [
      { name: 'sample.md', type: 'md', size: 1024 },
      { name: '公司管理制度手册.docx', type: 'docx', size: 2048 }
    ]
    docCount.value = documents.value.length
  }
}

async function deleteDoc(filename) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 "${filename}" 吗？此操作将同时从知识库中移除相关知识。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await axios.delete(`/api/docs/${encodeURIComponent(filename)}`)
    ElMessage.success(res.data.message)
    loadDocuments()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || e.message)
    }
  }
}

function clearChat() {
  if (confirm('确定要清空对话历史吗？')) {
    chatHistory.value = []
  }
}

function formatTime(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

async function submitQuestion(question) {
  if (!question.trim() || loading.value) return

  chatHistory.value.push({
    type: 'user',
    content: question,
    time: formatTime(new Date()),
    sources: []
  })

  loading.value = true

  try {
    console.log(`📤 提交问题，knowledgeBaseOnly: ${knowledgeBaseOnly.value}`)
    const res = await axios.post('/api/chat', { 
      question,
      knowledgeBaseOnly: knowledgeBaseOnly.value
    })
    chatHistory.value.push({
      type: 'assistant',
      content: res.data.answer,
      time: formatTime(new Date()),
      sources: res.data.sources || []
    })
  } catch (e) {
    chatHistory.value.push({
      type: 'assistant',
      content: `⚠️ 服务异常：${e.message}`,
      time: formatTime(new Date()),
      sources: []
    })
  } finally {
    loading.value = false
  }
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  max-height: calc(100vh - 70px);
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
    max-height: none;
  }
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
}
</style>