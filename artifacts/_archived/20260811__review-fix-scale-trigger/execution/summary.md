# 执行摘要

## 产出

- conventions/flow-policy.md：膨胀暂停条款区分未建仓/已建仓两条路径，消除与"多轮迭代至少 L2"的语义重叠，避免已建仓任务无意义暂停。
- an-task/SKILL.md.txt：L2 触发清单补齐数据迁移、权限或安全边界、多轮迭代；补充 L0≤1、L1≤2 文件数口径；膨胀处理对齐 flow-policy。
- template-contract.test.mjs：规模感知测试强化，锁定 L0/L1 数值、3 轮阈值、清单一致性。

## 验证

- node --test .agents/skills/an-init/tests/*.test.mjs：64 项全部通过。
- 暂存区重新 git add，修复归档前快照过期问题。

## 偏离与决策

- 问题 2 的 AC-2 判据矛盾：归档记录（requirements/review 文本"仅 1 个文件"）按只读约定不改；实际规则口径以 flow-policy 为准（L0≤1、L1≤2），已同步到 an-task 并纳入测试锁定。
- 未改动 an-init/SKILL.md 根路由（其规模规则文本与本轮内容兼容，无冲突）。
