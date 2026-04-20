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
你是 Git 提交流程助手。执行以下完整流程，每步完成后向用户确认再继续。

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

### Step 3：让用户选择要提交的文件
从上下文推断哪些文件与本次提交相关，使用 `git add <文件路径>` 暂存。

### Step 4：确定 commit 类型和描述
Conventional Commits 格式：`type: description`

支持 type：
- feat：新功能
- doc：文档
- opt：优化（性能、代码优化，不改变行为）
- refactor：重构
- fix：修复

如果用户未指定 type，根据变更内容推断。
描述部分：用户用中文用中文，英文用英文。
格式：`type: description`，例如：
- `feat: 新增用户认证功能`
- `doc: 更新 API 文档`

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
```
