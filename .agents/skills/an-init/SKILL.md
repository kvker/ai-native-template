---
name: an-init
description: 将一个或多个已有工作单元或空模板初始化为领域无关的 AI Native 上下文工作区。分析 projects 中的实际材料，生成 background、conventions、recipes 和路由，并安装运行期 Skills。始终使用中文与用户沟通。
---

# AI Native 上下文初始化

将 `projects/` 中的材料纳入通用 AI Context 结构。初始化只整理事实和约定，不创建任务 Artifact，不预设工作区所属行业。

## 前置检查

1. 检查 `projects/` 下的一级子目录，每个子目录视为一个独立工作单元。
2. 已有材料时直接继续。
3. 目录为空或不存在时，询问用户是否从空模板开始；确认后生成最小上下文，不因缺少材料报错。
4. 独立扫描默认可以使用子代理并行执行；环境不支持或用户拒绝时由主代理顺序完成。

## 执行流程

```text
工作区扫描 → 事实整理 → 上下文生成 → 动作探测 → 安装 Skills → 清理模板文件
```

## 一、工作区扫描

扫描每个工作单元，提取可验证事实：

- 目录、文件类型和主要材料
- README、索引、说明和已有规范
- 声明的工具、脚本和可执行动作
- 对外格式、入口、数据结构或其他明确约定
- 命名、文件组织和标注风格

优先并行运行：

```bash
node .agents/skills/an-init/assets/skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json
node .agents/skills/an-init/assets/skills/an-refresh/scripts/scan-projects.mjs --root projects --artifacts artifacts --format markdown
```

所有结论必须来自用户输入或工作区事实。可以基于证据归纳，但必须标注来源；置信度不足时写“待确认”，不得根据目录名编造工作内容。

## 二、事实整理

AI 应先阅读 README、索引、配置、注释和已有文档，自主形成背景草稿。不要要求用户填写能够从材料中获得的信息。

初始化默认不因业务信息缺失而阻塞。只有缺失信息会影响上下文正确性，且无法从材料判断时，才一次性提出必要问题。其他不确定内容写入“待确认”。

## 三、上下文生成

生成或增量更新以下文件。已有文件时保留仍然有效的人工内容，只修改与事实冲突或已经过时的部分。

### 根 AGENTS.md

根入口以路由和必要约束为主，至少包括：

- 工作区定位和已确认的用途
- 工作单元列表及来源
- 模板目录路由
- AI 行为约束
- 必读规范
- 活跃 Artifacts 表
- Skills 路由

根 `AGENTS.md` 的 AI 行为约束必须包含：

```text
当任务需要访问某个目录时，先检查该目录及其相关父级路径中的 AGENTS.md（如存在），再读取或修改其中的文件。不要为此主动遍历无关目录。
```

标准流程必须写为：

```text
raw → requirements → design → spec → execution → review → archive
```

### background/overview.md

```markdown
# 工作区概述

## 定位
{基于材料事实归纳；无法确认时标记待确认}

## 已知目标
{仅记录已有材料或用户明确说明的目标}

## 主要材料
{概括 projects 中的工作单元及关系}

## 待确认
- ...

## 来源
- ...
```

### background/workspaces.md

```markdown
# 工作单元

## {工作单元名称}

- 路径：`projects/{name}`
- 类型：{按材料事实描述，不套行业分类}
- 内容：{主要材料和职责}
- 可用工具/动作：{已发现内容}
- 来源：{README、配置或具体材料路径}
```

### conventions/structure.md

记录 `projects/` 的实际目录结构、各工作单元职责和已确认的组织约定。

### conventions/style-guide.md

只记录能从工作区观察到的命名、文件组织、格式和标注约定；没有稳定规律时保持简短并标记待确认。

### background/AGENTS.md

说明 background 保存稳定背景，默认只读；仅 `/an-init`、`/an-refresh` 或用户明确要求时更新。反推信息必须标注来源和不确定性。

### artifacts/AGENTS.md

使用以下通用结构：

```text
artifacts/{YYYYMMDD}__{task-name}/
├── AGENTS.md
├── raw/
├── requirements/
├── design/
├── spec/
├── execution/
├── review/
└── archive/
```

阶段目录按任务需要创建，不生成空目录。实际交付物写入 `projects/` 或用户指定位置。

### .agents/recipes.json

记录从实际工作区发现的命令和非命令检查动作。无法自动探测的动作由 AI 根据任务和材料选择，不得伪造命令。

## 四、安装运行期 Skills

未并行运行扫描时，先由主代理执行扫描脚本。然后安装 Skills：

```bash
mkdir -p .agents/skills
mv .agents/skills/an-init/assets/skills/* .agents/skills/
rm -rf .agents/skills/an-init
```

运行期 Skills 暂存在 an-init 的 `assets/skills/` 中；由于 OpenCode 的发现机制会递归匹配，它们在模板阶段同样可见，但约定上初始化完成前不使用。初始化完成后将运行期 Skills 移入 `.agents/skills/`，并删除 an-init 自身（含已清空的 assets）。

## 五、清理模板文件

初始化完成后删除：

1. 根 `README.md`。
2. `background/README.md` 和 `artifacts/README.md`（如存在）。
3. `projects/.gitkeep`（如存在）。

不要删除 `AGENTS.md`、背景、规范、已有工作材料或任何用户文件。

## 完成报告

报告识别到的工作单元、生成或更新的文件、动作探测结果、待确认事项和下一步。空工作区只生成最小上下文，并说明 an-init 初始化后会自删，后续可将材料放入 `projects/` 后运行 `/an-refresh` 刷新上下文。

## 错误处理

| 情况 | 处理 |
|------|------|
| 工作区类型无法判断 | 按材料事实描述，不强行分类 |
| 扫描脚本失败 | 报告失败并由主代理使用可用工具继续整理 |
| 部分文件无法读取 | 跳过并记录限制，不阻塞其他工作单元 |
| 用户取消 | 不安装 Skills，不执行模板清理 |
