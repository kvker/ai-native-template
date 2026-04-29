---
name: an-refresh
description: 根据 target 代码和已完成的 workspace 记录刷新 AI Native 背景知识。用户执行 $an-refresh，或要求同步、更新、重新生成背景文档时使用。
---

# 刷新背景知识库

根据 `target/` 的实际代码和已完成 `workspace/` 任务，增量更新 `background/` 与相关规范。

## 触发场景

| 场景 | 示例 |
|------|------|
| 显式调用 | `$an-refresh` |
| 文档过时 | 代码已变，但背景知识未同步 |
| 里程碑后 | 重要功能完成，需要沉淀背景 |
| 定期检查 | 用户要求检查背景是否准确 |

## 流程

```text
扫描 -> 差异确认 -> 更新 -> 报告
```

## 扫描

优先运行结构化扫描脚本：

```bash
node .agents/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --format markdown
```

需要给后续处理保存 JSON 时：

```bash
node .agents/skills/an-refresh/scripts/scan-target.mjs --root target --workspace workspace --write workspace/background-scan.json
```

读取：

- `background/` 中已有文档。
- 已完成或相关的 `workspace/` 任务索引与报告。
- `target/` 中的清单文件、接口、模型、配置和目录结构。
- `.agents/recipes.json` 中的可执行命令。

跳过密钥、依赖、构建产物、缓存、日志和大型生成文件。

自动抽取重点：

| 来源 | 抽取内容 | 更新目标 |
|------|----------|----------|
| package / pyproject / go.mod / pom.xml | 技术栈、版本、脚本、依赖 | `background/tech/stack.md` |
| 路由文件和控制器 | 页面路由、接口端点 | `background/features.md`、`background/domains.md` |
| 数据模型、实体、迁移文件 | 数据模型和领域对象 | `background/domains.md` |
| 测试报告、质量评价报告 | 测试证据和质量状态 | `background/features.md` |
| `.agents/recipes.json` | 验证、构建、代码生成命令 | `.agents/rules/code-style.md` 或 `background/tech/stack.md` |

## 差异确认

分类差异：

| 类别 | 说明 | 默认处理 |
|------|------|----------|
| 必须更新 | 版本、模块、接口、功能状态明显不一致 | 建议更新 |
| 建议更新 | 能提升 Codex 理解的背景补充 | 询问 |
| 可选更新 | 措辞、格式、低价值细节 | 默认跳过 |

先向用户展示发现和建议范围，除非用户明确要求直接全部刷新。

## 更新

按确认范围增量修改：

- `background/product/overview.md`
- `background/tech/stack.md`
- `background/domains.md`
- `background/features.md`
- `.agents/rules/structure.md`
- `.agents/rules/code-style.md`
- `.agents/recipes.json`
- `target/AGENTS.md`
- 根 `AGENTS.md` 的项目背景或工程列表

规则：

- 保留人工补充内容。
- 不确定项标记为“待确认”。
- 功能被移除时标记废弃，不直接删除历史背景。
- 必要时在文档末尾添加更新记录：

```markdown
## 更新记录

| 日期 | 更新内容 | 触发来源 |
|------|----------|----------|
| YYYY-MM-DD | {摘要} | an-refresh |
```

## 报告

完成后报告：

- 更新文件。
- 新增文件。
- 未更新但建议关注的差异。
- 无法确认的信息和剩余风险。
