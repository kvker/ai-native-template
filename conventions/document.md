# 文档编写规范

## 基本原则

1. 结构化优先：机器状态写入 JSON 契约，说明和证据写入 Markdown。
2. 状态显式：任务生命周期以 `artifact.json` 为准，Review 结论以 `review/review.json` 为准。
3. 路由分离：索引以路由和必要约束为主，详细内容存具体文件。

## 状态

| 生命周期值 | 中文显示 | 可选符号 |
|------------|----------|----------|
| `pending` | 待处理 | - |
| `in_progress` | 进行中 | `🚧` |
| `paused` | 暂停 | `⏸️` |
| `completed` | 完成 | `✅` |
| `cancelled` | 取消 | `❌` |
| `archived` | 已归档 | - |

符号仅用于面向人的展示，不作为脚本判断依据。`PASS`、`REVIEW`、`BLOCKED` 是 Review 结论，不是任务生命周期状态。

## 文件命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 索引 | AGENTS.md | AGENTS.md |
| 规范 | 小写-连字符.md | flow-policy.md |
| 任务 | task.md（多任务时 task-001.md） | task.md |
| 机器状态 | 固定契约文件名 | artifact.json、review.json、index.json |

## 路由规范

索引文件以路由和必要约束为主，不复制被索引文件的正文。按需访问，避免上下文膨胀：`[name](path/to/file)`。

## 语言

- 正文：中文
- 工作区内容：遵循对应工作区的现有约定
- 专有名词、命令和协议字段：必要时保留原文，面向用户的说明尽量使用中文
