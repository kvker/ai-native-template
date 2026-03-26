# 目录结构规范

## 根目录

CLAUDE.md | background/ | convention/ | workspace/ | target/

## Workspace 项目结构

```
workspace/{feature}/
├── CLAUDE.md         # 项目索引
├── raw-input/        # 原始需求（只读）
├── requirements/     # 需求提炼
├── design/           # 设计决策
├── tech-spec/        # 技术规范
├── implementation/   # 实施记录
├── testing/          # 测试记录
└── deployment/       # 发布记录
```

> 阶段说明见 [workflow.md](workflow.md)

## AI 访问顺序

CLAUDE.md → workspace/{project}/CLAUDE.md → 阶段文档 → target/ → testing → deployment
