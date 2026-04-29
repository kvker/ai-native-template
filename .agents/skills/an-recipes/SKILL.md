---
name: an-recipes
description: 探测、生成和运行 AI Native 可执行命令清单，包括验证、构建、代码检查、类型检查、代码生成和本地开发命令。用户询问可执行规则、项目命令、验证命令，或 $an-init 后需要让 target 工程可被 Codex 直接运行时使用。
---

# AI Native 可执行命令清单

将文档型规范转成 Codex 可执行的命令清单：明确命令、工作目录、用途、置信度和来源。

## 何时使用

- 初始化后需要生成 `.agents/recipes.json`。
- 用户问“怎么验证”“怎么构建”“有哪些测试入口”。
- 任务实现后需要选择最小验证命令。
- 技术栈或脚本变化后需要刷新可执行命令清单。

## 快速探测

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root target --format markdown
```

写入结构化命令清单：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .agents/recipes.json
```

## 命令选择原则

| 任务类型 | 优先命令 |
|----------|-------------|
| 纯文案/样式 | 代码检查或相关单测 |
| 类型、接口、模型变更 | 类型检查和测试 |
| 构建链路变更 | 构建和测试 |
| 代码生成、数据模型变更 | 代码生成、类型检查和测试 |
| 多工程改动 | 每个受影响工程运行最小命令 |

## 执行约束

- 先读 `.agents/recipes.json`；不存在或过期时运行探测脚本。
- 不自动运行 dev server，除非前端验证需要且用户允许。
- 高成本命令先说明原因；网络安装、数据库迁移、破坏性命令需要用户确认。
- 命令失败时，记录失败命令、工作目录、退出码和关键输出。
