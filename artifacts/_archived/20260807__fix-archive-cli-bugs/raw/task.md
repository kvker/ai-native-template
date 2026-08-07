# 任务背景

在优化 an-task 触发机制时，执行归档事务脚本发现两处缺陷：

1. CLI TDZ 缺陷：`archive-task.mjs` 第 11 行 `if (isMain) runCli()` 在模块求值期调用，
   先于第 290 行 `class InvocationError` 的声明。任何门禁失败或参数错误都会构造这些类，
   触发 TDZ ReferenceError，CLI 只输出误导性的“Cannot access 'InvocationError' before initialization”，
   掩盖真实错误。必须用 import 方式调用才能看到真实原因。

2. `_archived` 目录逻辑缺陷：`resolvePaths` 先执行 `assertDirectoryInside(root, archiveRoot, "归档目录")`
   再执行 `if (!entryExists(archiveRoot)) fs.mkdirSync(archiveRoot)`；首次归档时目录不存在，
   断言先失败，mkdir 成为死代码。此前必须手工创建 `artifacts/_archived/` 才能归档。

用户确认修复这两处。
