# Spec Template

Write `.vibeRig/requirements/<name>/spec.md` with this dual-audience structure. Start with a concise human-facing numbered summary, then provide detailed implementation design for AI implementation.

```md
# 实现方案

## 1. 给人看的方案摘要

1. ...
2. ...
3. ...

## 2. 目标

## 3. 非目标

## 4. 推荐方案

## 5. 模块设计

## 6. 接口设计

## 7. 数据设计

## 8. 流程与状态

## 9. 错误处理

## 10. 兼容性与迁移

## 11. 测试策略

## 12. 风险与处理决策

| ID | 风险 | 影响 | 处理决策 | 复查触发条件 |
|---|---|---|---|---|
```

## Writing Rules

- Keep `给人看的方案摘要` concise, numbered, and understandable without reading the detailed design.
- Base the implementation direction on `research.md` when it exists, otherwise on the approved `requirement.md`, `roadmap.md`, and acceptance documents.
- Keep the spec concrete enough for engineering implementation.
- Include APIs, data shapes, state transitions, and error behavior only when relevant.
- Do not write code unless a small signature or schema snippet is needed to make the design unambiguous.
- Keep task sequencing in `roadmap.md`; keep engineering design in `spec.md`.
- Do not write TBD, 待定, 待确认, open questions, or unresolved blockers. Resolve blockers before writing.
- Use `风险与处理决策` for agreed mitigations and review triggers, not for undecided design questions.
