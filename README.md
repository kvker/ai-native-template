# AI Native Codex 项目模板

这是一个面向 Codex 的 AI Native 项目模板，用于把已有软件工程转换成 AI 优先的软件工程，或从零开始搭建可由 Codex 长期维护的工程结构。

AI Native 的核心不变：AI 是目标开发者；文档和目录不是为了展示，而是为了让 AI 获得高质量、低噪声、可追踪的工程上下文。

## 快速开始

### 方式一：迁移现有项目

```bash
# 1. 下载或复制这个模板

# 2. 将现有项目复制到 target/
# 单项目：
cp -r /path/to/your-project ./target/my-project

# 多项目：
cp -r /path/to/frontend ./target/frontend
cp -r /path/to/backend ./target/backend

# 3. 在该目录启动 Codex
codex -C .
```

然后在 Codex 中执行：

```text
$an-init
```

Codex 会分析 `target/` 下的每个一级子目录，生成或更新 `background/`、`.agents/rules/`、`target/AGENTS.md` 和根 `AGENTS.md`。

初始化时 Codex 会主动询问是否使用子代理并行处理“可执行命令清单”和“背景扫描”。你也可以在提示中提前说明：

```text
$an-init，用子代理并行处理可执行命令清单和背景扫描
```

如果同意，主代理负责整合和写文档，命令清单子代理负责生成 `.agents/recipes.json`，背景扫描子代理负责抽取依赖包、路由、接口、数据模型和测试线索。未启用子代理时，Codex 会在主流程中顺序执行同样脚本。

### 方式二：从零开始

直接在 Codex 中描述你的需求，或显式使用：

```text
$an-task 开发一个用户登录功能
```

标准工作流：

```text
原始输入 -> 需求 -> 设计 -> 技术规范 -> 实现 -> 测试 -> 发布归档
```

每个任务会在 `workspace/{YYYYMMDD}__{feature-name}/` 下沉淀过程文档，最终代码写入 `target/`。

## 目录结构

### 模板基座

```text
ai-native-template/
├── AGENTS.md             # Codex 仓库入口文件
├── .codex/
│   └── config.toml       # Codex 项目默认配置
├── .agents/
│   ├── rules/            # AI Native 规范文档
│   └── skills/           # Codex 技能
├── background/           # 稳定背景知识
├── workspace/            # 活跃任务工作区
└── target/               # 实际代码目录
```

### 初始化后

```text
your-project/
├── AGENTS.md
├── .agents/
│   ├── rules/
│   │   ├── principles.md
│   │   ├── workflow.md
│   │   ├── document.md
│   │   ├── structure.md
│   │   └── code-style.md
│   └── skills/
├── background/
│   ├── AGENTS.md
│   ├── product/
│   │   └── overview.md
│   └── tech/
│       └── stack.md
├── workspace/
│   ├── AGENTS.md
│   └── README.md
└── target/
    ├── AGENTS.md
    ├── frontend/
    └── backend/
```

## 可用技能

| 技能 | 用途 |
|------|------|
| `$an-init` | 迁移现有项目，分析 `target/` 并生成 AI Native 背景和规范 |
| `$an-task` | 按 AI Native 工作流推进功能、修复、重构、配置或文档任务 |
| `$an-task-split` | 将大型任务拆分为可独立推进的子任务 |
| `$an-recipes` | 探测并生成 Codex 可执行的测试、构建、代码检查、类型检查、代码生成命令清单 |
| `$an-refresh` | 根据实际代码和已完成任务刷新背景知识 |
| `$an-eval` | 根据验收标准、测试证据、风险关闭和交付状态评价任务质量 |
| `$an-archive` | 将已完成的工作区归档到 `workspace/archive/` |

## 可执行命令清单

初始化后可生成 `.agents/recipes.json`：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .agents/recipes.json
```

任务实现后，Codex 优先从该文件选择最小验证命令，而不是临时猜测 `npm test` 或 `pnpm build`。

## 背景自动刷新

`$an-refresh` 内置结构化扫描脚本：

```bash
node .agents/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown
```

它会从依赖包、路由、接口、数据模型、测试报告中抽取摘要，再由 Codex 增量更新 `background/` 和 `.agents/rules/`。

## 任务质量评价

L2/L3 任务完成后运行：

```bash
node .agents/skills/an-eval/scripts/evaluate-task.mjs workspace/{YYYYMMDD}__{feature-name}
```

质量评价会输出 `PASS`、`REVIEW` 或 `BLOCKED`，分别表示“可交付”“建议复核”“不应关闭”，避免只凭“代码改完了”就关闭任务。

## Codex 适配点

| Claude Code 版 | Codex 版 |
|----------------|----------|
| `CLAUDE.md` 入口 | `AGENTS.md` 仓库入口 |
| `.claude/skills/` | `.agents/skills/` |
| `.claude/rules/` path frontmatter | `.agents/rules/` + 嵌套 `AGENTS.md` 路由 |
| `.claude/settings.json` 权限 | `.codex/config.toml` + Codex 沙箱和审批 |
| slash command 习惯 | `$skill` 显式调用，或由 Codex 根据技能描述触发 |
| Explore agent 作为流程策略 | 子代理仅在用户明确要求代理协作时使用 |

## 核心原理

1. **AI 是目标开发者**：工程入口、背景、规范和任务文档都围绕 AI 执行效率设计。
2. **有效上下文**：入口文件只存路由和长期约定，细节按需读取。
3. **规范驱动开发**：复杂任务先明确需求、方案和变更清单，再进入实现。
4. **结果可追踪**：每个任务都能从原始输入追踪到实现和验证。
5. **代码事实优先**：当背景文档与代码冲突时，以 `target/` 的实际代码和测试结果为准。

## 相关入口

- [Codex 入口文件](AGENTS.md)
- [背景知识库](background/)
- [任务工作区](workspace/)
- [实际代码目录](target/)
