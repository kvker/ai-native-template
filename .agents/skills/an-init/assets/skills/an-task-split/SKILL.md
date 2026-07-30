---
name: an-task-split
description: 将过大的 AI Native 任务拆成多个目标清晰、可独立 Review 的子任务，并生成每个子任务的 raw 和 requirements。用户要求拆分、分解或规划大任务时使用。
---

# AI Native 任务拆分

拆分本身也是一个任务，遵循唯一标准工作流：

```text
raw → requirements → design → spec → execution → review → archive
```

拆分的目标是形成可独立执行、检查和归档的子任务，而不是按固定行业模块切割。如果原任务已经足够小，应停止拆分并建议直接使用 `/an-task`。

## raw

将原始大任务保存到父 Artifact 的 `raw/task.md`，不改写用户输入。

## requirements

将整体目标、范围、约束和完成标准保存到 `requirements/requirements.md`。完成标准使用稳定 ID，并至少覆盖：

- 子任务共同覆盖原任务范围。
- 每个子任务可以独立判断完成状态。
- 依赖和执行顺序明确。
- 每份子任务 requirements 不超过 200 行。

## design

从目标边界、产出边界、依赖关系、风险和可独立检查性识别拆分方式，将方案和取舍保存到 `design/design.md`。

默认由 AI 自主选择拆分方案。只有边界依赖关键业务语义、高风险选择或外部授权时才暂停确认。

## spec

将最终拆分定义保存到 `spec/split-plan.md`：

```markdown
# 拆分规范

## 子任务
| 子任务 | 目标 | 核心完成标准 | 依赖 | Artifact |
|--------|------|--------------|------|----------|
| ... | ... | ... | ... | ... |

## 创建清单
- [ ] 创建每个子任务的 raw
- [ ] 创建每个子任务的 requirements
- [ ] 写入父任务和依赖引用
- [ ] 更新根活跃 Artifacts 索引

## 执行顺序
...
```

## execution

按照 spec 执行拆分：

1. 为每个子任务创建独立 Artifact。
2. 写入 `raw/task.md`，保留父任务和拆分规范的引用。
3. 写入 `requirements/requirements.md`，包含稳定 ID 的完成标准。
4. 更新根 `AGENTS.md` 的活跃 Artifacts 表。
5. 将子任务初始状态标记为“待处理”，不要用“进行中”表示尚未启动。
6. 将实际创建结果记录到父任务的 `execution/summary.md`。

## review

在父任务的 `review/review-report.md` 中逐项核对：

- 每个 spec 中定义的子任务都已创建。
- raw、requirements、父任务引用和依赖信息完整。
- 子任务 requirements 没有超过 200 行。
- 根活跃 Artifacts 索引与实际目录一致。

结论为 `PASS`、`REVIEW` 或 `BLOCKED`。缺少子任务、要求或索引时不得判定 PASS。

## archive

父拆分任务 Review 为 PASS 后，生成 `archive/summary.md` 并归档父 Artifact。子任务保留在活跃列表中，后续分别使用 `/an-task` 推进。

Review 为 REVIEW 时只有用户明确接受剩余项后才归档；BLOCKED 不得归档。
