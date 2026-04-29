# Workspace 索引

此目录存放活跃任务的工作空间。每个任务独立管理，目录名使用 `YYYYMMDD__feature-name`。

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

## 归档

已完成或暂停较久的任务可移动到 `workspace/archive/{原目录名}/`，避免活跃上下文膨胀。
