---
name: an-init
description: 将已有工作单元或空模板初始化为领域无关的 AI Native 上下文工作区。分析 projects 中的材料，生成 background、conventions、recipes 和运行期路由，并安全安装运行期 Skills。始终使用中文与用户沟通。
---

# AI Native 上下文初始化

将 `projects/` 中的材料纳入通用 AI Context 结构。初始化只整理事实和约定，不创建任务 Artifact，不预设行业。

## 一、前置检查

1. 确认当前目录同时包含根 `AGENTS.md`、`artifacts/index.json` 和 `.agents/skills/an-init/SKILL.md`；否则停止，要求从工作区根目录重新执行。
2. 检查 `projects/` 下一级子目录，每个子目录视为独立工作单元。
3. `projects/` 为空或不存在时，一次性询问是否从空模板开始；确认后创建目录并生成最小上下文。
4. 已有材料时直接继续，不要求用户填写能够从材料获得的信息。
5. 独立工作单元默认可以用子代理并行扫描；环境不支持时由主代理顺序完成。

## 二、执行流程

```text
工作区扫描 → 事实整理 → 上下文生成 → 动作探测 → 安装前检查 → 安装 Skills → 报告并重启
```

## 三、工作区扫描

从工作区根目录运行：

```bash
node .agents/skills/an-init/assets/skills/an-recipes/scripts/detect-recipes.mjs --root projects --write .agents/recipes.json
node .agents/skills/an-init/assets/skills/an-refresh/scripts/scan-projects.mjs --root projects --artifacts artifacts --format markdown
```

扫描输出中的 `diagnostics` 非空或 `truncated: true` 时，先针对目标材料补充检查并在报告中说明限制。扫描失败不得解释为“没有内容”。

扫描后按需阅读 README、索引、配置、注释和已有规范，提取：

- 目录、文件类型和主要材料。
- 已明确表达的用途、入口和外部约定。
- 声明的工具、脚本和可执行动作。
- 命名、文件组织和格式规律。

所有结论必须来自用户输入或工作区事实。可以基于证据归纳，但必须标注来源；置信度不足时写“待确认”，不得用领域常识补成已确认事实。

## 四、上下文生成

已有文件时保留仍有效的人工内容，只修改与事实冲突或已经过时的部分。

### 根 AGENTS.md

改写为运行期路由，至少包含：

- 已确认的工作区定位和工作单元路由。
- 目录职责和敏感文件约束。
- 必读规范。
- 指向 `artifacts/index.json` 的任务状态路由。
- `$an-task`、`$an-task-split`、`$an-recipes`、`$an-refresh`、`$an-review`、`$an-archive` 的运行期 Skill 路由。
- `$an-task` 触发规则：用户明确下达“开始吧”“开始做”“实现”“动手”“开工”等进入执行态的指令时，无论此前讨论多少轮，都必须先经 `$an-task` 分流；该规则写入运行期根 AGENTS。
- `$an-task` 规模规则：小改动只允许不创建 Artifact，不允许跳过分流；预计变更涉及 3 个以上文件或跨前后端时至少使用 L2。

移除原模板阶段说明，但在安装完成前保留以下唯一待完成路由块；所有 `$an-init` 和 `.agents/skills/an-init` 引用都必须放在块内：

```markdown
<!-- an-init-pending:start -->
初始化尚未完成时，使用 `$an-init` 继续；入口位于 `.agents/skills/an-init/`。
<!-- an-init-pending:end -->
```

根文件不复制活跃任务表或流程正文。安装器在所有运行期 Skill 提交成功后原子移除该块；失败或取消时该入口仍可重试。

根 AI 行为约束必须包含：

```text
当任务需要访问某个目录时，先检查该目录及其相关父级路径中的 AGENTS.md（如存在），再读取或修改其中的文件。不要为此主动遍历无关目录。
```

### README.md

将模板 README 改写为当前工作区的人类概览，至少说明用途、工作单元、目录、运行期 Skills 和启动方式。必须移除 `<!-- ai-native-template-readme -->` 标记；不要删除用户 README。

### background

生成或更新：

- `background/overview.md`：定位、已知目标、主要材料、待确认和来源。
- `background/workspaces.md`：每个工作单元的路径、类型、内容、动作和来源。
- `background/AGENTS.md`：稳定但可刷新、任务默认只读、已确认与待确认分离。

不要创建 `background/product/overview.md` 等行业固定路径。

### conventions

- `conventions/structure.md`：实际目录结构和工作单元职责。
- `conventions/style-guide.md`：有证据的命名、文件组织、格式和标注约定；没有稳定规律时保持简短。
- 保留 `workflow.md`、`flow-policy.md`、`document.md`、`principles.md` 和 `rules.md` 的通用机器契约，不把业务事实复制进去。

### artifacts

确认 `artifacts/index.json` 符合：

```json
{
  "schemaVersion": 1,
  "active": []
}
```

初始化不创建任务 Artifact。Artifact 的机器契约统一引用 `conventions/workflow.md`。

### recipes

`.agents/recipes.json` 只记录从实际工作区发现的动作。命令必须有声明依据；无法自动执行的检查使用 inspection，不伪造命令。

## 五、安全安装运行期 Skills

先预检：

```bash
node .agents/skills/an-init/scripts/install-runtime.mjs --root . --dry-run
```

确认预检列出的 Skills、根路由和 README 均正确后执行：

```bash
node .agents/skills/an-init/scripts/install-runtime.mjs --root .
```

安装器先复制到 staging 并验证所有 Skill，再提交目标、原子移除待完成路由块，并将 `an-init` 退出发现路径。提交前失败会恢复根 AGENTS、已提交目标和 `an-init`；提交成功后的旧副本清理失败只报告 warning，不回滚已安装 Skills。不要手工执行 `mv ...; rm -rf ...`。

## 六、完成报告

报告：

- 识别到的工作单元和来源。
- 生成或更新的文件。
- 动作探测结果、diagnostics 和截断限制。
- 待确认事项。
- 安装结果。

明确告知用户：OpenCode、Codex 和其他启动时加载 Skill 的客户端必须退出并重启，运行期 Skills 才会生效。不要在当前会话继续调用新安装的 `$an-refresh` 或 `$an-task`。

## 错误处理

| 情况 | 处理 |
|------|------|
| 当前目录不是工作区根 | 停止，不执行扫描、安装或清理 |
| 空工作区未获确认 | 停止，不安装 Skills |
| 扫描脚本失败 | 报告失败并用可用工具继续整理；不得把失败记为空结果 |
| 部分文件无法读取 | 跳过并记录路径和限制 |
| 安装预检失败 | 修复根路由、README 或目标冲突后重新预检 |
| 安装提交失败 | 保留待完成路由和 an-init，报告回滚结果后可直接重试 |
| 旧 an-init 副本清理 warning | 运行期 Skills 已安装；报告残留路径，不反向回滚 |
| 用户取消 | 不安装 Skills；若已生成运行期文档，保留待完成路由块以便重试 |
