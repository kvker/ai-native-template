# AI Native 项目模板

这是一个 AI Native 项目的模板基座，用于快速搭建 AI 友好的工程结构。

> 注意：本 README 是给人类阅读的，与 AI 无关。在实际的 AI Native 项目中，不需要这个文件。

## 快速开始

如果你有一个现有的项目想要转换为 AI Native 结构：

```bash
# 1. 下载这个模板

# 2. 将你的项目代码复制到 projects 目录
# 单项目（复制到 projects/ 下，会保留原始文件夹名）：
cp -r /path/to/project ./projects/

# 多项目：
cp -r /path/to/project-a ./projects/
cp -r /path/to/project-b ./projects/

# 3. 执行初始化命令
/an-init
```

AI 会自动分析 `projects/` 下的每个子目录（每个视为一个独立工程），生成 `background/` 文档和 `conventions/` 规范，并通过 `AGENTS.md` 路由给支持 AGENTS 的工具读取。
初始化时会主动询问是否使用子代理并行处理“可执行命令清单”和“背景扫描”。未启用子代理时，会在主流程中顺序执行同样脚本。
模板初始化前只激活 `/an-init`；其他 AI Native 项目技能暂存在 `skills/`，会在 `/an-init` 完成后移动到 `.agents/skills/` 并删除暂存目录。

## 目录结构

### 模板基座（初始化前）

```
ai-native-template/
├── AGENTS.md           # AI 入口文件
├── .agents/
│   └── skills/
│       └── an-init/    # 模板阶段唯一激活技能
├── skills/             # 初始化后安装到 .agents/skills/ 的项目技能暂存目录
├── conventions/        # 规范定义（由 AGENTS.md 路由加载）
│   ├── principles.md   # 核心原则
│   ├── workflow.md      # 工作流规范
│   └── document.md     # 文档编写规范
├── background/         # 背景知识（空，等待填充）
├── artifacts/          # 任务产出目录（空）
└── projects/          # 实际工程项目（空）
```

### 初始化后（执行 /an-init）

```
initialized-project/
├── AGENTS.md           # AI 入口文件（已填充项目背景）
├── .agents/
│   ├── recipes.json    # 可执行命令清单
│   └── skills/         # 初始化后激活的 AI Native 项目技能
├── conventions/        # 规范（由 AGENTS.md 路由加载）
│   ├── workflow.md      # 工作流规范
│   ├── document.md     # 文档编写规范
│   ├── structure.md    # 目录结构规范（生成）
│   └── code-style.md   # 代码风格规范（生成）
├── background/
│   ├── AGENTS.md       # 背景目录说明
│   ├── product/        # 产品背景
│   │   └── overview.md
│   └── tech/           # 技术背景
│       └── stack.md
├── artifacts/          # 任务产出目录
│   └── AGENTS.md       # 产出目录说明
└── projects/          # 实际工程项目（每个子目录为一个工程）
    ├── project-a/      # 工程示例
    └── project-b/      # 工程示例
```

## 可用命令

| 命令 | 可用阶段 | 用途 |
|------|----------|------|
| `/an-init` | 模板初始化前 | 迁移现有项目，分析 projects/ 下各工程的代码生成文档，并安装项目期技能 |
| `/an-task` | 初始化后 | 标准化流程实现 feature |
| `/an-task-split` | 初始化后 | 将大任务拆分为多个子任务 |
| `/an-recipes` | 初始化后 | 探测并生成可执行命令清单 |
| `/an-refresh` | 初始化后 | 根据实际代码反向更新 background 背景知识库 |
| `/an-eval` | 初始化后 | 根据验收标准、测试证据、风险关闭和交付状态评价任务质量 |
| `/an-archive` | 初始化后 | 将已完成的任务产出归档到 `artifacts/archive/` |

> 该模板只支持已有项目改造。`projects/` 为空时，`/an-init` 会停止并提示先复制现有工程。

## 工作流

```
raw-input → requirements → design → tech-spec → implementation → testing → deployment
```

每个阶段 AI 会：
1. 根据任务风险自主选择 L0/L1/L2/L3 流程等级
2. 生成所需文档并展示关键决策、理由和风险
3. 继续推进实现与验证；仅在需求目标不明确、高风险边界、破坏性操作或外部授权时等待用户确认

## 可执行命令清单

初始化后可生成 `.agents/recipes.json`：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json
```

任务实现后，AI 优先从该文件选择最小验证命令，而不是临时猜测 `npm test` 或 `pnpm build`。

## 任务质量评价

L2/L3 任务完成后运行：

```bash
node .agents/skills/an-eval/scripts/evaluate-task.mjs artifacts/{YYYYMMDD}__{feature-name}
```

质量评价会输出 `PASS`、`REVIEW` 或 `BLOCKED`，分别表示“可交付”“建议复核”“不应关闭”。

## 核心原理

1. **AI 是目标开发者**：文档结构为 AI 设计，不是为人类
2. **有效上下文**：上下文质量决定 AI 输出质量
3. **规范驱动开发**：先定义规范，再由 AI 执行

## 相关入口

- [AGENTS 入口文件](AGENTS.md) - AI 的入口文件
- [工程入口](projects/) - 实际工程项目
