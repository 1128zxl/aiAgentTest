<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h3>📁 文档库</h3>
      <div class="sidebar-actions">
        <button @click="$emit('refresh')" class="action-btn" title="刷新">
          <span>🔄</span>
        </button>
        <button @click="$emit('upload')" class="action-btn upload-btn" title="上传文档">
          <span>📤</span>
        </button>
      </div>
    </div>
    <div class="doc-list">
      <div
        v-for="doc in documents"
        :key="doc.name"
        class="doc-item"
      >
        <span class="doc-icon">{{ doc.type === 'md' ? '📝' : '📄' }}</span>
        <span class="doc-name">{{ doc.name }}</span>
        <span class="doc-size">{{ formatSize(doc.size) }}</span>
        <button @click="$emit('delete', doc.name)" class="delete-btn" title="删除">
          <span>🗑️</span>
        </button>
      </div>
      <div v-if="documents.length === 0" class="empty-state">
        <span>📭 暂无文档</span>
        <button @click="$emit('upload')" class="upload-hint-btn">
          上传文档
        </button>
      </div>
    </div>
    <div class="sidebar-footer">
      <span>📊 共 {{ docCount }} 个文档</span>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  documents: {
    type: Array,
    default: () => []
  },
  docCount: {
    type: Number,
    default: 0
  }
})

defineEmits(['refresh', 'upload', 'delete'])

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  background: white;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.sidebar-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  background: #f5f5f5;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e0e0e0;
}

.action-btn.upload-btn:hover {
  background: #e3f2fd;
  color: #1976d2;
}

.doc-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.doc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: default;
  transition: all 0.2s;
}

.doc-item:hover {
  background: #f5f5f5;
}

.doc-item:hover .delete-btn {
  opacity: 1;
}

.doc-icon {
  font-size: 16px;
}

.doc-name {
  flex: 1;
  font-size: 13px;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-size {
  font-size: 11px;
  color: #aaa;
  margin-right: 8px;
}

.delete-btn {
  background: transparent;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #ffe0e0;
}

.empty-state {
  text-align: center;
  padding: 30px 16px;
  color: #888;
}

.upload-hint-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #888;
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