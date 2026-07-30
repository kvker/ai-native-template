---
name: an-task
description: 根据任务目标、范围、风险和不确定性选择 L0 直接处理、L1 快速执行、L2 标准执行或 L3 完整流程，并推进到实际产出、Review 和归档。适用于开发、写作、研究、分析、设计、整理、配置等任意需要 AI 执行的工作。小任务不要机械创建 Artifact。
---

# AI Native 任务执行

使用最轻但足够安全的流程完成实际工作。标准工作流以 `conventions/workflow.md` 为唯一权威定义：

```text
raw → requirements → design → spec → execution → review → archive
```

## 第一步：流程分级

先根据 `conventions/flow-policy.md` 自主判断等级，并用一句话向用户说明等级和理由。

| 等级 | 行为 |
|------|------|
| L0 | 不创建 Artifact；直接执行、检查并总结 |
| L1 | 默认不创建 Artifact；执行并检查，必要时保留轻量记录 |
| L2 | 创建 Artifact；保留 raw、requirements、spec、execution、review，design 可作为 requirements 文档中的独立章节 |
| L3 | 创建 Artifact；按全部阶段推进 |

不要让用户选择流程等级、方案或检查动作。只有目标无法判断、完成标准不自洽、高风险边界、不可逆操作或外部授权时才暂停确认。调查中发现风险升高时立即升级等级。

## 输入来源

用户可以直接描述任务，也可以提供文件、目录或链接。将未加工的用户内容视为 raw；只有 L2/L3 或确有留痕需要时才保存到 Artifact。

仅当用户明确提到继续、恢复、上次或之前的任务时，才先按目录名搜索 `artifacts/` 和 `artifacts/_archived/`。匹配后询问是继续该任务还是仅作参考；确认后再读取内容。

## L0/L1

L0：

1. 定位需要处理的材料。
2. 做最小正确修改或产出。
3. 采用适合当前任务的最小检查方式。
4. 总结产出、检查结果和剩余风险。

L1 在此基础上，只有需要恢复、追踪或后续扩展时才创建轻量 Artifact：

```text
artifacts/{YYYYMMDD}__{task-name}/
├── raw/task.md
├── execution/summary.md
└── review/review-report.md
```

## L2/L3 通用规则

1. 创建 `artifacts/{YYYYMMDD}__{task-name}/`，同步登记到根 `AGENTS.md` 的活跃 Artifacts 表。
2. 阶段目录按需要创建，不创建空目录占位。
3. 每阶段结束后更新任务索引，向用户说明关键产出、决策、理由和风险；未触发暂停条件时直接继续。
4. 实际工作材料和交付物写入 `projects/` 或用户指定位置；Artifact 保存上下文、过程、证据和引用。
5. 不假定工作类型、文件格式、工具或检查方式。先读取实际材料和现有约定。
6. 用户可随时暂停、回退或修改前序结果；后续阶段必须同步评估并更新。

## L2/L3 背景读取

L2/L3 在提炼需求前，只前置读取以下背景入口：

```text
background/AGENTS.md
background/product/overview.md
```

技术架构、领域模型和功能状态没有固定的单文件路径。读取 `background/AGENTS.md` 后，根据仓库中实际存在的 background 文档选择相关内容。不得假设 `background/` 下存在未列出的文件。

## raw

将用户提供的原始内容、材料和来源原样保存到 `raw/`，不改写、不补充推断。引用本地材料时优先记录来源路径；只有任务需要独立快照时才复制。

默认产出：`raw/task.md`。

## requirements

从 raw 和相关背景中提炼：

- 背景与目标
- 完成标准
- 范围和不包含项
- 约束与依赖
- 开放问题

完成标准必须可通过检查、审阅、观察或明确确认来判断。无法从材料确定的内容标记为待确认，不得编造。

每项完成标准使用稳定 ID，例如：

```markdown
## 完成标准
- [ ] AC-1: ...
- [ ] AC-2: ...
```

默认产出：`requirements/requirements.md`。

## design

决定达到目标的方案、结构和关键取舍，不写具体执行流水。AI 自主比较可行方案并选择最符合现有材料、约定和最小风险的方案。

记录最终方案、关键决策、未选方案、理由和风险。只有决策依赖用户专属偏好、外部授权或高风险边界时才暂停。

默认产出：`design/design.md`。

## spec

将 design 转成可执行规范，至少包括：

- 执行步骤或变更清单
- 影响位置或目标材料
- 产出要求
- 需要遵循的约束
- Review 计划

L2 可以在同一文档中简要记录 requirements 和 design，但必须保持“目标”与“方案”语义清晰。

默认产出：`spec/spec.md`。

## execution

按 spec 完成实际工作。需要第三方知识时优先查阅工作区已有资料和官方来源，不得杜撰。遇到 spec 未覆盖但 AI 可以判断的问题，自主处理并记录理由；影响目标或风险边界时回退更新前序阶段。

默认记录：`execution/summary.md`，包含实际产出位置、执行摘要、偏离 spec 的事项和补充决策。

## review

按照 requirements 的完成标准和 spec 的 Review 计划检查实际产出：

1. 优先从 `.agents/recipes.json` 选择动作；不存在或不适用时，根据材料采用合适的检查方式。
2. 检查可以是命令、材料核对、内容审阅、结果预览或用户确认。
3. 发现可修复问题时先自行修复并重新检查。
4. 根据检查证据更新 requirements 中完成标准的复选状态。
5. 记录每项完成标准、检查方式、结果和证据。
6. 给出 `PASS`、`REVIEW` 或 `BLOCKED` 结论。

默认产出：`review/review-report.md`。

```markdown
# Review 报告

## 完成标准
| ID | 完成标准 | 检查方式 | 结果 | 证据 |
|----|----------|----------|------|------|
| AC-1 | ... | ... | 通过/待复核/未通过 | ... |

## 问题处理
- 无

## 未解决事项
- 无

## 结论
PASS
```

`PASS` 表示可以归档；`REVIEW` 需要用户明确接受复核项；`BLOCKED` 必须继续处理，不得归档。

## archive

满足门禁后：

1. 在 `archive/summary.md` 记录任务目标、最终产出位置、Review 结论、剩余限制和完结时间。
2. 将任务状态更新为完成。
3. 根据 `background/AGENTS.md` 的路由，更新当前仓库实际存在的功能状态背景文档；如果没有对应文件，记录为待补充，不要创建或引用虚构路径。
4. 使用 `/an-archive` 将整个 Artifact 移到 `artifacts/_archived/`。
5. 从根 `AGENTS.md` 的活跃 Artifacts 表移除。

L2/L3 默认推进到归档；用户明确要求暂不归档时保留为已完成状态。

## 异常处理

| 情况 | 处理 |
|------|------|
| 用户修改前序结果 | 回到对应阶段，更新受影响的后续记录 |
| 用户要求跳过阶段 | 可以压缩低风险阶段，但说明缺失信息和风险 |
| 用户暂停 | 保存当前状态和下一步到 Artifact 索引 |
| Review 失败 | 修复后重新 Review；无法继续时保持 BLOCKED |
| 无法执行检查 | 记录原因、替代证据和剩余风险，不得伪造通过结果 |
