---
name: an-review
description: 按 requirements 的完成标准和 spec 的检查计划审阅实际产出，执行适合当前任务的检查，处理问题并给出 PASS、REVIEW 或 BLOCKED 结论。任务执行后、归档前或用户询问任务是否完成时使用。
---

# AI Native 任务 Review

检查实际产出是否达到完成标准。Review 合并检查过程和质量判断，不预设工作类型或检查工具。

## 执行流程

1. 读取 Artifact 的 requirements、spec、execution 记录和实际产出。
2. 将每项完成标准映射到一个或多个检查动作。
3. 优先使用 `.agents/recipes.json` 中适用的动作；没有时根据材料设计检查方式。
4. 执行命令、材料核对、内容审阅、结果预览或必要确认，并保存证据。
5. 可自行修复的问题先修复，然后重新检查。
6. 将结果写入 `review/review-report.md`。
7. 运行结构一致性检查，确认报告具有明确结论且不存在与结论冲突的开放标准。

```bash
node .agents/skills/an-review/scripts/review-task.mjs artifacts/{YYYYMMDD}__{task-name}
```

轻量 L1 Artifact 没有 requirements 时使用：

```bash
node .agents/skills/an-review/scripts/review-task.mjs artifacts/{YYYYMMDD}__{task-name} --level L1
```

脚本退出码：`0` 表示 PASS，`3` 表示 REVIEW，`1` 表示 BLOCKED，`2` 表示调用错误。`REVIEW` 不是 `BLOCKED`，是否接受剩余复核项由 Archive 阶段决定。

## 报告格式

```markdown
# Review 报告

## 完成标准
| ID | 完成标准 | 检查方式 | 结果 | 证据 |
|----|----------|----------|------|------|
| AC-1 | ... | ... | 通过/待复核/未通过 | ... |

## 问题处理
- 无

## 未解决事项
- 无

## 结论
PASS
```

## 结论

| 结果 | 含义 |
|------|------|
| PASS | 完成标准均有充分证据，可以归档 |
| REVIEW | 仍有事项需要复核或由用户明确接受 |
| BLOCKED | 存在失败、关键证据缺失或未解决问题，不得归档 |

## 约束

- 不通过搜索 `TODO`、`error` 等普通关键词判断任务质量。
- 每项完成标准使用稳定 ID；Review 必须按 ID 逐项覆盖，不能只比较数量。
- 只有 `通过`、`已通过` 或 `PASS` 被视为成功；空值、未执行、部分完成和其他结果均不得按通过处理。
- 不要求所有检查都是命令；检查方式必须适合实际产出。
- L2/L3 缺少完成标准或关键证据时结论为 BLOCKED。
- 无法执行的检查记录原因、替代证据和风险，不得伪造结果。
- Review 报告是归档门禁的依据，不替代 AI 对实际产出的检查。
