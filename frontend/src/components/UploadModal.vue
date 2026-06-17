<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleOverlayClick">
    <div class="modal-content">
      <div class="modal-header">
        <h3>📤 上传文档</h3>
        <button @click="handleClose" class="modal-close">
          <span>✕</span>
        </button>
      </div>
      <div class="modal-body">
        <!-- 上传成功状态 -->
        <div v-if="uploadCompleted" class="success-state">
          <div class="success-icon">✓</div>
          <h3 class="success-title">上传成功！</h3>
          <p class="success-message">文档已添加到知识库，AI 立即可用</p>
          <div class="success-file">
            <span class="file-icon">📄</span>
            <span class="file-name">{{ completedFileName }}</span>
          </div>
        </div>

        <!-- 上传区域 -->
        <div v-else-if="!uploading">
          <div
            class="upload-area"
            :class="{ 'dragover': isDragover, 'has-file': selectedFile }"
            @click="triggerFileInput"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="isDragover = false"
            @drop.prevent="handleDrop"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".md,.docx"
              class="file-input"
              @change="handleFileSelect"
            />
            <div class="upload-icon">📁</div>
            <h4>{{ selectedFile ? '文件已选择' : '点击或拖拽文件到此处' }}</h4>
            <p class="upload-tip">支持格式：<code>.md</code>、<code>.docx</code></p>
            <p class="upload-size">单个文件最大 50MB</p>
          </div>

          <!-- 已选文件信息 -->
          <div v-if="selectedFile" class="selected-file">
            <div class="file-info">
              <span class="file-icon">📄</span>
              <div class="file-details">
                <span class="file-name">{{ selectedFile.name }}</span>
                <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
              </div>
              <button @click.stop="clearSelectedFile" class="file-remove">✕</button>
            </div>
          </div>

          <!-- 错误提示 -->
          <div v-if="uploadMessage" class="upload-message error">
            {{ uploadMessage }}
          </div>
        </div>

        <!-- 上传进度状态 -->
        <div v-else class="uploading-state">
          <div class="uploading-icon">⏳</div>
          <h3 class="uploading-title">正在向量化文档...</h3>
          <p class="uploading-message">{{ selectedFile?.name }}</p>
          <div class="upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <span class="progress-text">{{ uploadProgress }}%</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button v-if="uploadCompleted" @click="handleClose" class="btn-submit full-width">
          完成
        </button>
        <template v-else-if="!uploading">
          <button @click="handleClose" class="btn-cancel">取消</button>
          <button
            @click="submitUpload"
            :disabled="!selectedFile"
            class="btn-submit"
            :class="{ disabled: !selectedFile }"
          >
            确认上传
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'uploadSuccess'])

const fileInput = ref(null)
const selectedFile = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadMessage = ref('')
const isDragover = ref(false)
const uploadCompleted = ref(false)
const completedFileName = ref('')

// 监听 visible 变化，重置状态
watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetState()
  }
})

function resetState() {
  selectedFile.value = null
  uploading.value = false
  uploadProgress.value = 0
  uploadMessage.value = ''
  uploadCompleted.value = false
  completedFileName.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function handleClose() {
  if (!uploading.value) {
    emit('close')
  }
}

function handleOverlayClick() {
  if (!uploading.value) {
    emit('close')
  }
}

function triggerFileInput() {
  if (!uploading.value) {
    fileInput.value?.click()
  }
}

function handleDragOver() {
  isDragover.value = true
}

function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (file) {
    validateFile(file)
  }
}

function handleDrop(event) {
  isDragover.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    validateFile(file)
  }
}

function clearSelectedFile() {
  selectedFile.value = null
  uploadMessage.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function validateFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'md' && ext !== 'docx') {
    ElMessage.error('❌ 只支持 .md 和 .docx 格式')
    selectedFile.value = null
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error('❌ 文件大小不能超过 50MB')
    selectedFile.value = null
    return
  }
  selectedFile.value = file
  uploadMessage.value = ''
}

async function submitUpload() {
  if (!selectedFile.value || uploading.value) return

  uploading.value = true
  uploadProgress.value = 0
  uploadMessage.value = ''

  const formData = new FormData()
  formData.append('file', selectedFile.value)

  try {
    const res = await axios.post('/api/docs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progress) => {
        uploadProgress.value = Math.round((progress.loaded / progress.total) * 100)
      }
    })

    // 显示成功状态
    completedFileName.value = selectedFile.value.name
    uploading.value = false
    uploadCompleted.value = true

    // 通知父组件刷新文件列表
    emit('uploadSuccess')
  } catch (e) {
    uploading.value = false
    ElMessage.error(e.response?.data?.error || e.message)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.modal-close {
  background: transparent;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 14px;
}

.modal-close:hover {
  background: #f5f5f5;
}

.modal-body {
  padding: 24px;
}

/* ===== 上传区域 ===== */
.upload-area {
  border: 2px dashed #ddd;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover,
.upload-area.dragover {
  border-color: #667eea;
  background: #f8f7ff;
}

.upload-area.has-file {
  border-color: #667eea;
  background: #f8f7ff;
}

.file-input {
  display: none;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-area h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.upload-tip {
  margin: 0;
  color: #888;
  font-size: 14px;
}

.upload-tip code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.upload-size {
  margin: 8px 0 0 0;
  color: #aaa;
  font-size: 12px;
}

/* ===== 已选文件信息 ===== */
.selected-file {
  margin-top: 16px;
  background: #f8f7ff;
  border-radius: 8px;
  padding: 12px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-info .file-icon {
  font-size: 28px;
}

.file-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-details .file-name {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.file-details .file-size {
  font-size: 12px;
  color: #888;
}

.file-remove {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.file-remove:hover {
  background: #ff4444;
  color: white;
}

/* ===== 上传中状态 ===== */
.uploading-state {
  text-align: center;
  padding: 20px 0;
}

.uploading-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
}

.uploading-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #333;
}

.uploading-message {
  margin: 0 0 16px 0;
  color: #888;
  font-size: 14px;
  word-break: break-all;
}

.upload-progress {
  margin-top: 16px;
}

.progress-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.progress-text {
  display: block;
  text-align: right;
  margin-top: 8px;
  font-size: 14px;
  color: #667eea;
  font-weight: 600;
}

/* ===== 上传成功状态 ===== */
.success-state {
  text-align: center;
  padding: 20px 0;
}

.success-icon {
  width: 80px;
  height: 80px;
  line-height: 80px;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
  font-size: 48px;
  font-weight: bold;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: successBounce 0.5s ease-out;
}

@keyframes successBounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.success-title {
  margin: 0 0 8px 0;
  font-size: 22px;
  color: #333;
}

.success-message {
  margin: 0 0 20px 0;
  color: #888;
  font-size: 14px;
}

.success-file {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.success-file .file-icon {
  font-size: 24px;
}

.success-file .file-name {
  font-size: 14px;
  color: #52c41a;
  font-weight: 500;
}

/* ===== 消息提示 ===== */
.upload-message {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}

.upload-message.error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
}

/* ===== 底部按钮 ===== */
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 10px 24px;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #e8e8e8;
}

.btn-submit {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-submit:hover:not(.disabled) {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transform: translateY(-1px);
}

.btn-submit.disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-submit.full-width {
  width: 100%;
}
</style>