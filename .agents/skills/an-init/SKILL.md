---
name: an-init
description: 将现有工程转换为 AI Native 项目结构。当用户想要：1) 将现有项目转换为 AI Native 格式 2) 为已有代码生成 background/conventions/artifacts 文档 3) 执行 /an-init 命令 4) 让 AI 理解并接管现有项目 时触发此技能。**始终使用中文与用户沟通。**
---

# AI Native 项目初始化

将现有工程转换为 AI Native 项目结构。

支持将一个或多个项目复制到 `projects/` 目录，每个子目录视为一个独立工程。

## 前置检查

执行前检查：

1. **检查 `projects/` 目录内容**
   - 如果有代码：继续执行
   - 如果为空（仅有 `.gitkeep`）：
     ```
     ⚠️ projects/ 目录为空

     请将你的现有工程代码复制到 projects/ 目录：

     单项目：
     cp -r /path/to/project ./projects/project

     多项目：
     cp -r /path/to/project-a ./projects/project-a
     cp -r /path/to/project-b ./projects/project-b

     完成后重新执行 /an-init
     ```
     然后停止执行
2. **询问是否使用子代理并行处理独立扫描**

   ```
   我可以用两个子代理并行处理初始化中的独立扫描：

   1. 命令清单子代理：探测测试、构建、代码检查、类型检查、代码生成命令并生成 .agents/recipes.json
   2. 背景扫描子代理：抽取依赖、结构、接口、模型、测试报告线索

   是否使用子代理并行处理这两项？如果不用，我会在主流程中顺序执行同样脚本。
   ```

   用户明确同意后再启动子代理；用户拒绝、跳过或当前环境不支持子代理时，主代理本地顺序执行同样脚本。

---

## 执行流程

### 阶段一：代码分析（静默执行）

扫描 `projects/` 目录下的每个子目录，提取客观信息：

**子代理并行策略**：

| 执行者 | 职责 | 输出 |
|--------|------|------|
| 主代理 | 识别工程、提问、合并文档、最终报告 | `AGENTS.md`、`background/`、`conventions/` |
| 命令清单子代理 | 探测测试、构建、代码检查、类型检查、代码生成命令 | `.agents/recipes.json` 和命令摘要 |
| 背景扫描子代理 | 抽取依赖、结构、接口、模型、测试报告线索 | 背景扫描摘要 |

命令清单子代理任务：

```text
在当前仓库中运行：
node skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json

返回：
1. 识别到的工程和命令数量
2. 每个工程的测试、构建、代码检查、类型检查、代码生成命令
3. 低置信度或缺失的命令
```

背景扫描子代理任务：

```text
在当前仓库中运行：
node skills/an-refresh/scripts/scan-projects.mjs --root projects --artifacts artifacts --format markdown

返回：
1. 依赖、脚本和工具链摘要
2. 对外入口和交互边界线索
3. 数据结构和领域模型线索
4. 测试报告和质量评价报告线索
5. 需要主代理人工判断的待确认项
```

**项目列表识别**：
- 扫描 `projects/` 下的所有一级子目录
- 每个子目录视为一个独立工程

**技术栈识别**（对每个工程分别执行以下检查）：

```
对每个工程子目录：
1. 进入 projects/{工程名}/
2. 检查是否存在能表明工程类型的特征文件
3. 根据文件内容总结技术栈
```

| 证据 | 输出 |
|------|------|
| 特征文件、依赖、脚本、配置 | 技术栈摘要 |
| 目录结构和入口文件 | 工程职责摘要 |
| 构建、测试、代码检查配置 | 可执行命令线索 |

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
我已分析 projects/ 目录，识别到以下工程：

{遍历 projects/ 下的子目录，每个输出一行}
- {工程名}：{项目类型} - {主要依赖}

需要补充一些信息：

