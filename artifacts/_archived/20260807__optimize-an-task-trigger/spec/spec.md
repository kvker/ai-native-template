# Spec：an-task 触发机制优化

## 执行步骤

1. 修改 an-task 发现描述（frontmatter description），显式加入“开始吧/开始做/实现/动手/开工/按方案执行”等进入执行态的触发信号，让隐式调用也能命中。
2. 在 an-task 正文新增“触发与逐消息重新分流”章节：讨论态不触发；明确执行指令必须分流；每条新消息重新分流；无法判断时按 flow-policy 确认。
3. 更新 an-task 的 agents/openai.yaml 元数据，把触发语义写入 short_description 和 default_prompt（保持 25-64 字符约束）。
4. 在 an-init 的根 AGENTS 路由要求中补充 `$an-task` 触发规则，使初始化后的工作区具备同样语义。
5. 在 template-contract.test.mjs 新增契约测试，覆盖“连续讨论后说开始吧必须进入 an-task 分流”的异常场景。

## 影响位置

- `.agents/skills/an-init/assets/skills/an-task/SKILL.md.txt`
- `.agents/skills/an-init/assets/skills/an-task/agents/openai.yaml`
- `.agents/skills/an-init/SKILL.md`
- `.agents/skills/an-init/tests/template-contract.test.mjs`

## 检查计划

- 运行 `.agents/skills/an-init/tests/*.test.mjs`，全部通过（含新增测试）。
- 校验 openai.yaml 元数据约束（short_description 25-64 字符、default_prompt 引用 $an-task）。
