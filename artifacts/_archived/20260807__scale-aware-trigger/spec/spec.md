# Spec：规模感知的触发机制优化

## 执行步骤

1. flow-policy.md 新增"客观规模判据"小节：L0/L1 限单文件/单层；预计 ≥3 文件或跨前后端/后端接口/数据层时至少 L2。
2. flow-policy.md 的"自主决策与确认"补充规模膨胀暂停确认条件（连续迭代达 3 轮或超出初始规模判断）。
3. an-task 正文明确"分流判定 ≠ 建 Artifact"：小改动只允许不建 Artifact，不允许跳过分流。
4. an-task 正文补充规模判定与迭代膨胀再评估执行规则。
5. an-init 根 AGENTS 路由要求补充规模规则。
6. template-contract.test.mjs 新增规模感知触发契约测试。

## 影响位置

- conventions/flow-policy.md
- .agents/skills/an-init/assets/skills/an-task/SKILL.md.txt
- .agents/skills/an-init/SKILL.md
- .agents/skills/an-init/tests/template-contract.test.mjs

## 检查计划

- 运行 node --test .agents/skills/an-init/tests/*.test.mjs，全部通过。
- 核对 diff 无越界改动。
