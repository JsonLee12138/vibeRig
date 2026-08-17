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
6. 检查计划确认：标有 `VibeRig-Plan-Draft`、`pending_plan_confirmation` 或 fingerprint 未获批准的 Issue 不得执行；
7. 进入 `execute` 前写 `execution_started` transition，请 `vb-linear` 投影 In Progress；Linear 不可用则保留 outbox。

## 分支与交付

- 项目要求 PR 时，`targetMode` 至少为 `pr_ready`；
- 里程碑可复用集成分支，独立 Issue 使用面向 base 的任务分支；
- worktree 只在隔离或并发确有价值时创建，不以每个 Issue 固定创建；
- Subagent 按风险和能力价值选择，不因 Linear 来源强制使用；
- 主 Agent 负责 Linear、commit、PR、Evidence 和状态写入。

## 状态

`execute` 达到 Completion Oracle 后：

- 更新 Proof/Evidence；
- 由 `execute` 把 `technically_ready` Proof Packet 写入对应 Linear Issue 评论或注册 Project Update，并按 marker/fingerprint read-back；不能只更新状态；
- 将 Goal Loop 置为 `target_reached`，执行轴置为 `technically_ready`；
- 请 `vb-linear` 写入最接近 In Review / Ready for Milestone / Pending Acceptance 的实际非终态，或保留 outbox；
- 进入 `accept-deliver`；
- 不在本入口内认领人工验收、merge 或 release；
- **永远不写 Accepted / Done**。

## 完成检查

- [ ] Issue/Milestone 已映射为统一 Work Item 与 Goal Contract。
- [ ] 执行未因旧 Skill 边界暂停。
- [ ] Evidence、CI 与当前 commit 对齐。
- [ ] 执行开始与技术就绪已同步 Linear 或存在 durable outbox。
- [ ] Linear 可读的执行摘要与 Proof Packet 已同步或分别存在 durable outbox，未把状态变更当成内容记录。
- [ ] 草案计划未获批准时没有启动执行。
- [ ] 人工验收交给 `accept-deliver`。