1. 这个项目整体是做什么的？（一句话描述）
2. 目标用户是谁？
```

**条件提问**（与必问合并为一次提问）：

条件问题只能基于代码中的**可验证事实**决定是否附加：

| 代码事实 | 附加问题 |
|----------|----------|
| 检测到对外接口或服务入口 | 是否有接口、协议或集成文档？ |
| 检测到用户界面相关工程 | 是否有设计稿或交互规范？ |

- 禁止 AI 自行判断"是否有后台管理功能"等无法从代码客观验证的事项。
- 如果无法确定是否满足条件，默认附加问题而非跳过。

> 所有问题合并为一次提问，避免多次交互浪费轮次。

---

### 阶段三：文档生成

根据分析和用户输入，生成以下文档。

> **文档生成原则**：文档中的每条信息只能来自两个来源——①用户明确输入 ②代码客观分析。禁止编造、推测或填充未经验证的信息。无法确认的内容标记为"待确认"或留空。

> **已有文档处理**：如果目标文件已存在（如重复执行 an-init），基于实际情况合并——保留有效内容，补充新增信息，删除过时内容。

#### AGENTS.md（更新项目背景）

```markdown
## 项目背景

{用户输入的产品描述}

> **缩写说明**：对话中出现的 "AN" 一般指 AI Native 的缩写。

### 工程列表

| 工程 | 类型 | 描述 |
|------|------|------|
| {projects下的子目录名} | {项目类型} | {简要说明} |

### 必读文档

| 路径 | 描述 |
|------|------|
| background/ | 项目背景知识 |
| conventions/ | 项目约定规范、对话长期规则与优化记录 |

### 技术栈

{从代码分析得出的技术栈概要}

### 关键链接

| 资源 | 链接 |
|------|------|
| 设计或交互文档 | {用户输入，若无则留空} |
| 对外契约文档 | {用户输入，若无则留空} |

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

## 必读规范

| 规范 | 用途 |
|------|------|
| [rules](conventions/rules.md) | 对话过程中的长期记忆感知与沉淀 |
| [memories](conventions/memories/AGENTS.md) | 对话优化记录索引 |

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

{遍历 projects/ 下的子目录，为每个工程生成一节}

## {工程名}

| 技术 | 版本 | 用途 |
|------|------|------|
| ... | ... | ... |

## 工具链

| 工具 | 用途 |
|------|------|
| ... | ... |
```

#### background/AGENTS.md

```markdown
# background 目录说明

`background/` 存放项目的稳定背景知识，包括产品定位、领域模型、技术栈、架构决策和功能状态。

## AI 行为

- 需要理解业务或技术背景时，按需读取相关文档。
- 除 `/an-init`、`/an-refresh` 或用户明确要求外，不主动修改本目录。
- 更新时保持增量，不重写人工补充内容。
- 从代码反推的信息要标注来源；无法确认的信息标记为“待确认”。
- 背景文档与 `projects/` 代码冲突时，先以代码事实为准，并在更新摘要中说明冲突。
```

# 目录结构规范

## projects/ 目录结构

{扫描 projects/ 生成的目录树}

## 工程说明

| 目录 | 工程 | 职责 |
|------|------|------|
| projects/{工程A} | {工程A名称} | {说明} |
| projects/{工程B} | {工程B名称} | {说明} |
```

# 代码风格规范

## 命名规范

{从代码推断}

## 文件组织

{从代码推断}
```

#### .agents/recipes.json

由 `/an-recipes` 或命令清单子代理探测生成，记录验证、构建、生成和开发命令清单。

#### conventions/rules.md

```markdown
# 对话长期记忆规则

## 目标

AI 在任意对话过程中持续感知用户是否正在“纠错、约束、提升”AI 的工作方式。若满足长期沉淀条件，应写入 `conventions/memories/` 中对应功能主题文件；若同名主题已存在，则追加到该文件。

## 写入规则

- `conventions/rules.md` 只保存长期记忆机制的指导规则，不作为具体记忆内容的回写目标。
- `conventions/memories/` 保存具体优化记录、来源、分类、判断依据和后续追加内容。
- memory 文件使用功能性名字，不带日期，例如 `dialog-memory.md`、`git-workflow.md`。
- 写入前先查找同名或同主题 memory 文件；找到则追加，找不到才创建新文件。
- 不要把对话流水直接追加到 `rules.md`；具体记录写入 `memories/`。
- 不写入密钥、凭据、隐私数据、临时路径或不可泛化的上下文。
```

#### conventions/memories/AGENTS.md

```markdown
# memories

