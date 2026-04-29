---
name: an-refresh
description: 根据实际代码和结果反向更新 background 背景知识库。当用户想要：1) 刷新/更新 background 文档 2) 代码已变但文档未同步 3) 执行 /an-refresh 命令 4) 提到"更新背景"、"刷新背景"、"同步文档"、"反推文档"等关键词时触发此技能。
---

# 刷新背景知识库

根据 `target/` 中的实际代码和 `workspace/` 中的已完成工作，反向更新 `background/` 文档。

**核心理念**：先有结果，后有文档。当代码先行落地，背景知识需要跟上。

---

## 触发条件

满足任一即可触发：

| 场景 | 示例 |
|------|------|
| 显式调用 | 用户执行 `/an-refresh` |
| 文档过时 | 代码已变更但 background 未同步 |
| 里程碑后 | 完成一个重要功能后需要更新背景 |
| 定期刷新 | 用户主动要求检查并更新 |

---

## 执行流程

```
扫描 → 差异确认 → 更新 → 确认
```

### 阶段一：scan（扫描现状）

**目标**：扫描代码和文档，识别不一致。

**行为**：

优先运行结构化扫描脚本：

```bash
node .claude/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown
```

需要给后续处理保存 JSON 时：

```bash
node .claude/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --write workspace/background-scan.json
```

1. 读取 `background/` 下所有文档，了解当前记录的状态
2. 扫描 `target/` 目录，提取实际信息：
   - 技术栈版本（package.json / go.mod / pom.xml 等）
   - 目录结构变化（新增/删除的模块）
   - 新增的 API 接口、数据模型
   - 配置变更
3. 扫描已完成的 `workspace/` 任务，提取隐含的背景信息：
   - 已上线的功能（更新 features 状态）
   - 已做出的架构决策
   - 已解决的领域问题

自动抽取重点：

| 来源 | 抽取内容 | 更新目标 |
|------|----------|----------|
| package / pyproject / go.mod / pom.xml | 技术栈、版本、脚本、依赖 | `background/tech/stack.md` |
| 路由文件和控制器 | 页面路由、接口端点 | `background/features.md`、`background/domains.md` |
| 数据模型、实体、迁移文件 | 数据模型和领域对象 | `background/domains.md` |
| 测试报告、质量评价报告 | 测试证据和质量状态 | `background/features.md` |
| `.claude/recipes.json` | 验证、构建、代码生成命令 | `.claude/rules/code-style.md` 或 `background/tech/stack.md` |

**产出物**：向用户展示扫描发现，格式如下：

```text
📋 扫描结果

已检查的 background 文档：
- background/product/overview.md
- background/tech/stack.md
- ...

发现的差异：
1. [stack.md] React 版本记录为 18.x，实际为 19.x
2. [overview.md] 缺少已上线的「用户通知」功能模块
3. [structure.md] 新增了 target/apps/notification/ 目录未记录

需要新增的文档：
- background/domains.md（当前不存在，但代码中已出现明显的领域模型）

无需更新的文档：
- background/tech/code-style.md（与实际一致）
```

---

### 阶段二：diff（差异确认）

**目标**：与用户确认哪些差异需要更新。

**行为**：
1. 将扫描发现的差异分类：

| 类别 | 说明 | 默认 |
|------|------|------|
| 必须更新 | 版本不匹配、缺失的模块 | 建议更新 |
| 建议更新 | 可能有用的上下文补充 | 询问用户 |
| 可选更新 | 细节优化、措辞改进 | 跳过 |

2. 向用户确认更新范围

**检查点**：等待用户确认哪些差异需要更新。

---

### 阶段三：update（执行更新）

**目标**：按确认的范围更新 background 文档。

**行为**：
1. 对每个确认的更新项，修改对应的 background 文档
2. 如果需要新增文档，按 `an-init` 中定义的格式创建
3. 保持文档风格与现有 background 一致
4. 在文档末尾附加更新日志：

```markdown
## 更新记录

| 日期 | 更新内容 | 触发来源 |
|------|---------|---------|
| YYYY-MM-DD | {变更摘要} | {an-refresh / 用户指令} |
```

**产出物**：更新后的 `background/` 文档。

---

### 阶段四：confirm（确认完成）

**目标**：展示更新结果，确保一致性。

**行为**：
1. 展示更新摘要：

```text
✅ 背景知识库已刷新

更新文件：
- background/tech/stack.md（更新 React 版本、新增 notification 模块依赖）
- background/product/overview.md（补充通知功能模块描述）

新增文件：
- background/domains.md（从代码中提取领域模型）

未变更：
- background/tech/code-style.md
```

2. 提醒用户是否需要同步更新 `.claude/rules/` 下的规范文件

---

## 支持的更新范围

| 范围 | 说明 | 涉及文件 |
|------|------|---------|
| tech | 技术栈、依赖版本、工具链 | `background/tech/stack.md` |
| product | 产品功能、模块描述 | `background/product/overview.md` |
| domains | 领域模型、业务规则 | `background/domains.md` |
| structure | 目录结构规范 | `.claude/rules/structure.md` |
| code-style | 代码风格 | `.claude/rules/code-style.md` |
| features | 功能状态追踪 | `background/features.md` |
| all | 全部检查 | 以上所有 |

用户可通过参数指定范围：`/an-refresh tech` 只刷新技术栈相关。

---

## 增量更新原则

1. **只更新变化的部分**，不重写整个文件
2. **保留人工补充的内容**，不覆盖用户的自定义描述
3. **标记不确定项**，无法从代码确认的信息标记为 `⚠️ 待确认`
4. **不删除文档**，即使代码中已移除某功能，仅在文档中标注废弃而非删除

---

## 错误处理

| 情况 | 处理 |
|------|------|
| background/ 为空 | 提示用户先执行 `/an-init` |
| target/ 代码无法解析 | 跳过自动分析，提示用户手动提供信息 |
| 文档与代码冲突 | 以代码为准，但标记差异让用户确认 |
| 用户只想部分更新 | 按指定范围执行，跳过其他 |
