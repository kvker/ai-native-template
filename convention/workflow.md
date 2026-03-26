# 工作流规范

## 标准工作流

```
raw-input → requirements → design → tech-spec → implementation → testing → deployment
```

> **注意，若 AI 评估此变更极小，比如非常小的 bug，则咨询开发人员，是否需要按照流程执行。**

## 阶段详解

### 1. 需求输入 (raw-input)

**目标**：保存原始需求，不做任何修改

**文件**：`workspace/{project}/raw-input/`

**内容**：
- 原始票据/Issue 内容
- 需求来源链接
- 提出日期

**AI 行为**：只读，不修改

---

### 2. 需求提炼 (requirements)

**目标**：将原始需求转化为可执行的验收标准

**文件**：`workspace/{project}/requirements/`

**内容**：
- 验收标准 (AC)
- 范围内/范围外
- 依赖项

**模板**：

```markdown
# 需求：{功能名称}

## 验收标准

- [ ] AC1: {验收标准 1}
- [ ] AC2: {验收标准 2}

## 范围

**包含：**
- {包含内容}

**不包含：**
- {不包含内容}

## 依赖项

- {依赖项}
```

---

### 3. 设计 (design)

**目标**：确定技术方案

**文件**：`workspace/{project}/design/`

**内容**：
- 架构图
- 技术选型
- 关键决策及理由

---

### 4. 技术规范 (tech-spec)

**目标**：详细的实施规范

**文件**：`workspace/{project}/tech-spec/`

**内容**：
- 数据模型
- API 契约
- 文件变更清单

---

### 5. 实现 (implementation)

**目标**：执行代码变更

**文件**：`workspace/{project}/implementation/`

**内容**：
- 代码变更记录
- 实施过程中的决策
- 完成状态

**AI 行为**：
1. 按 tech-spec 执行
2. 更新 checkbox 状态
3. 记录到 implementation/

---

### 6. 测试验证 (testing)

**目标**：验证实现符合规范

**文件**：`workspace/{project}/testing/`

**内容**：
- 测试用例
- 测试执行记录
- 缺陷清单
- 测试报告

**AI 行为**：
1. 根据 tech-spec 编写测试用例
2. 执行测试并记录结果
3. 发现缺陷时记录并通知

---

### 7. 部署归档 (deployment)

**目标**：记录发布并归档

**文件**：`workspace/{project}/deployment/`

**内容**：
- 发布说明
- 上线清单
- 回滚方案
- 归档索引

---

## 状态流转

```
🟡 待处理 → 🟢 活跃 → ✅ 完成
                  ↓
              ⏸️ 暂挂
                  ↓
              ❌ 已取消
```

## AI 检查点

在每个阶段结束时，AI 应：

1. 确认当前阶段的产出物已完成
2. 更新索引文件中的状态
3. 询问用户是否进入下一阶段
