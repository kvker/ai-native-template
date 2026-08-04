# 工作流规范

> 本文件是阶段含义、Artifact 状态、Review 结论和归档门禁的最高优先级定义。其他文档可以提供操作示例，但不得增删字段或改变语义；冲突时以本文件为准。

## 标准工作流

```text
raw → requirements → design → spec → execution → review → archive
```

该流程描述任务上下文从原始材料到完结归档的变化，不预设任务所属领域。L0-L3 只控制阶段展开程度和记录量，选择规则见 [flow-policy](flow-policy.md)。

| 阶段 | 通用含义 | 核心问题 |
|------|----------|----------|
| raw | 原始内容、材料和来源 | 用户实际提供了什么？ |
| requirements | 目标、范围、约束和完成标准 | 什么结果才算完成？ |
| design | 方案、结构、关键决策和取舍 | 准备怎样达到目标？ |
| spec | 可执行规则、步骤和产出要求 | 具体按什么约束执行？ |
| execution | 实际工作过程与产出记录 | 实际完成了什么？ |
| review | 检查产出、处理问题并给出结论 | 结果是否满足完成标准？ |
| archive | 标记完结并归档任务上下文 | 是否可以结束本任务？ |

轻量任务可以合并相邻阶段，但不得混淆目标和方案，也不得跳过必要检查。L0 不创建 Artifact；L1 默认不创建，确需恢复或追踪时创建；L2/L3 必须创建。

## Artifact 机器契约

Artifact ID 使用 UTC 日期：`YYYYMMDD__task-name`。`task-name` 只含小写字母、数字和连字符；同日同名时追加由任务原始目标生成的稳定短摘要。

需要 Artifact 时，以下文件名固定：

| 文件 | 用途 |
|------|------|
| `artifacts/index.json` | 活跃 Artifact 的唯一索引 |
| `{artifact}/artifact.json` | 流程等级、生命周期、父任务和交付物引用 |
| `{artifact}/requirements/requirements.md` | L2/L3 完成标准的门禁输入 |
| `{artifact}/review/review.json` | Review 结论、逐项证据和接受记录 |
| `{artifact}/archive/summary.md` | 完结或取消摘要 |

其他阶段文档可以按任务需要命名；“文件名不固定”不适用于上述机器契约。实际交付物写入 `projects/` 或用户指定位置，Artifact 只保存任务上下文、证据和引用。

`artifact.json` 最低结构：

```json
{
  "schemaVersion": 1,
  "id": "20260804__example",
  "flowLevel": "L2",
  "status": "in_progress",
  "outcome": null,
  "createdAt": "2026-08-04T00:00:00Z",
  "updatedAt": "2026-08-04T00:00:00Z",
  "parentArtifactId": null,
  "deliverables": [
    { "kind": "deliverable", "path": "projects/result.md", "description": "实际交付物说明" }
  ]
}
```

`status` 只能是 `pending`、`in_progress`、`paused`、`completed`、`cancelled`、`archived`。活跃 Artifact 的 `outcome` 必须为 `null`；归档后必须是 `completed` 或 `cancelled`。`deliverables` 每项必须包含 `kind`、`path` 和面向人的 `description`。`kind: deliverable` 表示实际产出；`kind: artifact-reference` 仅用于拆分、编排等任务，把所创建的子 Artifact 作为该任务的交付结果。普通过程文档不得伪装成交付物。

`artifacts/index.json` 的 `active` 数组只登记尚未移入 `_archived/` 的 Artifact；每项必须包含 `id`、`path`、`status` 和 `updatedAt`。`path` 使用从工作区根开始的 POSIX 相对路径，例如 `artifacts/20260804__example`；`status` 和 `updatedAt` 必须与 `artifact.json` 完全一致。Artifact 自身状态是事实源，索引只是可重建路由。

## Review 机器契约

`review/review.json` 最低结构：

```json
{
  "schemaVersion": 1,
  "reviewedAt": "2026-08-04T00:00:00Z",
  "conclusion": "PASS",
  "criteria": [
    {
      "id": "AC-1",
      "description": "完成标准原文或 L1 轻量检查标准",
      "status": "PASS",
      "method": "检查方式",
      "evidence": ["证据或路径"]
    }
  ],
  "unresolved": [],
  "acceptance": null
}
```

Review 结论只有三种：

| 结论 | 含义 | 后续动作 |
|------|------|----------|
| `PASS` | 完成标准均有充分证据 | 将 Artifact 标为 `completed` 后可归档 |
| `REVIEW` | 仍需指定责任方复核 | 用户明确接受并写入 `acceptance` 后，由事务归档脚本从活跃状态直接归档 |
| `BLOCKED` | 存在失败、关键证据缺失或未解决问题 | 保持活跃，继续处理并重新 Review |

每个 criteria 项必须包含 `id`、`description`、`status`、`method` 和非空 `evidence`；`status` 只使用 `PASS`、`REVIEW`、`BLOCKED`。L2/L3 的 description 应对应 requirements 原文，L1 则在这里直接定义轻量检查标准。`PASS` 要求全部完成标准 ID 唯一且逐项覆盖、方法与证据非空、没有 `REVIEW` 或 `BLOCKED` 项、`unresolved` 为空。

`REVIEW` 被接受时，`acceptance` 必须记录 `accepted: true`、`acceptedAt`、`source`、`items` 和当前 `reviewDigest`。`acceptedAt` 不得早于 `reviewedAt`；Review 内容变化会改变摘要并使旧接受失效。不得仅凭聊天上下文推断已经接受。

Markdown Review 报告可以保留给人阅读，但不参与脚本门禁，避免示例、代码块、标题或表格转义改变结论。

## 生命周期与归档

```text
pending → in_progress ↔ paused
in_progress/paused → completed
completed → in_progress            # 返工并重新 Review
pending/in_progress/paused → cancelled
completed/accepted-review/cancelled → archived
```

- PASS 归档：Artifact 必须为 `completed`。
- REVIEW 归档：Artifact 保持 `in_progress` 或 `paused`；写入与当前 Review 摘要匹配的接受记录后，由事务脚本直接归档。
- 恢复暂停任务时先改为 `in_progress` 并同步索引；已完成任务返工时也回到 `in_progress`，清除旧 acceptance 并重新 Review。
- 取消归档：Artifact 必须为 `cancelled`，不要求 Review，但 `archive/summary.md` 必须记录取消原因和未完成范围。
- 归档统一运行 `$an-archive` 的事务脚本；脚本将状态改为 `archived`、写入 `outcome`、移动目录并原子更新 `artifacts/index.json`。
- 已归档 Artifact 不原地恢复；继续历史任务时创建新 Artifact，并用 `parentArtifactId` 或引用字段关联。

## 检查点

AI 自主选择流程等级、方案、检查动作和执行顺序。只有目标无法判断、完成标准不自洽、关键业务语义缺失、高风险边界、不可逆操作或外部授权时才暂停确认。

L2 展示 spec 的执行清单和检查计划后默认继续；L3 展示 requirements、design、spec 和 review 的关键结论，但同样只在上述暂停条件成立时等待确认。

## 可执行动作清单

检查动作优先从 `.agents/recipes.json` 读取。文件不存在或工作区内容、工具、约定发生变化时，运行 `$an-recipes` 重新生成。Recipes 可以记录命令，也可以记录审阅、核对、预览等非命令动作；每次只选择覆盖当前风险的最小集合。
