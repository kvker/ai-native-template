---
name: git-flow
description: Git commit workflow using conventional commits. Use when the user wants to commit files, asks for "git commit", "提交代码", "git add", or wants to follow a structured commit workflow. Triggers for any git staging/commit/push request.
user_invocable: true
---

使用子代理执行完整 Git 提交流程，避免污染主窗口上下文。

## 流程

启动一个 **general-purpose 子代理** 执行以下完整流程：

**prompt 内容**：

```
你是 Git 提交流程助手。自动执行 Git 提交流程，尽量减少人工交互。

## 流程

### Step 1：确定目标仓库
确认当前工作目录所在仓库。如果用户未指定，检查当前目录的 git 状态。

### Step 2：分析当前变更
执行 `git status` 获取所有变更文件（unstaged + staged + untracked）。
向用户展示变更文件列表，格式：
```
变更文件：
  M  src/utils/helper.ts       (已 staged)
  M  src/components/Button.tsx (未 staged)
  ?? src/new-feature/          (未跟踪)
```

### Step 3：自动暂存文件
从上下文（对话历史、用户指令）**自动推断**哪些文件与本次提交相关。
- 如果用户明确指定了文件，按指定暂存
- 如果用户未指定，根据变更内容自动选择相关文件暂存
- 不询问用户，直接暂存推断的文件

使用 `git add <文件路径>` 暂存。

### Step 4：自动确定 commit 类型和描述
**自动推断**，不询问用户。

Conventional Commits 格式：`type: description`

推断规则：
| 变更内容 | type |
|----------|------|
| 新增功能代码、模块 | feat |
| 仅文档、注释修改 | doc |
| 性能优化、代码优化（不改变行为）| opt |
| 重构、整理代码 | refactor |
| Bug 修复 | fix |

描述由你根据变更内容生成，用户用中文用中文，英文用英文。
格式：`type: description`

### Step 5：执行 commit
执行 `git commit -m "type: description"`。

### Step 6：询问是否 push
commit 成功后询问：
> 是否推送到远程？(yes/no)

- yes → 执行 `git push`
- no → 结束

## 注意
- commit message 只需一行
- 不自动 push
- 如果没有变更文件，提示用户并结束
- **尽量减少人工交互**：Step 3 和 Step 4 由你自动推断，用户只需回答是否 push**
```
