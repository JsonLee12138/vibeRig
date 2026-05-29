# Acceptance Template

Write `.vibeRig/requirements/<name>/acceptance.md` with this structure.

```md
# 验收结果

## 验收范围

## 自动化验收点

| ID | 验收点 | 覆盖需求 | 验收方式 | 通过标准 |
|---|---|---|---|---|

## 人工验收点

| ID | 验收点 | 覆盖需求 | 人工判断原因 | 建议验收人 | 通过标准 |
|---|---|---|---|---|---|

## 下游任务映射说明

| 验收 ID | 建议映射方式 | 备注 |
|---|---|---|

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
- Use stable IDs for every automated and manual acceptance point, such as `AC-A1` for automated checks and `AC-M1` for manual checks.
- Do not invent implementation task IDs in `acceptance.md`. Task-to-acceptance mapping is generated later by `write-plan` in `plan.md` and `tasks.yaml`.
- Use `下游任务映射说明` only to record mapping guidance, such as whether a manual check should run per task, after a task group, or once at final integration.
- Avoid vague pass criteria such as "works normally".
