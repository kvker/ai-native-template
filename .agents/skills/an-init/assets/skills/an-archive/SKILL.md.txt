---
name: an-archive
description: 检查 AI Native 任务的 Review 结论和完结状态，将满足门禁的活跃 Artifact 移到 artifacts/_archived/，并同步根活跃索引。用户要求归档、完结或收起任务上下文时使用。
---

# Artifact 归档

Archive 是标准工作流的终态，表示任务已经完结。归档不是发布、部署或交接。

## 一、定位目标

用户指定 Artifact 时直接定位。未指定时列出 `artifacts/` 下除 `_archived/` 外的任务目录，请用户选择。不要创建新的任务 Artifact。

## 二、检查门禁

归档前读取目标 Artifact 的 `review/` 和任务索引：

先运行结构门禁：

```bash
node .agents/skills/an-review/scripts/review-task.mjs artifacts/{YYYYMMDD}__{task-name}
```

脚本只检查完成标准、Review 证据和显式结论是否一致；AI 仍需确认报告对应实际产出。退出码 `0` 为 PASS、`3` 为 REVIEW、`1` 为 BLOCKED。

| Review 结论 | 行为 |
|-------------|------|
| PASS | 可以归档 |
| REVIEW | 说明待复核项；只有用户明确接受后归档，并在完结摘要中记录接受内容和来源 |
| BLOCKED | 拒绝归档并列出阻塞项 |
| 缺失或不明确 | 先执行 `/an-review`，不得直接归档 |

同时确认：

- 实际产出位置已经记录。
- 未解决事项已关闭或被明确接受。
- 已具备生成 `archive/summary.md` 所需的任务目标、最终产出、Review 结论和剩余限制。

## 三、执行归档

1. 创建或补全 `archive/summary.md`，记录任务目标、最终产出、Review 结论、剩余限制、完结时间；接受 REVIEW 时同时记录用户接受的事项和本轮指令来源。
2. 确保 `artifacts/_archived/` 存在。
3. 将整个 Artifact 移到 `artifacts/_archived/{原目录名}/`。
4. 从根 `AGENTS.md` 的活跃 Artifacts 表移除对应行。
5. 不改写 Artifact 内的 raw 和历史记录。

目标目录已存在时停止并报告，不覆盖已有归档。

## 四、报告

报告归档路径、Review 结论、最终产出位置和已接受的剩余限制。

## 异常处理

| 情况 | 处理 |
|------|------|
| Artifact 不存在 | 列出可用的活跃 Artifact |
| 没有活跃 Artifact | 报告当前无可归档任务 |
| 已经归档 | 报告现有归档路径，不重复移动 |
| Review 未通过 | 保持活跃状态，说明下一步 |
