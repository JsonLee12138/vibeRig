# Acceptance Template

Write `.vibeRig/requirements/<name>/acceptance.md` with this structure.

```md
# 验收结果

## 验收范围

## 自动化验收点

| ID | 验收点 | 覆盖需求 | 验收方式 | 通过标准 |
|---|---|---|---|---|

## 人工验收点

| ID | 验收点 | 人工判断原因 | 建议验收人 | 通过标准 |
|---|---|---|---|---|

## 边界场景

| ID | 场景 | 输入/条件 | 预期结果 |
|---|---|---|---|

## 风险场景

| ID | 场景 | 风险 | 建议防护/观察点 |
|---|---|---|---|

## 回归场景

| ID | 既有能力 | 回归风险 | 验证方式 |
|---|---|---|---|

## 不在本次验收范围

| ID | 项目 | 原因 |
|---|---|---|
```

## Writing Rules

- Cover every major requirement from `requirement.md`.
- Use `research.md` to add technical risk and integration acceptance points.
- Distinguish automated, manual, risk, boundary, and regression acceptance.
- Avoid vague pass criteria such as "works normally".
