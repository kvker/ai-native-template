# AI Native 项目模板

这是一个 AI Native 项目的模板基座，用于快速搭建 AI 友好的工程结构。

> 注意：本 README 是给人类阅读的，与 AI 无关。在实际的 AI Native 项目中，不需要这个文件。

## 快速开始

### 方式一：迁移现有项目

如果你有一个现有的项目想要转换为 AI Native 结构：

```bash
# 1. 下载这个模板

# 2. 将你的旧代码移动到 target 目录
mv /path/to/your-old-code ./target

# 3. 执行初始化命令
/an-init
```

AI 会自动分析 `target/` 中的代码，生成 `background/` 和 `convention/` 文档。

### 方式二：从零开始

如果你要从零开始一个新项目：

1. 复制模板到新项目目录
2. 直接告诉 AI 你的需求，比如：「帮我开发一个用户登录功能」
3. AI 会按照工作流，从需求分析到代码生成逐步引导你

**流程**：
```
/an-feature 需求描述 → workspace/{feature}/raw-input/ → requirements/ → design/ → tech-spec/ → implementation/ → target/
```

AI 会在 `workspace/` 中创建功能目录，按阶段生成文档，最终在 `target/` 中生成代码。

## 目录结构

### 模板基座（初始化前）

```
ai-native-template/
├── CLAUDE.md           # AI 入口文件
├── background/         # 背景知识（空，等待填充）
├── convention/         # 规范定义
│   ├── document.md     # 文档编写规范
│   └── workflow.md     # 工作流规范
├── workspace/          # 活跃工作区（空）
└── target/             # 实际代码（空）
```

### 初始化后（执行 /an-init）

```
your-project/
├── CLAUDE.md           # AI 入口文件（已填充项目背景）
├── background/
│   ├── product/        # 产品背景
│   │   └── overview.md
│   └── tech/           # 技术背景
│       └── stack.md
├── convention/
│   ├── document.md     # 文档编写规范
│   ├── workflow.md     # 工作流规范
│   ├── structure.md    # 目录结构规范（生成）
│   └── coding-style.md # 代码风格规范（生成）
├── workspace/          # 活跃工作区
│   └── README.md
└── target/             # 实际代码
```

## 可用命令

| 命令 | 用途 |
|------|------|
| `/an-init` | 迁移现有项目，分析 target/ 代码生成文档 |
| `/an-feature` | 标准化流程实现 feature |

> 从零开始不需要命令，直接告诉 AI 你的需求即可。

## 工作流

```
raw-input → requirements → design → tech-spec → implementation → testing → deployment
```

每个阶段 AI 会：
1. 生成对应文档
2. 等待用户确认
3. 进入下一阶段

## 核心原理

1. **AI 是目标开发者**：文档结构为 AI 设计，不是为人类
2. **有效上下文**：上下文质量决定 AI 输出质量
3. **规范驱动开发**：先定义规范，再由 AI 执行

## 相关入口

- [Claude 入口文件](CLAUDE.md) - AI 的入口文件
- [工程入口](target/) - 实际代码目录
