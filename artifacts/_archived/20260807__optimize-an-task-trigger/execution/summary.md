# 执行摘要

## 产出

- `.agents/skills/an-init/assets/skills/an-task/SKILL.md.txt`：描述加入进入执行态的触发信号；正文新增“〇、触发与逐消息重新分流”章节，明确讨论态不触发、明确执行指令必须分流、每条新消息重新分流、无法判断时按 flow-policy 确认。
- `.agents/skills/an-init/assets/skills/an-task/agents/openai.yaml`：short_description 与 default_prompt 加入触发语义；short_description 40 字符，满足 25-64 约束。
- `.agents/skills/an-init/SKILL.md`：根 AGENTS 路由要求新增 `$an-task` 触发规则。
- `.agents/skills/an-init/tests/template-contract.test.mjs`：新增“an-task 触发机制锁定讨论态到执行态的切换”测试，覆盖 AC-1/AC-2/AC-3。

## 验证

- `node --test .agents/skills/an-init/tests/*.test.mjs`：61 项全部通过，含新增测试。
- openai.yaml 元数据约束经 python yaml 校验通过。

## 偏离与决策

- 初始使用 heredoc 重建 SKILL.md.txt 时，一次多余的 node 校验片段误引用不存在的备份文件并报错，但顶层 heredoc 已写入；随即用完整内容（含原 二～七 章节）整体重建，无内容丢失。
- 安装预检 dry-run 报告“根 AGENTS.md 尚未生成运行期路由”：本仓库仍是模板阶段（未初始化），属预期，非本次变更引入。
