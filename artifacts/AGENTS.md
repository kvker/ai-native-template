# artifacts 目录说明

`artifacts/` 保存任务状态、上下文、决策和检查证据。实际交付物写入 `projects/` 或用户指定位置，Artifact 只保存引用。

活跃 Artifact 的唯一索引是 `artifacts/index.json`。每个需要留痕的任务使用独立目录，命名为 `YYYYMMDD__task-name`，日期使用 UTC；`task-name` 只使用小写字母、数字和连字符，同日重名时追加稳定短后缀。

## 约定结构

```text
artifacts/{YYYYMMDD}__{task-name}/
├── artifact.json
├── AGENTS.md                 # 可选任务路由
├── raw/
├── requirements/
├── design/
├── spec/
├── execution/
├── review/
└── archive/
```

阶段目录按任务需要创建，不生成空目录。机器契约文件名固定：`artifact.json`、`requirements/requirements.md`、`review/review.json`、`archive/summary.md`；其他叙述文档可以按任务需要命名。字段和门禁见 [workflow](../conventions/workflow.md)。

## AI 行为

- 新建需要留痕的任务时创建 `artifact.json`，并将 `id`、`path`、`status`、`updatedAt` 登记到 `artifacts/index.json`。
- Artifact 的 `status` 是生命周期事实源；索引状态必须与其保持一致。
- 原始材料优先记录来源路径。只有任务需要独立快照且不包含敏感信息时才复制，禁止持久化凭据、隐私数据和无必要的大文件。
- 每个 Artifact 可包含自己的 `AGENTS.md`，但只记录任务路由和必要约束，不复制状态或 Review 结论。
- Review 结果写入 `review/review.json`；Markdown 报告只用于阅读，不参与脚本门禁。
- 成功或取消归档后将 Artifact 移到 `artifacts/_archived/`，并从 `artifacts/index.json` 移除。
- 已归档 Artifact 保持只读；继续历史任务时创建新 Artifact，并使用稳定 ID 建立引用。
