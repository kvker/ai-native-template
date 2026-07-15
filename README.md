# AI Native 上下文模板

这是一个通用的 AI Native 上下文模板，用于为任意类型的多轮 AI 协作提供结构化上下文。

> 注意：本 README 是给人类阅读的，与 AI 无关。在实际的 AI Native 项目中，不需要这个文件。

## 模板定位

本模板不预设任务类型。它既可以承载代码开发，也可以承载文档写作、方案设计、数据分析、研究整理、内容创作、流程规划等任务。

核心目标：让 AI 在一致的上下文结构中理解目标、规范、背景和任务状态，减少重复沟通，提升协作质量。

## 快速开始

### 1. 下载这个模板

### 2. 将你的工作内容放入 `projects/` 目录

`projects/` 是工作区根目录，每个子目录为一个独立工作单元。工作单元可以是：

- 代码工程
- 文档集合
- 数据集
- 设计稿目录
- 任何需要被 AI 理解和操作的交付物集合

```bash
# 单工作区
mkdir -p projects/workspace-a
# 将你的材料复制进去
cp -r /path/to/materials ./projects/workspace-a/

# 多工作区
mkdir -p projects/workspace-b
cp -r /path/to/other-materials ./projects/workspace-b/
```

如果暂时没有材料，也可以直接执行 `/an-init`，由 AI 创建一个空的通用上下文结构。

### 3. 执行初始化命令

```bash
/an-init
```

AI 会分析 `projects/` 下的工作区，生成 `background/` 背景文档和 `conventions/` 规范，并通过 `AGENTS.md` 路由给支持 AGENTS 的工具读取。

初始化时会主动询问是否使用子代理并行处理“可执行动作探测”和“背景扫描”。未启用子代理时，会在主流程中顺序执行同样脚本。

模板初始化前只激活 `/an-init`；其他 AI Native 运行期技能暂存在 `skills/`，会在 `/an-init` 完成后移动到 `.agents/skills/` 并删除暂存目录。

## 目录结构

### 模板基座（初始化前）

```
ai-native-template/
├── AGENTS.md           # AI 入口文件
├── .agents/
│   └── skills/
│       └── an-init/    # 模板阶段唯一激活技能
├── skills/             # 初始化后安装到 .agents/skills/ 的运行期技能暂存目录
├── conventions/        # 规范定义（由 AGENTS.md 路由加载）
│   ├── principles.md   # 核心原则
│   ├── workflow.md     # 工作流规范
│   └── document.md     # 文档编写规范
├── background/         # 背景知识（空，等待填充）
├── artifacts/          # 任务产出目录（空）
└── projects/          # 实际工作区 / 交付物根目录（空）
```

### 初始化后（执行 /an-init）

```
initialized-project/
├── AGENTS.md           # AI 入口文件（已填充工作区背景）
├── .agents/
│   ├── recipes.json    # 可执行动作清单
│   └── skills/         # 初始化后激活的 AI Native 运行期技能
├── conventions/        # 规范（由 AGENTS.md 路由加载）
│   ├── workflow.md     # 工作流规范
│   ├── document.md     # 文档编写规范
│   ├── structure.md    # 工作区结构规范（生成）
│   └── style-guide.md  # 风格规范（生成）
├── background/
│   ├── AGENTS.md       # 背景目录说明
│   ├── product/        # 产品/主题背景
│   │   └── overview.md
│   └── tech/           # 能力/工具背景
│       └── stack.md
├── artifacts/          # 任务产出目录
│   └── AGENTS.md       # 产出目录说明
└── projects/          # 实际工作区（每个子目录为一个工作单元）
    ├── workspace-a/    # 工作区示例
    └── workspace-b/    # 工作区示例
```

## 可用命令

| 命令 | 可用阶段 | 用途 |
|------|----------|------|
| `/an-init` | 模板初始化前 | 将已有工作区纳入 AI Native 结构，分析 `projects/` 下各工作单元并生成文档，安装运行期技能 |
| `/an-task` | 初始化后 | 按标准流程推进一个 AI 协作任务 |
| `/an-task-split` | 初始化后 | 将大任务拆分为多个子任务 |
| `/an-recipes` | 初始化后 | 探测并生成可执行动作清单 |
| `/an-refresh` | 初始化后 | 根据实际工作区内容反向更新 `background/` 背景知识库 |
| `/an-eval` | 初始化后 | 根据验收标准、验证证据、风险关闭和交付状态评价任务质量 |
| `/an-archive` | 初始化后 | 将已完成的任务产出归档到 `artifacts/archive/` |

## 工作流

```
raw-input → requirements → design → tech-spec → implementation → testing → deployment
```

阶段含义已泛化，适用于各类任务：

| 阶段 | 通用含义 | 代码任务示例 | 文档任务示例 |
|------|----------|--------------|--------------|
| raw-input | 原始输入 | 用户 issue / 需求描述 | 原始笔记 / 素材 |
| requirements | 验收标准、范围、依赖 | 功能需求 | 文档目标与读者 |
| design | 方案设计 | 技术选型 | 结构与大纲 |
| tech-spec | 执行规范 | 数据模型、API 契约、变更清单 | 章节清单、写作规范 |
| implementation | 执行/产出 | 写代码 | 撰写内容 |
| testing | 验证 | 测试、类型检查 | 审校、核对 |
| deployment | 交付/归档 | 发布上线 | 定稿归档 |

每个阶段 AI 会：
1. 根据任务风险自主选择 L0/L1/L2/L3 流程等级
2. 生成所需文档并展示关键决策、理由和风险
3. 继续推进实现与验证；仅在需求目标不明确、高风险边界、破坏性操作或外部授权时等待用户确认

## 可执行动作清单

初始化后可生成 `.agents/recipes.json`：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json
```

`recipes` 不局限于代码命令，也可以是任何可执行动作，例如：

- 代码任务：测试、构建、类型检查、代码生成
- 文档任务：格式检查、链接检查、字数统计
- 数据任务：数据校验、转换脚本
- 设计任务：导出资源、预览生成

任务实现后，AI 优先从该文件选择最小验证动作，而不是临时猜测。

## 任务质量评价

L2/L3 任务完成后运行：

```bash
node .agents/skills/an-eval/scripts/evaluate-task.mjs artifacts/{YYYYMMDD}__{feature-name}
```

质量评价会输出 `PASS`、`REVIEW` 或 `BLOCKED`，分别表示“可交付”“建议复核”“不应关闭”。

## 核心原理

1. **AI 是目标协作者**：文档结构为 AI 设计，人类阅读是次要的
2. **有效上下文**：上下文质量决定 AI 输出质量
3. **规范驱动执行**：先定义规范，再由 AI 执行

## 相关入口

- [AGENTS 入口文件](AGENTS.md) - AI 的入口文件
- [工作区入口](projects/) - 实际工作区 / 交付物根目录
