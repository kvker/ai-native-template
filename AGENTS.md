# AI Native 上下文模板

这是一个通用的 AI Native 上下文模板，用于为任意类型的 AI 协作任务提供结构化上下文。

> **缩写说明**：对话中出现的“AN”一般指 AI Native 的缩写。

## 模板定位

本模板不预设任务类型。它既可以承载代码开发，也可以承载文档写作、方案设计、数据分析、研究整理、内容创作、流程规划等任何需要多轮 AI 协作的任务。

核心目标：让 AI 在一致的上下文结构中理解目标、规范、背景和任务状态，减少重复沟通，提升协作质量。

## 模板结构

| 目录 | 用途 | AI 行为 |
|------|------|---------|
| [background](background/) | 稳定且可刷新的背景知识 | 任务默认只读，仅由初始化、刷新流程或用户明确要求更新 |
| [conventions](conventions/) | 上下文约定规范、对话长期规则与优化记录 | 开始任务前按需读取；对话过程中自动感知并按需写入 |
| [artifacts](artifacts/) | 任务状态、上下文与检查证据 | 按任务需要读写；实际交付物只保存引用 |
| [projects](projects/) | 实际工作区 / 交付物根目录 | 按任务需要读取和写入，每个子目录为一个独立工作单元 |
| [.agents/skills/an-init](.agents/skills/an-init/) | 模板初始化技能，运行期技能暂存在其 `assets/skills/` 中 | 模板阶段的入口技能；运行期技能以 `SKILL.md.txt` 暂存，模板阶段不可见；`$an-init` 完成后恢复文件名并移入 `.agents/skills/`，an-init 自身删除 |

> `projects/` 在本模板中被视为**工作区根目录**，子目录可以是代码工程、文档集、数据集、设计稿目录或任何需要被 AI 理解和操作的交付物集合。

## 约定

索引文件以路由和必要约束为主，不复制具体文档正文：`[name](path/to/file)`

## AI 行为约束

- 禁止自行脑补未提及的需求、功能或业务逻辑。
- 所有背景知识必须来自实际材料或用户明确输入。
- 从工作区材料反推的信息要标注来源；无法确认的信息标记为“待确认”。
- 不主动读取或输出 `.env`、`secrets/`、credentials、密钥、token 等敏感文件；除非用户明确授权且任务必要。

## 必读规范

开始任务前按需读取以下规范：

| 规范 | 用途 |
|------|------|
| [principles](conventions/principles.md) | AI Native 核心原则 |
| [workflow](conventions/workflow.md) | 标准工作流 |
| [flow-policy](conventions/flow-policy.md) | 流程轻重判断 |
| [document](conventions/document.md) | 文档编写规范 |
| [rules](conventions/rules.md) | 对话过程中的长期记忆感知与沉淀 |
| [memories](conventions/memories/AGENTS.md) | 对话优化记录索引 |

## 任务状态

活跃 Artifact 的唯一索引是 [artifacts/index.json](artifacts/index.json)。根 `AGENTS.md` 不复制动态任务状态，避免任务执行修改高优先级指令文件。

每个 Artifact 的流程等级、生命周期状态和父任务 ID 记录在自身的 `artifact.json`；Review 结论记录在 `review/review.json`。字段契约见 [workflow](conventions/workflow.md)。

## Skill 路由

当前处于模板阶段，唯一入口是 `$an-init`。支持 Slash Command 的客户端也可以使用 `/an-init`。

运行期 Skills 现在仅以 `SKILL.md.txt` 保存，不应提前路由或调用。初始化完成并重启客户端后，根 `AGENTS.md` 必须改为运行期 Skill 路由，并移除 `an-init` 入口。
