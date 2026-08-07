# 执行摘要

## 产出

- `.agents/skills/an-init/assets/skills/an-archive/scripts/archive-task.mjs`
  - 入口调用 `if (isMain) runCli();` 移到文件末尾，位于 `class ArchiveGateError` 之后，消除 TDZ。
  - `resolvePaths` 中 `_archived` 目录改为先 `mkdirSync(recursive)` 再 `assertDirectoryInside`，首次归档自动建目录。
- `.agents/skills/an-init/tests/archive-task.test.mjs`：新增“CLI 参数错误输出真实用法错误而非 TDZ 异常”与“缺少 _archived 目录时自动创建并完成归档”两条回归测试。

## 验证

- archive-task.test.mjs：12 项全部通过。
- 全量测试：63 项全部通过。
- 真实 CLI 冒烟：`node archive-task.mjs --bad` 输出“用法：archive-task.mjs artifacts/{artifact-id}”且退出码 2（修复前为 TDZ 消息）。

## 偏离与决策

- 无偏离。修复严格限定在报告的两处缺陷范围内，未改动其他逻辑。
