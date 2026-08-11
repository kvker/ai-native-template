# 执行摘要

## 产出

- conventions/flow-policy.md：新增"客观规模判据"小节（L0/L1 单文件单层、≥3 文件或跨前后端至少 L2、膨胀暂停确认）；"自主决策与确认"补充规模膨胀确认条件。
- an-task/SKILL.md.txt：触发章节与流程分级明确"分流判定 ≠ 建 Artifact"，小改动只允许不建 Artifact、不允许跳过分流；补充规模判定与每轮迭代后重新评估、达 3 轮或规模超出时暂停确认并补建 Artifact。
- an-init/SKILL.md：根 AGENTS 路由要求补充规模规则。
- template-contract.test.mjs：新增"an-task 规模感知触发机制"契约测试。

## 验证

- node --test .agents/skills/an-init/tests/*.test.mjs：64 项全部通过，含新增规模感知测试。
- git diff 核对无越界改动。

## 偏离与决策

- 用户反馈原因 1 的表述被修正：an-task 从未允许跳过分流，L0/L1 只是不建 Artifact；本次把这一误读显式化到文档，避免再被当作跳过理由。
- 客观判据同时落在 flow-policy（权威定义）与 an-task（执行说明），保持单一事实源在 flow-policy。
