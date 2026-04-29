---
name: an-archive
description: 将已完成的 AI Native 工作区归档到 workspace/archive/。用户执行 $an-archive，或要求清理、归档、关闭已完成工作区时使用。
---

# Workspace 归档

将已完成或暂停的工作区移动到 `workspace/archive/`。

## 1. 确认目标

如果用户指定了工作区名称，先匹配：

- `workspace/{name}`
- 目录名包含 `{name}` 的候选项

如果用户未指定，列出 `workspace/` 下所有非隐藏、非 `archive/` 的一级目录，让用户选择。

## 2. 执行归档

1. 确认目标目录存在且不在 `workspace/archive/`。
2. 确保 `workspace/archive/` 存在。
3. 移动到 `workspace/archive/{原目录名}/`。
4. 如目标归档目录已存在，先询问用户是否覆盖、改名或取消。
5. 更新根 `AGENTS.md` 的活跃工作区表，将状态改为“完成”或移到历史记录。

## 3. 报告

报告格式：

```text
已归档：workspace/{name} -> workspace/archive/{name}
已更新：AGENTS.md 活跃工作区表
```

## 错误处理

| 场景 | 处理 |
|------|------|
| 指定工作区不存在 | 列出可用工作区 |
| 没有可归档工作区 | 告知当前无活跃工作区 |
| 目标已在 archive 中 | 说明已经归档 |
| 归档目标重名 | 询问改名或取消 |
