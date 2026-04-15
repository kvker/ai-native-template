---
name: archive-workspace
description: 将已完成的 workspace 文件夹归档到 workspace/archive/ 目录。当用户想要：1) 归档一个 workspace 2) 清理已完成的工作区 3) 执行 /archive-workspace 命令 4) 提到"归档"、"archive"、"整理工作区"、"清理工作区"、"完成归档"等关键词时触发此技能。即使用户没有明确说"归档"，只要是"这个任务做完了收一下"、"把 xxx workspace 归档"之类的意图，都应使用此技能。
---

# Workspace 归档

将指定 workspace 文件夹移动到 `workspace/archive/`。

## 执行流程

### 1. 确认目标 workspace

**如果用户指定了 workspace 名称**（如"归档 user-login"），直接定位。

**如果用户未指定**，列出 `workspace/` 下所有非 `archive/` 的子目录供用户选择：

```
可用 workspace:
1. 20260415__user-login
2. 20260416__fix-payment
请指定要归档的 workspace（输入序号或名称）。
```

列出时排除 `archive/` 目录本身和 `.` 开头的隐藏文件。

### 2. 执行归档

1. 确保 `workspace/archive/` 目录存在
2. 将整个 workspace 文件夹移动到 `workspace/archive/{原目录名}/`

归档后的目录结构示例：

```
workspace/archive/
└── 20260415__user-login/
    ├── raw-input/
    ├── requirements/
    ├── design/
    └── ...
```

目录名本身就是索引，无需额外生成文件。

### 3. 报告结果

向用户简要报告归档结果：

```
已归档：{目录名} → workspace/archive/{目录名}/
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 指定的 workspace 不存在 | 列出可用 workspace 供用户选择 |
| `workspace/` 下没有可归档的 workspace | 告知用户当前无活跃 workspace |
| 目标已在 archive 中 | 提示用户该 workspace 已经归档过 |
