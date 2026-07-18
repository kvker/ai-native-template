# AI Native 上下文模板

这是一个领域无关的 AI Context 工作区模板，用于为任意类型的多轮 AI 协作提供稳定、可追踪的上下文结构。

> 本 README 仅供模板使用者阅读。执行 `/an-init` 后会删除。

## 模板定位

模板不预设工作类型。代码、文档、数据、设计资源、研究材料、内容项目或其他需要 AI 理解和操作的材料，都可以作为独立工作单元放入 `projects/`。

模板负责组织背景、约定、任务过程、产出引用、检查结果和归档状态，不定义具体行业如何工作。AI 根据实际材料和用户输入理解当前工作区。

## 快速开始

1. 将已有材料放入 `projects/{workspace}/`。没有材料时也可以从空模板初始化。
2. 执行：

```bash
/an-init
```

3. 初始化会分析工作单元、生成背景与约定、探测可用动作，并安装运行期 Skills。

模板初始化前只激活 `/an-init`；其他运行期 Skills 暂存在 `skills/`，初始化完成后移动到 `.agents/skills/`。

## 目录结构

```text
ai-native-template/
├── AGENTS.md
├── .agents/
│   └── skills/an-init/
├── skills/
├── conventions/
├── background/
├── artifacts/
└── projects/
```

| 目录 | 用途 |
|------|------|
| `background/` | 从工作区事实和用户输入整理出的稳定背景 |
| `conventions/` | 长期规范、工作流和对话记忆规则 |
| `artifacts/` | 需要留痕的任务上下文和归档记录 |
| `projects/` | 实际工作材料和交付物所在的工作区根目录 |
| `.agents/skills/` | 初始化后可用的 AI Native Skills |

## 标准工作流

```text
raw → requirements → design → spec → execution → review → archive
```

| 阶段 | 含义 |
|------|------|
| raw | 原始内容、材料和来源 |
| requirements | 目标、范围、约束和完成标准 |
| design | 方案、结构、关键决策和取舍 |
| spec | 可执行规则、步骤和产出要求 |
| execution | 实际工作过程与产出 |
| review | 检查产出、处理问题并给出结论 |
| archive | 标记完结并归档任务上下文 |

L0-L3 只控制流程展开程度。小任务可以直接执行和检查；复杂或高风险任务保留完整阶段记录。

Review 使用三种结论：

| 结论 | 含义 |
|------|------|
| `PASS` | 满足完成标准，可以归档 |
| `REVIEW` | 仍需复核或明确接受 |
| `BLOCKED` | 存在未解决问题，不能归档 |

## 可用命令

| 命令 | 用途 |
|------|------|
| `/an-init` | 分析工作区、生成上下文并安装运行期 Skills |
| `/an-task` | 按风险选择 L0-L3 并执行任务 |
| `/an-task-split` | 将过大的任务拆分为可独立推进的子任务 |
| `/an-recipes` | 探测工作区可用的命令和检查动作 |
| `/an-refresh` | 根据工作区现状刷新背景知识 |
| `/an-review` | 按完成标准检查任务并给出结论 |
| `/an-archive` | 在满足门禁后归档已完成任务 |

## 初始化后结构

```text
initialized-workspace/
├── AGENTS.md
├── .agents/
│   ├── recipes.json
│   └── skills/
├── conventions/
├── background/
│   ├── AGENTS.md
│   ├── overview.md
│   └── workspaces.md
├── artifacts/
│   └── AGENTS.md
└── projects/
```

## 核心原则

1. AI 是目标协作者：上下文优先服务 AI 理解和执行。
2. 事实驱动：背景只来自实际材料和用户明确输入。
3. 规范驱动执行：先明确必要约束，再完成实际产出。
4. 简单优先：只保留当前任务需要的阶段和记录。
