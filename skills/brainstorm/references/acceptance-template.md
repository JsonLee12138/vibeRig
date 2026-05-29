# Acceptance Template

Write two files for the acceptance phase:

- `.vibeRig/requirements/<name>/acceptance.md`: AI-facing complete acceptance contract.
- `.vibeRig/requirements/<name>/acceptance-human.md`: human-facing concise acceptance brief.

The two files must use the same acceptance IDs and the same numbered order. Every item in `acceptance-human.md` must map one-to-one to an item in `acceptance.md`, and every major acceptance item in `acceptance.md` must appear in `acceptance-human.md`.

## acceptance.md

```md
# 验收方案

## 1. 验收覆盖索引

| 序号 | 验收ID | 类型 | 覆盖需求 | 人读摘要 |
|---|---|---|---|---|
| 1 | AC-A1 | 自动化 | R1 |  |

## 2. 自动化验收点

| 序号 | ID | 验收点 | 覆盖需求 | 验收方式 | 通过标准 |
|---|---|---|---|---|---|

## 3. 人工验收点

| 序号 | ID | 验收点 | 覆盖需求 | 人工判断原因 | 建议验收人 | 通过标准 |
|---|---|---|---|---|---|---|

## 4. 下游任务映射说明

| 验收ID | 建议映射方式 | 备注 |
|---|---|---|

## 5. 边界场景

| ID | 场景 | 输入/条件 | 预期结果 |
|---|---|---|---|

## 6. 风险场景

| ID | 场景 | 风险 | 建议防护/观察点 |
|---|---|---|---|

## 7. 回归场景

| ID | 既有能力 | 回归风险 | 验证方式 |
|---|---|---|---|

## 8. 不在本次验收范围

| ID | 项目 | 原因 |
|---|---|---|
```

## acceptance-human.md

```md
# 验收方案摘要

## 1. 验收点

1. [AC-A1] ...
2. [AC-M1] ...
3. [AC-A2] ...

## 2. 验收方式

1. [AC-A1] ...
2. [AC-M1] ...
3. [AC-A2] ...

## 3. 不在本次验收范围

1. ...
```

## Writing Rules

- Cover every major requirement from `requirement.md`.
- Use `research.md` to add technical risk and integration acceptance points when it exists.
- Distinguish automated, manual, risk, boundary, and regression acceptance.
- Use stable IDs for every automated and manual acceptance point, such as `AC-A1` for automated checks and `AC-M1` for manual checks.
- Keep the sequence and IDs in `acceptance-human.md` synchronized with `acceptance.md`.
- Do not invent implementation task IDs in acceptance documents. Task-to-acceptance mapping is generated later by `write-plan` in `plan.md` and `tasks.yaml`.
- Use `下游任务映射说明` only to record mapping guidance, such as whether a manual check should run per task, after a task group, or once at final integration.
- Avoid vague pass criteria such as "works normally".
