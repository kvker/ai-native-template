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
2. **询问是否使用子代理并行处理独立扫描**

   ```
   我可以用两个子代理并行处理初始化中的独立扫描：

   1. 命令清单子代理：探测测试、构建、代码检查、类型检查、代码生成命令并生成 .claude/recipes.json
   2. 背景扫描子代理：抽取依赖包、路由、接口、数据模型、测试报告线索

   是否使用子代理并行处理这两项？如果不用，我会在主流程中顺序执行同样脚本。
   ```

   用户明确同意后再启动子代理；用户拒绝、跳过或当前环境不支持子代理时，主代理本地顺序执行同样脚本。

---

## 执行流程

### 阶段一：代码分析（静默执行）

扫描 `target/` 目录下的每个子目录，提取客观信息：

**子代理并行策略**：

| 执行者 | 职责 | 输出 |
|--------|------|------|
| 主代理 | 识别工程、提问、合并文档、最终报告 | `CLAUDE.md`、`background/`、`.claude/rules/` |
| 命令清单子代理 | 探测测试、构建、代码检查、类型检查、代码生成命令 | `.claude/recipes.json` 和命令摘要 |
| 背景扫描子代理 | 抽取依赖包、路由、接口、数据模型、测试报告线索 | 背景扫描摘要 |

命令清单子代理任务：

```text
在当前仓库中运行：
node .claude/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .claude/recipes.json

返回：
1. 识别到的工程和命令数量
2. 每个工程的测试、构建、代码检查、类型检查、代码生成命令
3. 低置信度或缺失的命令
```

背景扫描子代理任务：

```text
在当前仓库中运行：
node .claude/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown

返回：
1. 依赖包、脚本、依赖摘要
2. 路由和接口线索
3. 数据模型、领域模型线索
4. 测试报告和质量评价报告线索
5. 需要主代理人工判断的待确认项
```

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
- 命令清单子代理和背景扫描子代理返回的结构化摘要

**分析原则**：

- 所有结论必须基于代码中的客观事实（文件存在性、依赖列表、脚本名）。
- 禁止根据文件名、目录名推测业务功能、用户意图或未实现的需求。
- 无法确认的信息标记为"待确认"，不得编造。

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

**条件提问**（与必问合并为一次提问）：

条件问题只能基于代码中的**可验证事实**决定是否附加：

| 代码事实 | 附加问题 |
|----------|----------|
| 检测到后端框架（express/nest/fastapi/spring 等） | 是否有接口文档链接？ |
| 检测到 UI 框架（react/vue 等） | 是否有设计稿链接（如 Figma）？ |

- 禁止 AI 自行判断"是否有后台管理功能"等无法从代码客观验证的事项。
- 如果无法确定是否满足条件，默认附加问题而非跳过。

> 所有问题合并为一次提问，避免多次交互浪费轮次。

---

### 阶段三：文档生成

根据分析和用户输入，生成以下文档。

> **文档生成原则**：文档中的每条信息只能来自两个来源——①用户明确输入 ②代码客观分析。禁止编造、推测或填充未经验证的信息。无法确认的内容标记为"待确认"或留空。

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

## 工作流阶段

| 阶段 | 说明 |
|------|------|
| raw-input | 原始输入，原模原样保存用户描述 |
| requirements | 基于 raw-input 生成的技术可理解的需求 |
| design | 技术选型，讨论采用什么方案 |
| tech-spec | 技术规范，输出可执行的变更清单 |
| implementation | 按变更清单写代码 |
| testing | 基于前面的规范生成测试用例并执行测试 |
| deployment | 部署上线 |

## AI 行为约束

- 禁止自行脑补未提及的需求、功能或业务逻辑。
- 所有背景知识必须来自代码事实或用户明确输入。
- 从代码反推的信息要标注来源；无法确认的信息标记为"待确认"。

## Skill 路由

当用户描述开发意图（如"我要做一个XXX"、"添加XXX"、"修复XXX"、"重构XXX"等）时，
先询问用户是否使用 /an-task 标准工作流推进，提供以下选项：
1. 完整流程（raw-input → requirements → design → tech-spec → implementation → testing → deployment）
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

#### background/CLAUDE.md

```markdown
# background 目录说明

`background/` 存放项目的稳定背景知识，包括产品定位、领域模型、技术栈、架构决策和功能状态。

## AI 行为

- 需要理解业务或技术背景时，按需读取相关文档。
- 除 `/an-init`、`/an-refresh` 或用户明确要求外，不主动修改本目录。
- 更新时保持增量，不重写人工补充内容。
- 从代码反推的信息要标注来源；无法确认的信息标记为“待确认”。
- 背景文档与 `target/` 代码冲突时，先以代码事实为准，并在更新摘要中说明冲突。
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

#### .claude/recipes.json

由 `/an-recipes` 或命令清单子代理探测生成，记录验证、构建、生成和开发命令清单。

#### workspace/CLAUDE.md

```markdown
# workspace 目录说明

`workspace/` 存放活跃任务工作区。每个任务使用独立目录，命名为 `YYYYMMDD__feature-name`。

## 约定结构

workspace/{YYYYMMDD}__{feature-name}/
├── CLAUDE.md
├── raw-input/
├── requirements/
├── design/
├── tech-spec/
├── implementation/
├── testing/
└── deployment/

## AI 行为

- 新任务优先创建独立工作区，并在根 `CLAUDE.md` 的活跃 Workspace 表中登记。
- 工作区只存过程文档、决策、报告和临时分析，不存放最终产品代码。
- 每个工作区可包含自己的 `CLAUDE.md` 作为任务索引。
- 任务完成后，可使用 `/an-archive` 移动到 `workspace/archive/`。
- 恢复历史任务时先匹配目录名，再读取对应工作区内容，避免无谓加载大量文档。
```

初始化完成后不保留 `background/README.md` 或 `workspace/README.md`。目录级说明统一放入对应的 `CLAUDE.md`，避免 README 与 CLAUDE 双入口漂移。

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
- .claude/recipes.json（可执行命令清单）
- background/CLAUDE.md
- workspace/CLAUDE.md

下一步：
1. 在 workspace/ 中创建你的第一个任务工作区
2. 参考 background/ 了解项目背景
3. 规范已写入 .claude/rules/，编辑代码和目录结构时自动生效
```

---

### 阶段四：清理

删除模板专用文件：

1. 删除 `./README.md`（模板说明文档，仅供人类阅读）
2. 删除 `background/README.md` 和 `workspace/README.md`（如存在），目录级说明统一使用 `CLAUDE.md`

如果未使用命令清单子代理，生成文档后运行命令探测：

```bash
node .claude/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .claude/recipes.json
```

如果未使用背景扫描子代理，需要本地运行背景扫描并将结果纳入文档：

```bash
node .claude/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown
```

---

## 错误处理

| 情况 | 处理 |
|------|------|
| target/ 为空（仅有 .gitkeep） | 停止并提示用户复制代码到 target/ |
| target/ 下无子目录 | 提示用户创建工程子目录 |
| 无法识别技术栈 | 跳过自动识别，询问用户 |
| 用户取消 | 不生成任何文件 |
