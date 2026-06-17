<template>
  <div class="chat-input-area">
    <div class="input-container">
      <textarea
        v-model="searchQuery"
        @keydown.enter.exact.prevent="handleSubmit"
        @keydown.shift.enter="searchQuery += '\n'"
        placeholder="输入您的问题，按 Enter 发送，Shift+Enter 换行..."
        class="chat-input"
        rows="1"
        ref="inputEl"
      ></textarea>
      <button
        @click="handleSubmit"
        :disabled="!searchQuery.trim() || disabled"
        class="send-btn"
        :class="{ disabled: !searchQuery.trim() || disabled }"
      >
        <span>📤</span>
        <span>发送</span>
      </button>
    </div>
    <div class="input-hint">
      <span>💡 基于 data/ 目录下的文档</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit'])

const searchQuery = ref('')
const inputEl = ref(null)

function handleSubmit() {
  const question = searchQuery.value.trim()
  if (!question || props.disabled) return
  
  emit('submit', question)
  searchQuery.value = ''
  nextTick(() => inputEl.value?.focus())
}

watch(() => props.disabled, (newVal) => {
  if (!newVal) {
    nextTick(() => inputEl.value?.focus())
  }
})
</script>

<style scoped>
.chat-input-area {
  padding: 16px 24px 20px;
  background: white;
  border-top: 1px solid #f0f0f0;
}

.input-container {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  background: #f8f8f8;
  border-radius: 12px;
  padding: 8px 12px;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.input-container:focus-within {
  background: white;
  border-color: #667eea;
}

.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;
  max-height: 120px;
  padding: 8px 4px;
  color: #333;
}

.send-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  height: 38px;
  flex-shrink: 0;
}

.send-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn.disabled {
  background: #ccc;
  cursor: not-allowed;
}

.input-hint {
  text-align: center;
  font-size: 12px;
  color: #aaa;
  margin-top: 8px;
}
</style>