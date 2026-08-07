# Spec：修复归档脚本两处缺陷

## 执行步骤

1. 将 `if (isMain) runCli();` 从模块求值期（第 11 行）移到文件末尾所有 class 声明之后，消除 TDZ。
2. 将 `_archived` 目录的 `mkdirSync` 移到 `assertDirectoryInside` 之前并加 `recursive`，消除死代码。
3. 在 archive-task.test.mjs 新增两条回归测试：
   - CLI 参数错误时输出真实用法错误且退出码为 2，stderr 不含 TDZ 异常。
   - 缺少 `_archived` 目录时自动创建并完成归档。

## 影响位置

- `.agents/skills/an-init/assets/skills/an-archive/scripts/archive-task.mjs`
- `.agents/skills/an-init/tests/archive-task.test.mjs`

## 检查计划

- 运行 archive-task.test.mjs 专项测试与全量测试。
- 真实 CLI 冒烟：`node archive-task.mjs --bad` 应输出用法并退出 2。
