# 目录结构规范

## 根目录结构

```
project/
├── CLAUDE.md        # AI 入口文件（必需）
├── README.md        # 人类阅读的概述（可选）
├── background/      # 背景知识（只读）
├── convention/      # 规范定义（必须遵循）
├── workspace/       # 活跃工作区
└── target/             # 源代码
```

## Workspace 结构

每个 workspace 代表一个功能或项目：

```
workspace/
├── README.md           # workspace 索引
└── {feature-name}/
    ├── CLAUDE.md       # 项目级索引
    ├── raw-input/      # 原始需求（保持原样）
    ├── requirements/   # 需求提炼
    ├── design/         # 设计决策
    ├── tech-spec/      # 技术规范
    ├── implementation/ # 实施记录
    ├── testing/        # 测试记录
    └── deployment/     # 发布记录
```

## 阶段流水线

```
raw-input → requirements → design → tech-spec → implementation → testing → deployment
    ↑                                                                     ↓
    └─────────────────────────── 归档后可循环 ─────────────────────────────┘
```

| 阶段 | 内容 | AI 行为 |
|-------|------|---------|
| raw-input | 原始需求，不做修改 | 只读 |
| requirements | 需求提炼，验收标准 | 分析 |
| design | 架构设计，技术选型 | 设计 |
| tech-spec | 详细技术规范 | 规划 |
| implementation | 代码变更记录 | 执行 |
| testing | 测试用例与结果 | 验证 |
| deployment | 发布记录 | 归档 |

## 文件访问顺序

AI 应按以下顺序访问文件：

1. `CLAUDE.md` - 了解全局
2. `workspace/{project}/CLAUDE.md` - 了解项目
3. 按阶段顺序读取具体文档
4. 最后访问 `target/` 编写代码
5. 完成后进入 testing 验证，最后 deployment 归档
