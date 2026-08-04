<!-- ai-native-template-readme -->

# AI Native 上下文模板

这是一个领域无关的 AI Context 工作区模板，用于为任意类型的多轮 AI 协作提供稳定、可追踪的上下文结构。

> 本 README 仅供模板阶段使用。初始化时会将其改写为当前工作区的人类概览，不会直接删除。

## 模板定位

模板不预设工作类型。代码、文档、数据、设计资源、研究材料、内容项目或其他需要 AI 理解和操作的材料，都可以作为独立工作单元放入 `projects/`。

模板负责组织背景、约定、任务过程、产出引用、检查结果和归档状态，不定义具体行业如何工作。AI 根据实际材料和用户输入理解当前工作区。

## 快速开始

1. 将已有材料放入 `projects/{workspace}/`。没有材料时也可以从空模板初始化。
2. 在对话中显式调用：

```text
$an-init
```

支持 Slash Command 的客户端也可以使用 `/an-init`。

3. 初始化会分析工作单元、生成背景与约定、探测可用动作并安装运行期 Skills。安装完成后重启 OpenCode 或 Codex，再使用运行期 Skills。

其他运行期 Skills 以 `SKILL.md.txt` 暂存在 `.agents/skills/an-init/assets/skills/`，模板阶段不会被发现。

## 目录结构

```text
ai-native-template/
├── AGENTS.md
├── .agents/
│   └── skills/an-init/
│       └── assets/skills/
├── conventions/
├── background/
├── artifacts/
└── projects/
```

| 目录 | 用途 |
|------|------|
| `background/` | 从工作区事实和用户输入整理出的稳定背景 |
| `conventions/` | 长期规范、工作流和对话记忆规则 |
| `artifacts/` | 任务状态、上下文、检查证据和归档记录 |
| `projects/` | 实际工作材料和交付物所在的工作区根目录 |
| `.agents/skills/` | 初始化后可用的 AI Native Skills |

## 标准工作流

```text
raw → requirements → design → spec → execution → review → archive
```

阶段、生命周期状态、Review 结论和归档门禁只在 [workflow](conventions/workflow.md) 中定义。L0-L3 仅控制流程展开程度，判断规则见 [flow-policy](conventions/flow-policy.md)。

## 可用 Skills

模板阶段只有 `$an-init` 可用。以下运行期 Skills 在初始化完成并重启客户端后可用：

| Skill | 用途 |
|-------|------|
| `$an-task` | 按风险选择 L0-L3 并执行任务 |
| `$an-task-split` | 将过大的任务拆分为可独立推进的子任务 |
| `$an-recipes` | 探测工作区可用的命令和检查动作 |
| `$an-refresh` | 根据工作区现状刷新背景知识 |
| `$an-review` | 按完成标准检查任务并给出结论 |
| `$an-archive` | 在满足门禁后归档已完成、已接受复核或已取消任务 |

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
│   ├── AGENTS.md
│   └── index.json
└── projects/
```

## 核心原则

1. AI 是目标协作者：上下文优先服务 AI 理解和执行。
2. 事实驱动：背景只来自实际材料和用户明确输入。
3. 规范驱动执行：L2/L3 先明确可执行规范；L0/L1 至少明确目标和检查方式。

4. 简单优先：只保留当前任务需要的阶段和记录。
