# 工作流规范

## 标准流程

```text
原始输入 -> 需求 -> 设计 -> 技术规范 -> 实现 -> 测试 -> 发布归档
```

## 流程范围

| 范围 | 适用场景 | 行为 |
|------|----------|------|
| L0 直接修复 | 拼写、注释、明显一行 bug、无行为风险的小配置 | 直接改，最终总结验证结果 |
| L1 快速修复 | 单模块、小范围、行为明确、有现成验证 | 保存轻量记录，直接实现和验证 |
| L2 标准开发 | 用户给出明确方案，但需要变更清单和测试计划 | 从技术规范开始，必要时确认后实现 |
| L3 完整流程 | 新功能、架构变更、需求模糊、跨模块改动 | 从原始输入开始逐阶段产出文档并在关键节点确认 |

详细判断见 [flow-policy](flow-policy.md)。

## 阶段概览

| 阶段 | 目录 | 核心交付物 | Codex 行为 |
|------|------|------------|------------|
| 原始输入 | raw-input/ | 原始票据、用户描述、来源链接 | 原样保存，不加工 |
| 需求 | requirements/ | 验收标准、范围、依赖、开放问题 | 提炼业务和工程需求 |
| 设计 | design/ | 技术方案、决策、风险权衡 | 讨论方案，不写施工细节 |
| 技术规范 | tech-spec/ | 数据模型、接口契约、变更清单、测试计划 | 输出可执行规范 |
| 实现 | implementation/ | 代码变更、额外决策记录 | 按规范实现并记录偏差 |
| 测试 | testing/ | 测试用例、执行记录、缺陷 | 运行可用验证并记录结果 |
| 发布归档 | deployment/ | 发布说明、上线清单、回滚方案 | 收尾、归档和背景更新建议 |
| 质量评价 | testing/ | eval-report.md | 评价验收标准、测试证据、风险关闭和交付状态 |

## 检查点

- L3 完整流程：每个关键阶段结束后展示产出，等待用户确认或调整。
- L2 标准开发：至少在技术规范完成后确认变更清单和测试计划；用户明确要求加速时可记录原因后跳过。
- L0/L1：可先完成实现和验证，再在总结中说明使用了轻量流程。
- 用户要求继续、加速或跳过时，尊重用户选择并记录风险。

## 调查策略

1. 先读 `AGENTS.md` 和相关目录的嵌套 `AGENTS.md`。
2. 按需读取 `background/` 和已有 `workspace/`，不做大面积扫描。
3. 用 `rg` / `rg --files` 定位 `target/` 中的相关代码。
4. 只有定位不到、跨模块关系复杂或用户要求时，才扩大调查范围。
5. 涉及外部库时，优先查看本地依赖版本和官方文档。

## 可执行命令清单

项目命令优先从 `.agents/recipes.json` 读取；不存在或过期时运行：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .agents/recipes.json
```

实现后选择最小但有意义的命令进行验证。跨工程改动需要分别选择受影响工程的命令。

## 任务质量评价

L2/L3 任务完成测试后运行：

```bash
node .agents/skills/an-eval/scripts/evaluate-task.mjs workspace/{YYYYMMDD}__{feature-name}
```

将输出保存为 `workspace/{feature}/testing/eval-report.md`。`BLOCKED` 表示不应归档，除非用户明确接受剩余风险。

## 任务工作区

每个任务使用独立目录：

```text
workspace/{YYYYMMDD}__{feature-name}/
├── AGENTS.md
├── raw-input/
├── requirements/
├── design/
├── tech-spec/
├── implementation/
├── testing/
└── deployment/
```

工作区 `AGENTS.md` 是该任务的索引，存放阶段路由、状态和关键决策，不堆放正文内容。
