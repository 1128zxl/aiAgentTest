<template>
  <div class="chat-header">
    <div class="header-left">
      <h2>💬 智能问答</h2>
      <div class="search-mode-switch">
        <span class="switch-label">仅知识库</span>
        <button 
          @click="$emit('toggleMode')" 
          class="toggle-switch"
          :class="{ active: !knowledgeBaseOnly }"
          :title="knowledgeBaseOnly ? '仅搜索知识库' : '允许外部搜索'"
        >
          <span class="toggle-thumb"></span>
        </button>
        <span class="switch-label">允许外部</span>
      </div>
    </div>
    <button @click="$emit('clearChat')" class="clear-btn">
      <span>🗑️</span>
      <span>清空对话</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  knowledgeBaseOnly: {
    type: Boolean,
    default: true
  }
})

defineEmits(['toggleMode', 'clearChat'])
</script>

<style scoped>
.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header .header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.chat-header h2 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.search-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.switch-label {
  transition: color 0.2s;
}

.toggle-switch {
  width: 48px;
  height: 26px;
  background: #e0e0e0;
  border: none;
  border-radius: 13px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(22px);
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f5f5f5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #ffe0e0;
  color: #d32f2f;
}
</style>