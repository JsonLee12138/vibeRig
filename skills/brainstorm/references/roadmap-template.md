# Roadmap Template

Write `.vibeRig/requirements/<name>/roadmap.md` with this dual-audience structure. Start with a concise human-facing numbered summary, then provide detailed sequencing for AI planning.

```md
# 推进路线

## 1. 给人看的推进摘要

1. ...
2. ...
3. ...

## 2. 推荐推进策略

## 3. 阶段拆分

| 阶段 | 目标 | 主要任务 | 产出 | 完成标准 |
|---|---|---|---|---|

## 4. 任务拆分

| ID | 任务 | 依赖 | 产出 | 风险 |
|---|---|---|---|---|

## 5. 依赖关系

| 依赖 | 类型 | 影响 | 处理方式 |
|---|---|---|---|

## 6. 里程碑

| 里程碑 | 目标 | 建议顺序 | 验证方式 |
|---|---|---|---|

## 7. 风险缓解动作

| 风险 | 缓解动作 | 负责人/角色 | 触发条件 |
|---|---|---|---|

## 8. 暂不处理事项

| 项目 | 原因 | 后续条件 |
|---|---|---|
```

## Writing Rules

- Keep `给人看的推进摘要` concise, numbered, and understandable without reading the detailed tables.
- Reflect risks and validation tasks from `research.md` when it exists.
- Reflect acceptance dependencies from `acceptance.md` when available.
- Split work into reviewable phases, not implementation micro-steps.
- Keep `roadmap.md` about sequencing and delivery, not detailed module design.
