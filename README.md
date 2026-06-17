# 企业智能知识助手

> 基于 RAG + AI 的企业知识库，让员工秒懂公司制度、流程和文档

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/vue-3.4-blue)](https://vuejs.org/)

---

## 📌 项目简介

### 解决什么问题？

- **痛点**：企业员工查找制度、流程文档耗时，信息分散在 Word、PDF、Markdown 中，难以快速检索
- **传统搜索**：关键词匹配，不理解语义，返回结果不精准
- **通用 AI**：直接回答容易产生"幻觉"，答案不一定符合企业实际

### 解决方案

本项目通过 **RAG（检索增强生成）** 技术，结合企业知识库和 AI 大模型，实现：
- 用自然语言提问，AI 基于真实文档精准回答
- 回答完全基于企业内部文档，避免编造
- 多轮对话理解上下文，支持追问

---

## ✨ 核心功能

### V4 版本亮点

| 功能 | 说明 |
|------|------|
| 🔍 **RAG 检索增强** | AI 只基于检索到的文档生成答案，避免幻觉 |
| 📊 **动态阈值算法** | 根据检索分数分布自动调整阈值，过滤无关文档 |
| 🧠 **强制推理** | 提示词工程强制 LLM 先分析后回答，提高准确性 |
| 🔄 **热更新机制** | 上传/删除文档实时生效，无需重启服务 |
| 💾 **持久化存储** | Qdrant 向量库，数据不丢失 |
| 📝 **对话记忆** | 多轮对话理解上下文，支持追问 |
| 🎨 **前端可视化** | Vue 3 聊天界面，美观易用 |
| ⚡ **增量更新** | 只处理变化的文档，节省 API 调用 |

### 功能对比

| 功能 | 传统搜索 | 通用 AI 问答 | 本项目 |
|------|:--------:|:------------:|:------:|
| 自然语言提问 | ❌ | ✅ | ✅ |
| 回答基于企业文档 | ❌ | ❌ | ✅ |
| 引用文档来源 | ❌ | ❌ | ✅ |
| 多轮对话理解 | ❌ | ✅ | ✅ |
| 热更新（无需重启） | ❌ | ❌ | ✅ |
| 分析过程可追溯 | ❌ | ❌ | ✅ |
| 动态阈值过滤 | ❌ | ❌ | ✅ |

---

## 🏗️ 技术架构

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Vue 3 + Element Plus + Vite | 现代化前端框架 |
| **后端** | Node.js + Express + TypeScript | 高性能 JavaScript 运行时 |
| **AI 能力** | 智谱 GLM-4 API + LangChain.js | 大模型 + 编排框架 |
| **向量数据库** | Qdrant | 高性能向量相似度检索 |
| **文档格式** | Markdown + Word (.docx) | 主流文档格式支持 |

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面（浏览器）                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Vue 3 前端应用                          │  │
│  │  • 智能问答区域（聊天界面）                             │  │
│  │  • 文档库侧边栏（上传/删除/列表）                       │  │
│  │  • 模式切换开关（仅知识库/允许外部）                     │  │
│  │  • 分析过程展示（可折叠/展开）                          │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │ HTTP POST / JSON              │
└───────────────────────────┼────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                    Node.js 后端服务                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Express API 路由                       │  │
│  │  POST /api/chat         - 智能问答                    │  │
│  │  GET  /api/docs         - 获取文档列表                 │  │
│  │  POST /api/docs/upload  - 上传文档（热更新）            │  │
│  │  DELETE /api/docs/:name - 删除文档（热删除）            │  │
│  │  GET  /api/health       - 健康检查                     │  │
│  └─────────────────────────┬────────────────────────────┘  │
│                             │                              │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │                   RAG Chain 处理逻辑                   │  │
│  │                                                       │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌──────────┐  │  │
│  │  │  检索层     │ →  │  提示词层   │ →  │  生成层  │  │  │
│  │  │  动态阈值   │    │  强制推理   │    │  GLM-4   │  │  │
│  │  │  混合检索   │    │  上下文注入 │    │  答案生成 │  │  │
│  │  └─────────────┘    └─────────────┘    └──────────┘  │  │
│  │                                                       │  │
│  │  对话记忆 ← 前端传递历史 → 注入 prompt                 │  │
│  └─────────────────────────┬────────────────────────────┘  │
│                            │                              │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │                   Qdrant 向量数据库                    │  │
│  │  • Collection: company_docs                          │  │
│  │  • 向量维度: 1024 (智谱 Embedding)                   │  │
│  │  • 检索算法: HNSW + 混合检索                         │  │
│  │  • 部署方式: Docker 容器化                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                              │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │                   智谱 AI API                          │  │
│  │  • GLM-4        - 对话生成与推理                      │  │
│  │  • Embedding-3 - 文本向量化                          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- Docker Desktop（用于运行 Qdrant 向量数据库）
- 智谱 AI API Key

### 安装步骤

#### 1. 克隆项目

```bash
git clone <your-repo-url>
cd aiTestLearning
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

创建 `.env` 文件：

```env
ZHIPU_API_KEY=your_zhipu_api_key_here
PORT=8081
```

> 获取智谱 API Key：https://open.bigmodel.cn/

#### 4. 启动 Qdrant 向量数据库

```bash
# 使用 Docker 启动 Qdrant（数据持久化到 ~/qdrant-data）
docker run -d -p 6333:6333 -v ~/qdrant-data:/qdrant/storage --name qdrant qdrant/qdrant
```

#### 5. 启动后端服务

```bash
npx tsx src/index.ts
```

#### 6. 启动前端（另一个终端）

```bash
cd frontend
npm install
npm run dev
```

#### 7. 访问应用

打开浏览器访问：http://localhost:5173

---

## 📂 项目结构

```
aiTestLearning/
├── .env                    # 环境变量（API Key 等）
├── package.json             # 后端依赖
├── .qdrant-state.json       # 向量库状态文件
│
├── src/                     # 后端源代码
│   ├── index.ts            # 后端入口（启动脚本）
│   ├── routes/
│   │   └── chat.ts         # API 路由（聊天、文档管理）
│   └── rag/
│       ├── loader.ts       # 文档加载器（MD/DOCX）
│       ├── splitter.ts     # 文档切分器
│       ├── store.ts        # Qdrant 向量存储
│       └── chain.ts        # RAG Chain（核心逻辑）
│
├── frontend/                # 前端源代码
│   ├── package.json        # 前端依赖
│   ├── vite.config.js      # Vite 配置
│   └── src/
│       ├── main.js         # Vue 入口
│       ├── App.vue         # 根组件
│       └── components/     # Vue 组件
│           ├── AppHeader.vue    # 顶部状态栏
│           ├── Sidebar.vue       # 文档库侧边栏
│           ├── ChatHeader.vue    # 聊天头部
│           ├── ChatMessages.vue  # 消息列表
│           ├── ChatInput.vue     # 输入框
│           └── UploadModal.vue   # 上传弹窗
│
├── data/                    # 知识库文档目录
│   ├── sample.md           # 示例文档
│   └── 公司管理制度手册.docx
│
├── scripts/                 # 工具脚本
│   └── generate-docx.ts    # 生成 Word 文档
│
├── docs/                   # 文档目录
│   └── README.md           # 项目文档
│
├── reports/                 # 学习报告
│   └── learning-report-v2.md
│
└── rag-learning-report/     # RAG 学习报告（HTML）
    ├── rag-learning-report.html   # V1-V2 报告
    ├── rag-learning-report2.html  # V3 报告
    ├── rag-learning-report3.html  # 进阶报告
    └── rag-learning-report4.html  # V4 报告
```

---

## 🔬 核心概念详解

### 1. RAG（检索增强生成）

**问题**：大模型容易产生"幻觉"，回答企业内部知识时可能不准确。

**解决方案**：
```
用户问题 → 检索相关文档 → 拼入 prompt → LLM 生成答案
                    ↓
           只用检索到的内容回答
```

**效果**：答案完全基于企业文档，避免编造。

---

### 2. 动态阈值算法

**问题**：固定阈值（如 0.25）无法适应不同质量的文档。

**解决方案**：根据检索分数的统计分布动态计算阈值。

```typescript
// 基于标准差的自适应阈值
function calculateDynamicThreshold(scores: number[]): number {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  
  // 计算标准差
  const variance = scores.reduce((sum, score) => 
    sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  
  // 动态阈值 = 基础阈值 + 标准差调节
  let dynamicThreshold = 0.25 + stdDev * 1.5;
  
  // 约束：不超过最高分的 95%
  dynamicThreshold = Math.min(dynamicThreshold, maxScore * 0.95);
  
  return Math.max(0.2, Math.min(0.6, dynamicThreshold));
}
```

**效果**：
- 标准差大 → 提高阈值 → 只保留高分文档
- 标准差小 → 降低阈值 → 保留更多文档

---

### 3. 强制推理

**问题**：LLM 有时会"偷懒"，直接给出看似合理但未经分析的回答。

**解决方案**：通过提示词工程，强制 LLM 先展示分析思路。

```typescript
const PROMPT = `
【分析过程】
1. 用户问题中的关键条件：{提取关键信息}
2. 参考信息中的相关内容：{列出相关条款}
3. 逻辑判断：{说明如何匹配}

【最终答案】
{直接给出答案}
`;
```

**效果**：让 LLM 完成"自我检查"，提高答案准确性。

---

### 4. 对话记忆

**问题**：每次对话独立，无法理解上下文（如"那入职3年呢？"）。

**解决方案**：前端传递历史对话，后端注入 prompt。

```typescript
// 前端：构建 history 数组
const history = chatHistory.value.slice(0, -1).map(msg => ({
  role: msg.type === 'user' ? 'user' : 'assistant',
  content: msg.content
}));

// 后端：注入到 prompt
if (history.length > 0) {
  prompt = `【对话历史】\n${historyText}\n\n` + prompt;
}
```

**效果**：
- "年假有几天？" → "入职满1年有5天年假"
- "那入职3年呢？" → "入职3年仍享有5天年假"（理解上下文）

---

### 5. 热更新机制

**问题**：传统知识库需要重启服务才能更新文档。

**解决方案**：上传/删除时，实时更新向量库。

```
上传文档 → 立即向量化 → 存入 Qdrant → AI 立即可用
删除文档 → 从 Qdrant 移除 → 立即生效
```

**效果**：用户操作即时生效，无需运维干预。

---

## 📈 版本演进

| 版本 | 时间 | 主要特性 |
|------|------|---------|
| **V1** | 初期 | MemoryVectorStore，纯内存，重启丢失 |
| **V2** | 中期 | Qdrant 持久化，磁盘存储 |
| **V3** | 后期 | 增量更新 + 混合检索 + 直接操作 Qdrant |
| **V4** | 当前 | 前端可视化 + 动态阈值 + 强制推理 |
| **V5** | 进行中 | 对话记忆 + 多用户隔离 |

### V1 vs V4 对比

| 维度 | V1 | V4 |
|------|:--:|:--:|
| 向量存储 | 内存 | Qdrant 持久化 |
| 增量更新 | ❌ | ✅ |
| 混合检索 | ❌ | ✅ |
| 动态阈值 | ❌ | ✅ |
| 强制推理 | ❌ | ✅ |
| 前端界面 | ❌ | Vue 3 完整界面 |
| 热更新 | ❌ | ✅ |
| 对话记忆 | ❌ | ✅ |

---

## 🎨 使用示例

### 场景1：新员工入职

```
👤 用户：年假有几天？
🤖 AI：【分析过程】
     1. 关键条件：询问年假天数
     2. 相关条款：根据公司请假制度...
     3. 逻辑判断：入职满1年...

     【最终答案】
     根据公司请假制度，入职满1年享有5天年假...

📄 参考文档：公司管理制度手册.docx
```

```
👤 用户：那入职3年呢？
🤖 AI：【分析过程】
     1. 关键条件：入职3年，年假天数
     2. 相关条款：...
     3. 逻辑判断：3年落在"1-5年"区间

     【最终答案】
     入职3年仍享有5天年假（需满5年才增至10天）
```

### 场景2：流程咨询

```
👤 用户：项目立项需要哪些材料？
🤖 AI：根据项目管理文档，立项需提交：
     1. 项目需求文档
     2. 可行性分析报告
     3. 资源评估表
     ...
```

---

## 🔧 配置说明

### 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|:----:|------|------|
| `ZHIPU_API_KEY` | ✅ | 智谱 AI API Key | `1234567890abcdef...` |
| `PORT` | ❌ | 后端服务端口 | `8081`（默认） |

### 文档格式

支持两种格式：

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| Markdown | `.md` | 纯文本，推荐 |
| Word | `.docx` | 支持表格、图片 |

### 向量库配置

- **Collection 名称**：`company_docs`
- **向量维度**：1024（智谱 Embedding 标准）
- **检索算法**：HNSW
- **数据目录**：`~/qdrant-data`（持久化）

---

## 🛠️ 开发指南

### 添加新文档

1. 将 `.md` 或 `.docx` 文件放入 `data/` 目录
2. 系统自动检测并向量化
3. 或使用前端界面上传（热更新）

### 修改提示词

编辑 `src/rag/chain.ts` 中的 `buildPrompt` 函数。

### 添加新功能

1. 前端组件：`frontend/src/components/`
2. 后端路由：`src/routes/chat.ts`
3. RAG 逻辑：`src/rag/chain.ts`

---

## 📖 学习资源

### 项目演进报告

详细的项目开发历程和学习笔记：

| 报告 | 内容 |
|------|------|
| [rag-learning-report.html](rag-learning-report/rag-learning-report.html) | V1-V2 基础：内存向量库 → Qdrant |
| [rag-learning-report2.html](rag-learning-report/rag-learning-report2.html) | V3 进阶：增量更新 + 混合检索 |
| [rag-learning-report3.html](rag-learning-report/rag-learning-report3.html) | 深入：RAG 核心原理 |
| [rag-learning-report4.html](rag-learning-report/rag-learning-report4.html) | V4 最终：前端可视化 + 精确性增强 |
| [learning-report-v2.md](reports/learning-report-v2.md) | Markdown 格式版本 |

### 相关文档

- [智谱 AI 文档](https://open.bigmodel.cn/)
- [LangChain.js 文档](https://js.langchain.com/)
- [Qdrant 文档](https://qdrant.tech/documentation/)
- [Vue 3 文档](https://vuejs.org/)

---

## 🚢 部署

### Docker Compose（推荐）

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "8081:8081"
    environment:
      - ZHIPU_API_KEY=${ZHIPU_API_KEY}
    depends_on:
      - qdrant

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant-data:/qdrant/storage

volumes:
  qdrant-data:
```

### 前端构建

```bash
cd frontend
npm run build
# 输出到 dist/ 目录
```

---

## 📝 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [智谱 AI](https://open.bigmodel.cn/) - 提供 GLM-4 大模型和 Embedding API
- [LangChain.js](https://js.langchain.com/) - LLM 应用编排框架
- [Qdrant](https://qdrant.tech/) - 高性能向量数据库
- [Vue.js](https://vuejs.org/) - 渐进式前端框架
- [Element Plus](https://element-plus.org/) - Vue 3 UI 组件库

---

## 📧 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。
