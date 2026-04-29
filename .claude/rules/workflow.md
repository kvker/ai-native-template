<!-- 无 frontmatter：工作流是全局性规范，所有对话都需要加载 -->

# 工作流规范

## 标准工作流

raw-input → requirements → design → tech-spec → implementation → testing → deployment

> 小 bug 可咨询开发人员跳过流程

## 流程范围

| 范围 | 适用场景 | 行为 |
|------|----------|------|
| L0 直接修复 | 拼写、注释、明显一行 bug、无行为风险的小配置 | 直接改，最终总结验证结果 |
| L1 快速修复 | 单模块、小范围、行为明确、有现成验证 | 保存轻量记录，直接实现和验证 |
| L2 标准开发 | 用户给出明确方案，但需要变更清单和测试计划 | 从技术规范开始，必要时确认后实现 |
| L3 完整流程 | 新功能、架构变更、需求模糊、跨模块改动 | 从原始输入开始逐阶段产出文档并在关键节点确认 |

详细判断见 [flow-policy](flow-policy.md)。

## 阶段概览

| 阶段 | 目录 | 核心交付物 | AI 行为 |
|------|------|------------|---------|
| raw-input | raw-input/ | 原始票据、来源链接 | 只读 |
| requirements | requirements/ | 验收标准(AC)、范围、依赖 | 提炼转化 |
| design | design/ | 架构图、技术选型、决策 | 方案决策 |
| tech-spec | tech-spec/ | 数据模型、API契约、变更清单 | 规范化 |
| implementation | implementation/ | 代码变更、决策记录 | 按spec执行 |
| testing | testing/ | 用例、执行记录、缺陷、报告 | 验证 |
| deployment | deployment/ | 发布说明、上线清单、回滚方案 | 记录归档 |
| quality-eval | testing/ | eval-report.md | 评价验收标准、测试证据、风险关闭和交付状态 |

## 状态

待处理 → 活跃 → 完成（可暂挂/取消）

## 检查点

- L3 完整流程：每个关键阶段结束后展示产出，等待用户确认或调整。
- L2 标准开发：至少在技术规范完成后确认变更清单和测试计划；用户明确要求加速时可记录原因后跳过。
- L0/L1：可先完成实现和验证，再在总结中说明使用了轻量流程。
- 用户要求继续、加速或跳过时，尊重用户选择并记录风险。

## 可执行命令清单

项目命令优先从 `.claude/recipes.json` 读取；不存在或过期时运行：

```bash
node .claude/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .claude/recipes.json
```

实现后选择最小但有意义的命令进行验证。跨工程改动需要分别选择受影响工程的命令。

## 任务质量评价

L2/L3 任务完成测试后运行：

```bash
node .claude/skills/an-eval/scripts/evaluate-task.mjs workspace/{YYYYMMDD}__{feature-name}
```

将输出保存为 `workspace/{feature}/testing/eval-report.md`。`BLOCKED` 表示不应归档，除非用户明确接受剩余风险。
