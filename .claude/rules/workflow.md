<!-- 无 frontmatter：工作流是全局性规范，所有对话都需要加载 -->

# 工作流规范

## 标准工作流

raw-input → requirements → design → tech-spec → implementation → testing → deployment

> 小 bug 可咨询开发人员跳过流程

## 阶段概览

| 阶段 | 目录 | 核心交付物 | AI 行为 |
|------|------|------------|---------|
| raw-input | raw-input/ | 原始票据、来源链接 | 只读 |
| requirements | requirements/ | 验收标准(AC)、范围、依赖 | 提炼转化 |
| design | design/ | 架构图、技术选型、决策 | 方案决策 |
| tech-spec | tech-spec/ | 数据模型、API契约、变更清单 | 规范化 |
| implementation | implementation/ | 代码变更、决策记录 | 按spec执行 |
| testing | testing/ | 用例、执行记录、缺陷、报告 | 验证 |
| deployment | deployment/ | 发布说明、上线清单、回滚方案 | 记录归档 |

## 状态

待处理 → 活跃 → 完成（可暂挂/取消）

## 检查点

每阶段结束：确认产出物 → 更新索引 → 询问进入下一阶段
