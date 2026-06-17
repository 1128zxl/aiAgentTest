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
        <div class="chat-header-row">
          <div class="chat-toolbar">
            <button 
              class="toolbar-collapse-btn" 
              @click="toggleSidebar"
              :title="sidebarCollapsed ? '展开文档库' : '收起文档库'"
            >
              <!-- 展开状态：打开的书本 -->
              <svg v-if="!sidebarCollapsed" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4H12C13.6569 4 15 5.34315 15 7V17C15 18.6569 13.6569 20 12 20H4C2.34315 20 1 18.6569 1 17V7C1 5.34315 2.34315 4 4 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M13 4H20C21.6569 4 23 5.34315 23 7V17C23 18.6569 21.6569 20 20 20H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 4V20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M6 8H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M6 11H9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M6 14H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M14 8H18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M14 11H17" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M14 14H18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              <!-- 收起状态：合上的书本 -->
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3H8C9.65685 3 11 4.34315 11 6V18C11 19.6569 9.65685 21 8 21H2C0.343146 21 -5.32907e-08 19.6569 0 18V6C-5.32907e-08 4.34315 0.343146 3 2 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 7H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M5 10H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M5 13H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M5 16H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <ChatHeader
            :knowledgeBaseOnly="knowledgeBaseOnly"
            @toggleMode="knowledgeBaseOnly = !knowledgeBaseOnly"
            @clearChat="clearChat"
          />
        </div>
        
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
import { ref, onMounted, provide } from 'vue'
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
const isRequesting = ref(false)
const documents = ref([])
const docCount = ref(0)
const online = ref(true)
const showUploadModal = ref(false)
const knowledgeBaseOnly = ref(true)
const sidebarCollapsed = ref(false)

provide('sidebarCollapsed', sidebarCollapsed)
provide('toggleSidebar', toggleSidebar)

onMounted(() => {
  loadDocuments()
  checkHealth()
  setInterval(checkHealth, 5000)
  // 同步 Sidebar 组件的折叠状态
  const saved = localStorage.getItem('sidebar-collapsed')
  if (saved === 'true') {
    sidebarCollapsed.value = true
  }
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed.value))
}

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
  if (!question.trim() || loading.value || isRequesting.value) return

  isRequesting.value = true

  chatHistory.value.push({
    type: 'user',
    content: question,
    time: formatTime(new Date()),
    sources: []
  })

  loading.value = true

  try {
    console.log(`📤 提交问题，knowledgeBaseOnly: ${knowledgeBaseOnly.value}`)
    // 构建发送给后端的历史记录（只包含对话内容，不包含时间等元数据）
    const history = chatHistory.value.slice(0, -1).map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))
    const res = await axios.post('/api/chat', { 
      question,
      knowledgeBaseOnly: knowledgeBaseOnly.value,
      history  // 传递对话历史
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
    isRequesting.value = false
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
  position: relative;
}

.chat-header-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  min-height: 60px;
}

.chat-header-row > :deep(.chat-header) {
  flex: 1;
  border-bottom: none;
  padding-left: 0;
}

.chat-toolbar {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-right: 1px solid #f0f0f0;
  height: 60px;
}

.toolbar-collapse-btn {
  width: 32px;
  height: 32px;
  background: #f8f8f8;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  transition: all 0.2s;
}

.toolbar-collapse-btn:hover {
  background: #f0f4ff;
  color: #667eea;
  border-color: #667eea;
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