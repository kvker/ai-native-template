---
name: an-refresh
description: 根据 projects 中的实际材料和已归档任务反向更新 background 与工作区结构说明。工作区内容变化、背景文档过时或用户要求刷新上下文时使用。
---

# 刷新背景知识

根据工作区事实增量更新上下文，不预设工作类型，不把任务过程直接写成长期背景。

## 流程

```text
扫描 → 比较 → 更新 → 报告
```

## 扫描

```bash
node .agents/skills/an-refresh/scripts/scan-projects.mjs --root projects --artifacts artifacts --format markdown
```

需要保存结构化结果时：

```bash
node .agents/skills/an-refresh/scripts/scan-projects.mjs --root projects --artifacts artifacts --write .agents/background-scan.json
```

扫描内容包括：

- 工作单元、目录、文件类型和主要材料变化
- README、索引、配置和已有说明中明确表达的用途
- 声明的工具、脚本和可复用动作
- 已归档任务的 Review 结论和完结摘要
- 现有 background 与实际材料之间的差异

扫描结果标记 `truncated: true` 时，只能作为部分清单使用；必须扩大扫描范围或针对目标材料继续检查，不能据此断言工作区不存在其他内容。

## 更新

1. 读取 `background/` 和相关 `conventions/` 文档。
2. 将扫描结果与现有记录比较，只更新有事实依据的变化。
3. 明显事实变化可直接更新；涉及主题定位、业务含义或用户意图且证据不足时标记待确认。
4. 保留仍有效的人工内容，不整篇重写，不因材料暂时缺失而直接删除背景记录。
5. 更新后报告变更、来源、未变更项和待确认项。

## 默认更新目标

| 内容 | 目标 |
|------|------|
| 工作区定位和主要材料 | `background/overview.md` |
| 工作单元内容、关系和可用动作 | `background/workspaces.md` |
| 目录与组织方式 | `conventions/structure.md` |
| 命名、格式和标注约定 | `conventions/style-guide.md` |
| 稳定领域事实 | 已存在的相关 background 文档 |

只有事实足以支撑且有长期复用价值时才新增背景文档。不要固定要求 `product`、`tech`、`domains` 或 `features` 等行业相关文件。

## 约束

- `projects/` 和用户明确输入是事实来源；冲突时报告差异。
- Artifact 只有归档且 Review 结论可接受时，才能作为背景更新线索。
- 一次性执行细节、临时问题和未确认推断不进入稳定背景。
- 扫描脚本无法识别语义时，由 AI 阅读实际材料补充，不把文件名当成业务事实。
