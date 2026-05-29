# Research Template

Write `.vibeRig/requirements/<name>/research.md` with this human-facing structure. Keep only technical research results, not the research process. Use concise numbered points so the user can approve the recommendation and tradeoffs.

```md
# 技术调研结果

## 1. 结论摘要

1. ...
2. ...
3. ...

## 2. 调研范围与需求假设

| 编号 | 内容 | 类型 | 来源/确认状态 |
|---|---|---|---|
| RS1 |  | 调研范围/需求假设/非目标 |  |

## 3. 资料来源

| 编号 | 来源 | 类型 | 关键用途 |
|---|---|---|---|

## 4. 关键技术事实

| 编号 | 事实 | 依据 | 对需求/方案的影响 |
|---|---|---|---|

## 5. 候选技术路径

| 编号 | 路径 | 适用条件 | 优点 | 缺点 | 风险 | 推荐程度 |
|---|---|---|---|---|---|---|

## 6. 推荐技术方向

1. ...

## 7. 风险与验证点

| 编号 | 风险/问题 | 影响 | 建议验证方式 | 阻塞程度 |
|---|---|---|---|---|

## 8. 结论边界与复查触发条件

| 编号 | 边界/触发条件 | 当前处理方式 | 影响 |
|---|---|---|---|
```

## Writing Rules

- Separate facts, inferences, and approved working decisions.
- If research runs before `requirement.md`, keep requirement assumptions under `调研范围与需求假设`; do not present them as approved requirements.
- Include enough evidence for review, but do not write tool logs or browsing steps.
- Include rejected technical paths only when they explain important tradeoffs.
- Make the recommended direction usable by `requirement.md`, `roadmap.md`, and `spec.md`.
- Keep `结论摘要` and `推荐技术方向` concise and numbered.
- Do not write TBD, 待定, 待确认, open questions, or unresolved blockers. Resolve blockers before writing.
- Use `结论边界与复查触发条件` for known limits of the recommendation, not for questions still waiting for confirmation.
