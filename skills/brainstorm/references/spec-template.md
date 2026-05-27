# Spec Template

Write `.vibeRig/requirements/<name>/spec.md` with this structure.

```md
# 实现方案

## 目标

## 非目标

## 推荐方案

## 模块设计

## 接口设计

## 数据设计

## 流程与状态

## 错误处理

## 兼容性与迁移

## 测试策略

## 风险与待确认问题

| ID | 风险/问题 | 影响 | 处理方式 |
|---|---|---|---|
```

## Writing Rules

- Base the implementation direction on `research.md`.
- Keep the spec concrete enough for engineering implementation.
- Include APIs, data shapes, state transitions, and error behavior only when relevant.
- Do not write code unless a small signature or schema snippet is needed to make the design unambiguous.
- Keep task sequencing in `roadmap.md`; keep engineering design in `spec.md`.
