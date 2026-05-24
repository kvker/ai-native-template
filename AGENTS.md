# AGENTS.md

该项目是 AI Native 工程，即 AI 直接使用的工程项目。

本文件是 AI 索引入口文件，存放精简且极度重要的信息以及其他关键信息的路由。

> **缩写说明**：对话中出现的 "AN" 一般指 AI Native 的缩写。

## 项目背景

{执行 `/an-init` 后自动生成}

## 工程结构

| 目录 | 用途 | AI 行为 |
|------|------|---------|
| [background](background/) | 静态背景知识 | 只读，了解领域知识 |
| [conventions](conventions/) | 项目约定规范、对话长期规则与优化记录 | 开始任务前按需读取；对话过程中自动感知并按需写入 |
| [artifacts](artifacts/) | 任务产出目录 | 频繁读写，跟踪任务产出 |
| [projects](projects/) | 实际工程项目 | 实现阶段才访问，每个子目录为一个独立工程 |

## 约定

索引文件只存放路由，不存放内容：`[name](path/to/file)`

## AI 行为约束

- 禁止自行脑补未提及的需求、功能或业务逻辑。
- 所有背景知识必须来自代码事实或用户明确输入。
- 从代码反推的信息要标注来源；无法确认的信息标记为"待确认"。
- 不主动读取或输出 `.env`、`secrets/`、credentials、密钥、token 等敏感文件；除非用户明确授权且任务必要。

## 必读规范

开始任务前按需读取以下规范：

| 规范 | 用途 |
|------|------|
| [principles](conventions/principles.md) | AI Native 核心原则 |
| [workflow](conventions/workflow.md) | 标准工作流 |
| [flow-policy](conventions/flow-policy.md) | 流程轻重判断 |
| [document](conventions/document.md) | 文档编写规范 |
| [rules](conventions/rules.md) | 对话过程中的长期记忆感知与沉淀 |
| [memories](conventions/memories/AGENTS.md) | 对话优化记录索引 |

## 当前活跃 Artifacts

开发过程中按需创建，每个功能在 `artifacts/{feature}/` 下独立管理。

| Artifact | 描述 | 状态 |
|----------|------|------|
| - | - | - |

## Skill 路由

| 意图 | 推荐技能 |
|------|----------|
| 将已有项目迁入 AI Native 结构 | `/an-init` |
| 开始一个功能、修复、重构或文档任务 | `/an-task` |
| 拆分大型需求或长任务 | `/an-task-split` |
| 探测或刷新测试、构建、代码检查、生成命令 | `/an-recipes` |
| 根据代码和已完成任务刷新背景知识 | `/an-refresh` |
| 评价任务是否真的完成 | `/an-eval` |
| 归档已完成的任务产出 | `/an-archive` |
