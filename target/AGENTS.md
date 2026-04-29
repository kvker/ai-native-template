# Target Instructions

`target/` 是实际代码目录。每个一级子目录视为一个独立工程，例如 `target/frontend/`、`target/backend/`。

## Codex 行为

- 只有进入实现、验证或代码调查阶段时才修改 `target/`。
- 先读取目标工程的清单文件和局部说明，例如 `package.json`、`pyproject.toml`、`go.mod`、`pom.xml`、`README.md` 或更深层的 `AGENTS.md`。
- 不读取依赖目录、构建产物、缓存、日志、大型生成文件和密钥文件，除非用户明确要求。
- 多工程场景下先确认受影响工程，再分别运行对应测试或检查命令。
- 修改代码后优先运行最小但有意义的验证，并把未能运行的验证说明清楚。
