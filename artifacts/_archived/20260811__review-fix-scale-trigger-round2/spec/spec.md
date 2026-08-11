# Spec：循环复审第 2 轮修复

## 执行步骤

1. flow-policy line 66 规模膨胀确认条件区分已建仓/未建仓，不再对已建仓任务询问"创建 Artifact"。
2. flow-policy line 57-58 已建仓定义改为"已存在 Artifact（含 L1 轻量 Artifact）"；"3 轮以上"统一为"达 3 轮"。
3. 测试强化：AC-3 增加 an-task"3 个以上文件"断言；AC-4 增加"未建仓任务确认是否补建 Artifact"与"不重复询问是否建仓"断言。
4. 修正归档 review.json AC-4 占位证据为真实复审结论。

## 影响位置

- conventions/flow-policy.md
- .agents/skills/an-init/tests/template-contract.test.mjs
- artifacts/_archived/20260811__review-fix-scale-trigger/review/review.json（证据修正，仅补全不翻案）

## 检查计划

- 运行全量测试。
- 启动循环第 3 轮干净子代理复审。