| Memory | 描述 |
|--------|------|
| - | - |
```

#### artifacts/AGENTS.md

```markdown
# artifacts 目录说明

`artifacts/` 存放任务产出。每个任务使用独立目录，命名为 `YYYYMMDD__feature-name`。

## 约定结构

artifacts/{YYYYMMDD}__{feature-name}/
├── AGENTS.md
├── raw-input/
├── requirements/
├── design/
├── tech-spec/
├── implementation/
├── testing/
└── deployment/

## AI 行为

- 新任务优先创建独立产出目录，并在根 `AGENTS.md` 的活跃 Artifacts 表中登记。
- 产出目录只存过程文档、决策、报告和临时分析，不存放最终产品代码。
- 每个产出目录可包含自己的 `AGENTS.md` 作为任务索引。
- 任务完成后，可使用 `/an-archive` 移动到 `artifacts/archive/`。
- 恢复历史任务时先匹配目录名，再读取对应产出内容，避免无谓加载大量文档。
```

初始化完成后不保留 `background/README.md` 或 `artifacts/README.md`。目录级说明统一放入对应的 `AGENTS.md`，避免 README 与 Codex 双入口漂移。

---

## 输出格式

**单工程示例**：
```
✅ AI Native 项目初始化完成！

识别到 1 个工程：
- project-a：{工程类型} - {主要技术摘要}

生成文件：
...
```

**多工程示例**：
```
✅ AI Native 项目初始化完成！

识别到 2 个工程：
- project-a：{工程类型} - {主要技术摘要}
- project-b：{工程类型} - {主要技术摘要}

生成文件：
- AGENTS.md（更新项目背景）
- background/product/overview.md
- background/tech/stack.md（按工程记录技术栈）
- conventions/structure.md（包含两个工程的目录结构）
- conventions/code-style.md（包含代码风格约定）
- conventions/rules.md（对话长期记忆机制）
- conventions/memories/AGENTS.md（对话优化记录索引）
- .agents/recipes.json（可执行命令清单）
- background/AGENTS.md
- artifacts/AGENTS.md

下一步：
1. 在 artifacts/ 中创建你的第一个任务产出目录
2. 参考 background/ 了解项目背景
3. 规范已写入 conventions/，编辑代码、目录结构和对话长期记忆时自动生效
```

---

### 阶段四：安装项目技能与清理

如果未使用命令清单子代理，生成文档后运行命令探测：

```bash
node skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json
```

如果未使用背景扫描子代理，需要本地运行背景扫描并将结果纳入文档：

```bash
node skills/an-refresh/scripts/scan-projects.mjs --root projects --artifacts artifacts --format markdown
```

初始化完成后，将项目运行期技能安装到激活目录：

```bash
mkdir -p .agents/skills
mv skills/* .agents/skills/
rmdir skills
```

安装规则：

- `.agents/skills/an-init/` 在模板阶段保留，用于自动激活初始化能力。
- `skills/` 暂存目录中的其他技能不在模板阶段激活；只在初始化完成后移动到 `.agents/skills/`。
- 移动完成后删除空的 `skills/` 目录，避免项目中保留模板暂存结构。

删除模板专用文件：

1. 删除 `./README.md`（模板说明文档，仅供人类阅读）
2. 删除 `background/README.md` 和 `artifacts/README.md`（如存在），目录级说明统一使用 `AGENTS.md`
3. 删除 `projects/.gitkeep`（初始化占位文件，如存在）

---

## 错误处理

| 情况 | 处理 |
|------|------|
| projects/ 为空（仅有 .gitkeep） | 停止并提示用户复制代码到 projects/ |
| projects/ 下无子目录 | 提示用户创建工程子目录 |
| 无法识别技术栈 | 跳过自动识别，询问用户 |
| 用户取消 | 不生成任何文件 |
