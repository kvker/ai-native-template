# Spec：审查修复

## 执行步骤

1. flow-policy.md：膨胀暂停条款拆分为未建仓（升级+补建 Artifact）与已建仓（更新 requirements/spec + 重新 Review）两条路径。
2. an-task：L2 触发清单补齐数据迁移、权限或安全边界、多轮迭代；补充 L0≤1、L1≤2 文件数口径；膨胀处理与 flow-policy 对齐。
3. template-contract.test.mjs：强化规模感知测试，锁定具体数值与两文档清单/阈值一致性。
4. 重新 git add 修复暂存过期（归档后状态）。

## 影响位置

- conventions/flow-policy.md
- .agents/skills/an-init/assets/skills/an-task/SKILL.md.txt
- .agents/skills/an-init/tests/template-contract.test.mjs
- 暂存区状态（git add）

## 检查计划

- 运行全量测试。
- 重新 git add 后核对 git diff --cached 无过期条目。
- 新干净子代理复审无可执行问题。
