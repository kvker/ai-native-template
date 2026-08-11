# Spec：循环复审第 3/4 轮修复

## 执行步骤

1. flow-policy line 66 已建仓处理统一为"Artifact 内更新并重新 Review，不重复询问建仓"（第 3 轮 P4）。
2. an-task"依赖"措辞对齐 flow-policy"外部依赖"（第 3 轮 P5）。
3. flow-policy line 58 已建仓处理适配 L1 轻量 Artifact：改为"更新相应阶段文档（如存在 requirements/spec）"（第 4 轮 P2）。
4. 契约测试同步锁定新措辞（含 L1 轻量 Artifact、相应阶段文档、外部依赖）。
5. 修正归档时序：先复审、后归档；历史归档失真仅在 execution 摘要记录，不追改。

## 影响位置

- conventions/flow-policy.md
- .agents/skills/an-init/assets/skills/an-task/SKILL.md.txt
- .agents/skills/an-init/tests/template-contract.test.mjs

## 检查计划

- 运行全量测试。
- 独立子代理复审返回"未发现问题"后再归档。
