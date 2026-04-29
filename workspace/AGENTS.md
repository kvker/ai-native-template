# Workspace Instructions

`workspace/` 存放活跃任务工作区。每个任务使用独立目录，命名为 `YYYYMMDD__feature-name`。

## 约定结构

```text
workspace/{YYYYMMDD}__{feature-name}/
├── AGENTS.md
├── raw-input/
├── requirements/
├── design/
├── tech-spec/
├── implementation/
├── testing/
└── deployment/
```

## Codex 行为

- 新任务优先创建独立工作区，并在根 `AGENTS.md` 的活跃工作区表中登记。
- 工作区只存过程文档、决策、报告和临时分析，不存放最终产品代码。
- 每个工作区可包含自己的 `AGENTS.md` 作为任务索引。
- 任务完成后，可使用 `$an-archive` 移动到 `workspace/archive/`。
- 恢复历史任务时先匹配目录名，再读取对应工作区内容，避免无谓加载大量文档。
