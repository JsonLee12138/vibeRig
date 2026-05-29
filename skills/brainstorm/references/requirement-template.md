# Requirement Template

Write `.vibeRig/requirements/<name>/requirement.md` with this human-facing structure. Keep only result content, not the brainstorming process. Use concise numbered points so the user can discuss and approve items as `1`, `2`, `3`.

```md
# <需求标题>

## 1. 背景与问题

1. ...

## 2. 目标

1. ...
2. ...
3. ...

## 3. 需求清单

| 编号 | 需求 | 用户/业务价值 | 优先级 | 验收提示 |
|---|---|---|---|---|
| R1 |  |  |  |  |

## 4. 非目标与边界

1. ...

## 5. 业务规则与约束

| 编号 | 规则/约束 | 类型 | 影响范围 | 依据/复查触发条件 |
|---|---|---|---|---|

## 6. 依赖与外部资料

| 编号 | 依赖/资料 | 类型 | 用途/影响 |
|---|---|---|---|

## 7. 已确认决策

| 编号 | 决策 | 来源 | 影响 |
|---|---|---|---|
```

## Writing Rules

- If the file already exists, preserve explicit decisions and refine incomplete sections.
- If creating from only a name, ask a blocking clarification question when the name alone cannot produce an actionable requirement.
- Keep `目标`, `需求清单`, `非目标与边界`, and `已确认决策` concise and numbered.
- Keep every `需求清单` item concrete enough for acceptance and implementation planning.
- Use stable requirement IDs such as `R1`, `R2`, and `R3`.
- Put source URLs and repository links under `依赖与外部资料`.
- Do not write TBD, 待定, 待确认, open questions, or unresolved blockers. Resolve blockers before writing.
- Use `已确认决策` only for decisions already approved by the user, existing documents, source evidence, or the reviewed draft.
