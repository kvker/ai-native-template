# 工作流规范

## 标准工作流

raw-input → requirements → design → tech-spec → implementation → testing → deployment

> 小修复可咨询用户后跳过流程。

阶段名称已固化，但含义泛化，适用于各类 AI 协作任务：

| 阶段 | 通用含义 | 代码任务示例 | 文档任务示例 | 设计任务示例 |
|------|----------|--------------|--------------|--------------|
| raw-input | 原始输入 | issue / 需求描述 | 原始笔记 / 素材 | 需求简报 |
| requirements | 提炼需求与验收标准 | 功能需求、AC | 文档目标、读者 | 设计目标、受众 |
| design | 方案设计 | 技术选型、架构决策 | 结构、大纲、风格 | 视觉/交互方案 |
| tech-spec | 执行规范 | 数据模型、API 契约、变更清单 | 章节清单、写作规范 | 资源清单、交付规范 |
| implementation | 执行/产出 | 写代码、改配置 | 撰写内容 | 产出稿、切图 |
| testing | 验证 | 测试、类型检查、代码审查 | 审校、核对、可读性检查 | 走查、可用性验证 |
| deployment | 交付/归档 | 发布上线、合并代码 | 定稿、发布 | 交付资源、归档 |

> 不同任务类型下，各阶段的产物形式会变化，但阶段意图保持一致。

## 流程范围

| 范围 | 适用场景 | 行为 |
|------|----------|------|
| L0 直接处理 | 拼写、格式、明显的小错误、无行为风险的小配置 | 直接改，最终总结验证结果 |
| L1 快速修复 | 单模块、小范围、行为明确、有现成验证 | 保存轻量记录，直接实现和验证 |
| L2 标准执行 | 用户给出明确目标，但需要变更清单和验证计划 | 从执行规范开始，由 AI 决策并推进，必要时确认 |
| L3 完整流程 | 新功能、架构变更、需求模糊、跨模块改动 | 从原始输入开始逐阶段产出文档，由 AI 决策并在高风险节点确认 |

详细判断见 [flow-policy](flow-policy.md)。

## 阶段概览

| 阶段 | 目录 | 核心交付物 | AI 行为 |
|------|------|------------|---------|
| raw-input | raw-input/ | 原始票据、来源链接、素材 | 只读 |
| requirements | requirements/ | 验收标准(AC)、范围、依赖 | 提炼转化 |
| design | design/ | 方案、技术选型、决策 | 方案决策 |
| tech-spec | tech-spec/ | 执行规范、数据模型、变更清单 | 规范化 |
| implementation | implementation/ | 实际产出、变更记录、决策记录 | 按 spec 执行 |
| testing | testing/ | 验证用例、执行记录、缺陷、报告 | 验证 |
| deployment | deployment/ | 发布说明、交付清单、回滚/归档方案 | 记录归档 |
| quality-eval | testing/ | eval-report.md | 评价验收标准、验证证据、风险关闭和交付状态 |

## 状态

待处理 → 活跃 → 完成（可暂挂/取消）

## 检查点

- L3 完整流程：每个关键阶段结束后展示产出、AI 决策、取舍理由和风险；仅在需求目标、高风险边界或不可逆操作需要人类授权时等待确认。
- L2 标准执行：执行规范完成后展示变更清单和验证计划，由 AI 继续实现；仅在存在开放问题或高风险操作时等待确认。
- L0/L1：可先完成实现和验证，再在总结中说明使用了轻量流程。
- 用户要求继续、加速或跳过时，尊重用户选择并记录风险。

## 可执行动作清单

项目动作优先从 `.agents/recipes.json` 读取；不存在或过期时运行：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json
```

实现后选择最小但有意义的动作进行验证。跨工作区改动需要分别选择受影响工作区的动作。

> `recipes` 不限于代码命令，也可以是任何可执行动作，例如格式检查、链接检查、数据校验、导出脚本等。

## 任务质量评价

L2/L3 任务完成验证后运行：

```bash
node .agents/skills/an-eval/scripts/evaluate-task.mjs artifacts/{YYYYMMDD}__{feature-name}
```

将输出保存为 `artifacts/{feature}/testing/eval-report.md`。`BLOCKED` 表示不应归档，除非用户明确接受剩余风险。
