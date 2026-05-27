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

| ID | 需求 | 价值 | 优先级 | 依据/假设 |
|---|---|---|---|---|

## 边界问题

| ID | 问题 | 为什么重要 | 不确认的风险 |
|---|---|---|---|

## 业务规则假设

| ID | 假设规则 | 影响范围 | 置信度 | 需要确认对象 |
|---|---|---|---|---|

## 依赖与约束

| ID | 依赖/约束 | 类型 | 影响 |
|---|---|---|---|

## 外部资料

| 名称 | 地址/位置 | 用途 |
|---|---|---|

## 待确认问题

| ID | 问题 | 阻塞程度 | 建议确认对象 |
|---|---|---|---|
```

## Writing Rules

- If the file already exists, preserve explicit decisions and refine incomplete sections.
- If creating from only a name, make the document a draft and label assumptions clearly.
- Keep `候选需求` concrete enough for acceptance and implementation planning.
- Put source URLs and repository links under `外部资料`.
