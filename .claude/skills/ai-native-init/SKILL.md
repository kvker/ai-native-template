---
name: ai-native-init
description: 将现有工程转换为 AI Native 项目结构。当用户想要：1) 将现有项目转换为 AI Native 格式 2) 为已有代码生成 background/convention/workspace 文档 3) 执行 /ai-native-init 命令 4) 让 AI 理解并接管现有项目 时触发此技能。
---

# AI Native 项目初始化

将任意现有工程转换为 AI Native 项目结构，生成 background、convention、workspace 文档。

## 前置检查

执行前检查：

1. **检查 `target/` 目录**
   - 如果为空或不存在：
     ```
     ⚠️ target/ 目录为空

     请将你的现有工程代码复制到本项目根目录，并重命名为 target/

     示例：
     rm -rf ./target && cp -r /path/to/your-old-project ./target

     完成后重新执行 /ai-native-init
     ```
     然后停止执行
   - 如果有代码：继续执行

---

## 执行流程

### 阶段一：代码分析（静默执行）

扫描 `target/` 目录，提取客观信息：

**技术栈识别**：

| 文件存在 | 项目类型 |
|----------|----------|
| `package.json` + `react` | React 前端 |
| `package.json` + `vue` | Vue 前端 |
| `package.json` + `next` | Next.js 全栈 |
| `package.json` + `express` | Express 后端 |
| `package.json` + `nest` | NestJS 后端 |
| `pom.xml` | Java/Maven |
| `requirements.txt` | Python |
| `go.mod` | Go |

**目录结构分析**：
- 扫描 `target/` 生成目录树
- 推断各目录用途

**代码风格分析**：
- 命名规范（camelCase/kebab-case/PascalCase）
- 文件组织方式
- 注释风格

---

### 阶段二：交互提问

分析完成后，向用户提问补充信息：

```
我已分析 target/ 目录，识别到：
- 项目类型：{识别结果}
- 技术栈：{主要依赖}
- 目录结构：{概要}

需要补充一些信息：

1. 这个项目是做什么的？（一句话描述）
```

等待用户回答后，根据项目类型继续提问：

**必问**：
- 目标用户是谁？

**条件提问**：
- 有后台管理功能？→ 需要定义用户角色吗？
- 有设计稿？→ Figma/Sketch 链接？主色调？
- 是 API 项目？→ 有接口文档吗？

---

### 阶段三：文档生成

根据分析和用户输入，生成以下文档：

#### background/product/overview.md

```markdown
# 产品概述

## 产品名称

{从 package.json name 或目录名提取}

## 产品定位

{用户输入}

## 目标用户

{用户输入}

## 技术架构

{从代码分析得出}
```

#### background/tech/stack.md

```markdown
# 技术栈

## 前端/后端

| 技术 | 版本 | 用途 |
|------|------|------|
| ... | ... | ... |

## 工具链

| 工具 | 用途 |
|------|------|
| ... | ... |
```

#### convention/structure.md

```markdown
# 目录结构规范

## 根目录结构

{从 target/ 扫描生成的目录树}

## 目录职责

| 目录 | 职责 |
|------|------|
| ... | ... |
```

#### convention/coding-style.md

```markdown
# 代码风格规范

## 命名规范

{从代码推断}

## 文件组织

{从代码推断}
```

#### workspace/README.md

```markdown
# Workspace 索引

此目录存放活跃项目的工作空间。

## 创建新 Workspace

1. 在此目录下创建 `{feature-name}/`
2. 创建 CLAUDE.md 作为项目索引
3. 按阶段流水线创建子目录：

   raw-input → requirements → design → tech-spec → implementation → testing → deployment
```

---

## 输出格式

完成后输出：

```
✅ AI Native 项目初始化完成！

生成文件：
- background/product/overview.md
- background/tech/stack.md
- convention/structure.md
- convention/coding-style.md
- workspace/README.md

下一步：
1. 在 workspace/ 中创建你的第一个功能
2. 参考 background/ 了解项目背景
3. 遵循 convention/ 中的规范开发
```

---

## 错误处理

| 情况 | 处理 |
|------|------|
| target/ 为空 | 停止并提示用户放入代码 |
| 无法识别技术栈 | 跳过自动识别，询问用户 |
| 用户取消 | 不生成任何文件 |
