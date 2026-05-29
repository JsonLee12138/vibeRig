# Research Template

Write `.vibeRig/requirements/<name>/research.md` with this structure. Keep only technical research results, not the research process.

```md
# 技术调研结果

## 结论摘要

## 需求理解

## 资料来源

| 来源 | 类型 | 关键用途 |
|---|---|---|

## 关键技术事实

| ID | 事实 | 依据 | 影响 |
|---|---|---|---|

## 技术约束

| ID | 约束 | 来源 | 对需求/方案的影响 |
|---|---|---|---|

## 候选技术路径

| ID | 路径 | 适用条件 | 优点 | 缺点 | 风险 | 推荐程度 |
|---|---|---|---|---|---|---|

## 推荐技术方向

## 风险与验证点

| ID | 风险/问题 | 影响 | 建议验证方式 | 阻塞程度 |
|---|---|---|---|---|

## 结论边界与复查触发条件

| ID | 边界/触发条件 | 当前处理方式 | 影响 |
|---|---|---|---|
```

## Writing Rules

- Separate facts, inferences, and approved working decisions.
- Include enough evidence for review, but do not write tool logs or browsing steps.
- Include rejected technical paths only when they explain important tradeoffs.
- Make the recommended direction usable by `spec.md`.
- Do not write TBD, 待定, 待确认, open questions, or unresolved blockers. Resolve blockers before writing.
- Use `结论边界与复查触发条件` for known limits of the recommendation, not for questions still waiting for confirmation.
