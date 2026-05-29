# Requirement Template

Write `.vibeRig/requirements/<name>/requirement.md` with this structure. Keep only result content, not the brainstorming process.

```md
# <需求标题>

## 背景

## 问题陈述

## 目标

## 非目标

## 用户/业务价值

## 候选需求

| ID | 需求 | 价值 | 优先级 | 依据/决策 |
|---|---|---|---|---|

## 边界决策

| ID | 决策 | 为什么重要 | 影响 |
|---|---|---|---|

## 业务规则

| ID | 规则 | 影响范围 | 依据 | 复查触发条件 |
|---|---|---|---|---|

## 依赖与约束

| ID | 依赖/约束 | 类型 | 影响 |
|---|---|---|---|

## 外部资料

| 名称 | 地址/位置 | 用途 |
|---|---|---|

## 已确认决策

| ID | 决策 | 来源 | 影响 |
|---|---|---|---|
```

## Writing Rules

- If the file already exists, preserve explicit decisions and refine incomplete sections.
- If creating from only a name, ask a blocking clarification question when the name alone cannot produce an actionable requirement.
- Keep `候选需求` concrete enough for acceptance and implementation planning.
- Put source URLs and repository links under `外部资料`.
- Do not write TBD, 待定, 待确认, open questions, or unresolved blockers. Resolve blockers before writing.
- Use `已确认决策` only for decisions already approved by the user, existing documents, source evidence, or the reviewed draft.
