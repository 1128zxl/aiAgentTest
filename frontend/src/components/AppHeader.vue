<template>
  <header class="header">
    <div class="logo">
      <span class="logo-icon">📚</span>
      <span class="logo-text">个人知识库</span>
    </div>
    <div class="header-right">
      <span class="status-dot" :class="online ? 'online' : 'offline'"></span>
      <span class="status-text">{{ online ? '服务运行中' : '服务离线' }}</span>
      <span class="version">v1.0.0</span>
    </div>
  </header>
</template>

<script setup>
defineProps({
  online: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #666;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.online {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.5);
}

.status-dot.offline {
  background: #f44336;
}

.version {
  background: #f0f0f0;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}
</style>