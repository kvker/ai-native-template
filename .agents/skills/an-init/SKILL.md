---
name: an-init
description: 将 target/ 中的已有工程初始化为 Codex 原生的 AI Native 项目。用户执行 $an-init，或要求迁移已有项目到该模板时使用。除非用户另有要求，始终使用中文沟通。
---

# AI Native 项目初始化

将 `target/` 中的已有工程转换为 Codex 原生的 AI Native 项目结构。

## 前置检查

1. 检查 `target/` 是否存在实际工程子目录。
2. 如果 `target/` 为空或只有占位文件，停止并提示用户复制代码：

```text
target/ 目录目前没有可初始化的工程。

单项目：
cp -r /path/to/your-project ./target/my-project

多项目：
cp -r /path/to/frontend ./target/frontend
cp -r /path/to/backend ./target/backend
```

3. 检查工作树状态，避免覆盖用户已有修改。
4. 主动询问是否使用子代理并行处理可独立扫描任务：

```text
我可以用两个子代理并行处理初始化中的独立扫描：

1. 命令清单子代理：探测测试、构建、代码检查、类型检查、代码生成命令并生成 .agents/recipes.json
2. 背景扫描子代理：抽取依赖包、路由、接口、数据模型、测试报告线索

是否使用子代理并行处理这两项？如果不用，我会在主流程中顺序执行同样脚本。
```

用户明确同意后再启动子代理；用户拒绝、跳过或当前环境不支持子代理时，主代理本地顺序执行同样脚本。

## 阶段一：客观扫描

### 子代理并行策略

`$an-init` 可以拆成“主代理 + 辅助子代理”执行，以减少主上下文负担：

| 执行者 | 职责 | 输出 |
|--------|------|------|
| 主代理 | 识别工程、提问、合并文档、最终报告 | `AGENTS.md`、`background/`、`.agents/rules/` |
| 命令清单子代理 | 探测测试、构建、代码检查、类型检查、代码生成命令 | `.agents/recipes.json` 和命令摘要 |
| 背景扫描子代理 | 抽取依赖包、路由、接口、数据模型、测试报告线索 | 背景扫描摘要 |

只有用户在前置检查中明确同意时，才启动 Codex 子代理。若当前环境不支持子代理，或用户未授权并行代理，则由主代理按相同命令本地顺序执行。

命令清单子代理任务：

```text
在当前仓库中运行：
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .agents/recipes.json

返回：
1. 识别到的工程和命令数量
2. 每个工程的测试、构建、代码检查、类型检查、代码生成命令
3. 低置信度或缺失的命令
```

背景扫描子代理任务：

```text
在当前仓库中运行：
node .agents/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown

返回：
1. 依赖包、脚本、依赖摘要
2. 路由和接口线索
3. 数据模型、领域模型线索
4. 测试报告和质量评价报告线索
5. 需要主代理人工判断的待确认项
```

对 `target/` 下每个一级子目录分别分析：

| 信号文件 | 可能类型 |
|----------|----------|
| package.json + react | React 前端 |
| package.json + vue | Vue 前端 |
| package.json + next | Next.js 全栈 |
| package.json + express | Express 后端 |
| package.json + nest | NestJS 后端 |
| pyproject.toml / requirements.txt | Python |
| go.mod | Go |
| pom.xml / build.gradle | Java |
| Cargo.toml | Rust |

扫描内容：

- 技术栈、核心依赖和包管理器。
- 目录结构和模块职责。
- 代码风格、命名、测试方式。
- 可运行脚本和验证命令。
- 命令清单子代理和背景扫描子代理返回的结构化摘要。

跳过内容：

- `node_modules/`、`dist/`、`build/`、`.next/`、缓存、日志、锁文件大段内容。
- `.env*`、`secrets/**`、凭据文件。

## 阶段二：一次性交互提问

扫描完成后，一次性向用户确认缺失信息：

```text
我已分析 target/，识别到以下工程：

- {工程名}: {项目类型} - {主要依赖/脚本}

需要补充：
1. 这个产品一句话是做什么的？
2. 目标用户是谁？
3. 是否有设计稿、接口文档或部署文档链接？
4. 多工程之间的职责关系是否符合我的判断？
```

只问客观扫描无法确认、但会影响背景文档质量的问题。

## 阶段三：生成或合并文档

重复执行 `$an-init` 时采用增量合并，保留有效人工内容，删除明显过时的信息，并标注待确认项。

需要生成或更新：

| 文件 | 内容 |
|------|------|
| `AGENTS.md` | 项目背景、工程列表、技术栈概要、关键链接、活跃工作区表 |
| `background/product/overview.md` | 产品定位、目标用户、工程关系 |
| `background/tech/stack.md` | 各工程技术栈、版本、工具链和验证命令 |
| `.agents/rules/structure.md` | `target/` 实际目录结构和工程职责 |
| `.agents/rules/code-style.md` | 从代码推断的命名、文件组织、测试和格式化约定 |
| `.agents/recipes.json` | 由 `$an-recipes` 探测得到的验证、构建、生成和开发命令清单 |
| `workspace/README.md` | 工作区索引和创建规则 |
| `target/AGENTS.md` | 实际代码目录的 Codex 行为约束 |

`AGENTS.md` 的项目背景段落建议格式：

```markdown
## 项目背景

{产品一句话描述}

### 工程列表

| 工程 | 类型 | 描述 |
|------|------|------|
| target/{name} | {类型} | {职责} |

### 技术栈

{从代码分析得到的摘要}

### 关键链接

| 资源 | 链接 |
|------|------|
| 设计稿 | {如有} |
| 接口文档 | {如有} |
```

## 阶段四：结果报告

如果未使用命令清单子代理，生成文档后运行命令探测：

```bash
node .agents/skills/an-recipes/scripts/detect-recipes.mjs --root target --write .agents/recipes.json
```

如果未使用背景扫描子代理，需要本地运行背景扫描并将结果纳入文档：

```bash
node .agents/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown
```

报告应包含：

- 识别到的工程列表。
- 新增和更新的文件。
- 生成的可执行命令清单。
- 背景扫描摘要，包括接口、路由、数据模型和测试线索。
- 仍需用户确认的信息。
- 推荐下一步，例如使用 `$an-task` 创建第一个任务。

不要自动删除模板 README；如果用户明确希望正式项目不保留模板说明，再删除或精简。
