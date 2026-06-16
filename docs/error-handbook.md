---
name: "error-handbook"
description: "错误处理手册，记录项目常见问题和解决方案。Invoke when user encounters errors, asks for troubleshooting help, or wants to add new error solutions to the handbook."
---

# 错误处理手册

项目长期维护的错误记录和解决方案。

## 使用方法

### 查询已知错误
当遇到错误时，先在这里查找是否有记录：
- 查看下方「错误记录」列表
- 每个错误包含：问题描述、错误信息、症状、解决方案

### 添加新错误
遇到新错误并解决后：
1. 描述问题现象
2. 记录错误信息（截图或文字）
3. 记录解决方案
4. 联系 AI 助手添加到本手册

---

## 错误记录

### 错误 #001: Docker Desktop 重装后无法启动（WSL 网络配置损坏）

**日期**: 2026-06-16

**严重程度**: 🔴 高（阻塞工作）

**问题描述**:
Docker Desktop 卸载后重新安装，打开时立即报错，无法进入主界面。点击 "Reset to factory defaults" 重置后仍然报错。

**错误代码**: `0x8007273f`

**错误截图**:
> 待添加：Docker Desktop 错误截图

**症状**:
- Docker Desktop 启动时立即弹出错误对话框
- 错误信息包含 `WSL network configuration is corrupted`
- 错误代码 `0x8007273f`
- 重置功能无效

**根本原因**:
WSL 虚拟网络适配器或网络配置损坏，通常由以下原因引起：
- Docker Desktop 卸载/重装过程中配置未正确清理
- WSL 虚拟交换机配置冲突
- Windows 网络栈状态异常

**解决方案**:

```powershell
# 步骤 1: 停止 WSL
wsl --shutdown

# 步骤 2: 重置 Windows 网络栈
netsh winsock reset
netsh int ip reset

# 步骤 3: 重启电脑（必须）
Restart-Computer
```

**验证**:
```powershell
# 重启后执行
wsl -d Ubuntu-22.04
# 应该能正常进入 Ubuntu

# 然后启动 Docker Desktop
# 应该能正常打开
```

**状态**: ✅ 已解决

---

## 待记录的错误

| # | 日期 | 问题 | 状态 |
|---|------|------|------|
| 001 | 2026-06-16 | Docker Desktop 重装后无法启动 | ✅ 已解决 |

---

## 相关文档

- 项目主文档: [README.md](../README.md)
- AI Agent 项目: [aiTestLearning](../aiTestLearning/)

---

*最后更新: 2026-06-16*
