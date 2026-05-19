---
name: an-archive
description: 将已完成的 artifacts 产出目录归档到 artifacts/archive/ 目录。当用户想要：1) 归档一个 artifact 2) 清理已完成的任务产出 3) 执行 /an-archive 命令 4) 提到"归档"、"整理产出"、"清理产出"、"完成归档"等关键词时触发此技能。即使用户没有明确说"归档"，只要是"这个任务做完了收一下"、"把 xxx artifact 归档"之类的意图，都应使用此技能。
---

# Artifacts 归档

将指定 artifacts 文件夹移动到 `artifacts/archive/`。

## 执行流程

### 1. 确认目标 artifacts

**如果用户指定了 artifacts 名称**（如"归档 user-login"），直接定位。

**如果用户未指定**，列出 `artifacts/` 下所有非 `archive/` 的子目录供用户选择：

```
可用 artifacts:
1. 20260415__user-login
2. 20260416__fix-payment
请指定要归档的 artifacts（输入序号或名称）。
```

列出时排除 `archive/` 目录本身和 `.` 开头的隐藏文件。

### 2. 执行归档

1. 确保 `artifacts/archive/` 目录存在
2. 将整个 artifacts 文件夹移动到 `artifacts/archive/{原目录名}/`

归档后的目录结构示例：

```
artifacts/archive/
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
已归档：{目录名} → artifacts/archive/{目录名}/
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 指定的 artifacts 不存在 | 列出可用 artifacts 供用户选择 |
| `artifacts/` 下没有可归档的 artifacts | 告知用户当前无活跃 artifacts |
| 目标已在 archive 中 | 提示用户该 artifacts 已经归档过 |
