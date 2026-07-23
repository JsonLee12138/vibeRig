---
name: task-runner
description: 兼容旧的 Linear Issue 或 Milestone 执行调用。用户显式输入 task-runner、Issue key、Milestone id，或旧流程要求执行任务时使用；从 Linear 和本地需求恢复统一 Goal Contract，再交给 execute 持续实现、验证和交付。新工作优先直接使用自然语言或 execute。
---

# Task Runner Compatibility

`task-runner` 不再是只能人工触发的第二套执行器。它只负责把旧的 Issue/Milestone 输入解析为 `execute` 可消费的上下文。

## 解析

1. 使用 `vb-linear` 精确读取 Issue/Milestone、评论、状态和 PR；
2. 匹配 `.vibeRig/requirements/` 与 archive 中的 Work Item、AC/TC、风险和交付计划；
3. 根据依赖拓扑确定单项、顺序或可安全并行范围；
4. 恢复或创建 Goal Contract；
5. 将已有 Evidence、commit、CI、PR 和失败历史注入 Task Context；
6. 进入 `execute`。

## 分支与交付

- 项目要求 PR 时，`targetMode` 至少为 `pr_ready`；
- 里程碑可复用集成分支，独立 Issue 使用面向 base 的任务分支；
- worktree 只在隔离或并发确有价值时创建，不以每个 Issue 固定创建；
- Subagent 按风险和能力价值选择，不因 Linear 来源强制使用；
- 主 Agent 负责 Linear、commit、PR、Evidence 和状态写入。

## 状态

`execute` 达到 Completion Oracle 后：

- 更新 Proof/Evidence；
- 将技术状态置为 pending acceptance；
- 进入 `accept-deliver`；
- 不在本入口内认领人工验收、merge 或 release。

## 完成检查

- [ ] Issue/Milestone 已映射为统一 Work Item 与 Goal Contract。
- [ ] 执行未因旧 Skill 边界暂停。
- [ ] Evidence、CI 与当前 commit 对齐。
- [ ] 人工验收交给 `accept-deliver`。
