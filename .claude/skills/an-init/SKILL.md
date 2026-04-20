---
name: an-init
description: 将现有工程转换为 AI Native 项目结构。当用户想要：1) 将现有项目转换为 AI Native 格式 2) 为已有代码生成 background/rules/workspace 文档 3) 执行 /an-init 命令 4) 让 AI 理解并接管现有项目 时触发此技能。**始终使用中文与用户沟通。**
---

# AI Native 项目初始化

将现有工程转换为 AI Native 项目结构。

支持将一个或多个项目复制到 `target/` 目录，每个子目录视为一个独立工程。

## 前置检查

执行前检查：

1. **检查 `target/` 目录内容**
   - 如果有代码：继续执行
   - 如果为空（仅有 `.gitkeep`）：
     ```
     ⚠️ target/ 目录为空

     请将你的现有工程代码复制到 target/ 目录：

     单项目：
     cp -r /path/to/your-project ./target/my-project

     多项目（前后端分离等）：
     cp -r /path/to/frontend ./target/frontend
     cp -r /path/to/backend ./target/backend

     完成后重新执行 /an-init
     ```
     然后停止执行

---

## 执行流程

### 阶段一：代码分析（静默执行）

扫描 `target/` 目录下的每个子目录，提取客观信息：

**项目列表识别**：
- 扫描 `target/` 下的所有一级子目录
- 每个子目录视为一个独立工程

**技术栈识别**（对每个工程分别执行以下检查）：

```
对每个工程子目录：
1. 进入 target/{工程名}/
2. 检查是否存在 package.json、pom.xml 等特征文件
3. 根据文件内容判断技术栈
```

| 文件存在 | 项目类型 |
|----------|----------|
| `package.json` + `react` | React 前端 |
| `package.json` + `vue` | Vue 前端 |
| `package.json` + `next` | Next.js 全栈 |
| `package.json` + `express` | Express 后端 |
| `package.json` + `nest` | NestJS 后端 |
| `pom.xml` | Java/Maven |
| `requirements.txt` | Python |
| `go.mod` | Go |

**目录结构分析**：
- 扫描每个工程生成目录树
- 推断各目录用途

**代码风格分析**：
- 命名规范（camelCase/kebab-case/PascalCase）
- 文件组织方式
- 注释风格

---

### 阶段二：交互提问

分析完成后，一次性向用户提出所有问题：

```
我已分析 target/ 目录，识别到以下工程：

{遍历 target/ 下的子目录，每个输出一行}
- {工程名}：{项目类型} - {主要依赖}

需要补充一些信息：

1. 这个项目整体是做什么的？（一句话描述）
2. 目标用户是谁？
```

**条件提问**（与必问合并为一次提问，按实际情况附加）：
- 有后台管理功能？→ 追加：需要定义用户角色吗？
- 有设计稿？→ 追加：Figma 链接？
- target/ 下有后端工程？→ 追加：有接口文档吗？

> 所有问题合并为一次提问，避免多次交互浪费轮次。

---

### 阶段三：文档生成

根据分析和用户输入，生成以下文档。

> **已有文档处理**：如果目标文件已存在（如重复执行 an-init），基于实际情况合并——保留有效内容，补充新增信息，删除过时内容。

#### CLAUDE.md（更新项目背景）

```markdown
## 项目背景

{用户输入的产品描述}

### 工程列表

| 工程 | 类型 | 描述 |
|------|------|------|
| {target下的子目录名} | {项目类型} | {简要说明} |

### 技术栈

{从代码分析得出的技术栈概要}

### 关键链接

| 资源 | 链接 |
|------|------|
| 设计稿 | {用户输入Figma链接，若无则留空} |
| API 文档 | {用户输入，若无则留空} |

## Skill 路由

当用户描述开发意图（如"我要做一个XXX"、"添加XXX"、"修复XXX"、"重构XXX"等）时，
先询问用户是否使用 /an-task 标准工作流推进，提供以下选项：
1. 完整流程（raw-input → requirements → ... → deployment）
2. 快速修复（直接 implementation）
3. 自由对话（不使用工作流）
不要自动启动工作流。
```

#### background/product/overview.md

```markdown
# 产品概述

## 产品名称

{从工程名称或用户输入提取}

## 产品定位

{用户输入}

## 目标用户

{用户输入}

## 技术架构

{描述各工程之间的关系}
```

#### background/tech/stack.md

```markdown
# 技术栈

{按工程分节}

{遍历 target/ 下的子目录，为每个工程生成一节}

## {工程名}

| 技术 | 版本 | 用途 |
|------|------|------|
| ... | ... | ... |

## 工具链

| 工具 | 用途 |
|------|------|
| ... | ... |
```

#### .claude/rules/structure.md

```markdown
---
paths:
  - "target/**"
---

# 目录结构规范

## target/ 目录结构

{扫描 target/ 生成的目录树}

## 工程说明

| 目录 | 工程 | 职责 |
|------|------|------|
| target/{工程A} | {工程A名称} | {说明} |
| target/{工程B} | {工程B名称} | {说明} |
```

> 多工程场景：`paths` 保持 `["target/**"]` 即可覆盖所有工程。

#### .claude/rules/code-style.md

```markdown
---
paths:
  - "target/**/*.{ts,tsx,js,jsx}"
  - "target/**/*.py"
  - "target/**/*.go"
  - "target/**/*.java"
---

# 代码风格规范

## 命名规范

{从代码推断}

## 文件组织

{从代码推断}
```

> 多工程场景：保留所有工程使用的文件后缀。
> 示例：`paths: ["target/**/*.{ts,tsx,js,jsx}", "target/**/*.java"]`

#### workspace/README.md

```markdown
# Workspace 索引

此目录存放活跃项目的工作空间。

## 创建新 Workspace

1. 在此目录下创建 `{feature-name}/`
2. 创建 CLAUDE.md 作为项目索引
3. 按阶段流水线创建子目录：

   raw-input → requirements → design → tech-spec → implementation → testing → deployment
```

---

## 输出格式

**单工程示例**：
```
✅ AI Native 项目初始化完成！

识别到 1 个工程：
- my-project：React 前端 - 基于 Next.js + TypeScript

生成文件：
...
```

**多工程示例**：
```
✅ AI Native 项目初始化完成！

识别到 2 个工程：
- frontend：React 前端 - 基于 Next.js + TypeScript
- backend：NestJS 后端 - Node.js + PostgreSQL

生成文件：
- CLAUDE.md（更新项目背景）
- background/product/overview.md
- background/tech/stack.md（包含 frontend 和 backend 两节）
- .claude/rules/structure.md（包含两个工程的目录结构）
- .claude/rules/code-style.md（paths 包含 .ts 和 .js 文件）
- workspace/README.md

下一步：
1. 在 workspace/ 中创建你的第一个任务工作区
2. 参考 background/ 了解项目背景
3. 规范已写入 .claude/rules/，编辑代码和目录结构时自动生效
```

---

### 阶段四：清理

删除模板专用文件：

1. 删除 `./README.md`（模板说明文档，仅供人类阅读）

---

## 错误处理

| 情况 | 处理 |
|------|------|
| target/ 为空（仅有 .gitkeep） | 停止并提示用户复制代码到 target/ |
| target/ 下无子目录 | 提示用户创建工程子目录 |
| 无法识别技术栈 | 跳过自动识别，询问用户 |
| 用户取消 | 不生成任何文件 |
