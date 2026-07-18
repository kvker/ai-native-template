# artifacts 目录说明

`artifacts/` 存放任务上下文。每个需要留痕的任务使用独立目录，命名为 `YYYYMMDD__task-name`。

## 约定结构

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

阶段目录按任务需要创建，不要求空目录占位，也不强制固定文件名。L2 可以合并相邻阶段的记录，L3 默认保留完整阶段。

## AI 行为

- 新建 L2/L3 任务时创建独立 Artifact，并在根 `AGENTS.md` 的活跃 Artifacts 表中登记。
- Artifact 保存原始材料、任务过程、决策、检查证据、完结记录以及实际交付物的引用。
- 实际交付物写入 `projects/` 或用户指定位置，不在 Artifact 中复制一份作为默认做法。
- 每个 Artifact 可包含自己的 `AGENTS.md`，只记录任务路由、阶段状态和必要约束。
- Review 结论为 `PASS` 后可使用 `/an-archive`；`REVIEW` 需要用户明确接受，`BLOCKED` 不得归档。
- 归档后将 Artifact 移到 `artifacts/_archived/`，并从根活跃 Artifacts 表移除。
- 恢复历史任务时先匹配目录名，再按需读取内容。
