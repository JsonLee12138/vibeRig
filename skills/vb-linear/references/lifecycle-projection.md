# Canonical Lifecycle → Linear Projection

所有 VibeRig 调用方只提交语义 transition。每次写入前调用 `list_issue_statuses` 解析团队真实状态；表中名称是匹配优先级，不是要求创建的新状态。

| Semantic transition | Linear 语义优先级 | 终态 |
|---|---|---|
| `plan_draft_visible` | `Draft` → `Backlog` → 最早的 unstarted 状态；同时写 `VibeRig-Plan-Draft` typed marker 与 plan fingerprint | 否 |
| `ready_for_development` | `Ready` → `Todo` → 最接近的 unstarted 状态 | 否 |
| `execution_started` / `repair_started` | `In Progress` → 最接近的 started 状态 | 否 |
| `review_started` | `In Review` → started 状态并写 phase record | 否 |
| `technically_ready` | `Ready for Milestone` → `Pending Acceptance` → `In Review`；必须选择非 completed 状态 | 否 |
| `acceptance_rejected` | `In Progress` → started 状态 | 否 |
| `accepted_delivery_pending` | `Accepted` → `Ready to Deliver` → `Pending Delivery`；不存在时保持当前非终态并写 acceptance record | 否 |
| `done` | 团队真实 completed/Done 状态 | 是 |

`done` 的调用方必须同时提供并验证：

```text
current human acceptance event
AND accepted artifact / commit 与当前交付一致
AND required delivery target reached
AND no lifecycle projection conflict
```

项目要求 PR 时，accepted-but-unmerged 不满足 `done`。Milestone 验收可以覆盖明确列出的 child Issue IDs 与 accepted commits；未被覆盖的 child 不得进入 Done。

## Milestone / Issue Proposal

- Milestone 没有可用 status 时，在 description 与 Project Update 写 typed marker、local id、plan revision 和 fingerprint。
- Issue 使用稳定 marker `VibeRig-Plan-Item: <requirement-id>:issue:<local-id>`；标题只辅助搜索。
- zero match 才创建；one structurally valid match adopt/update；multiple、malformed、identity conflict fail closed。
- 计划修订复用 local id 和 Linear identity；移除项标 `superseded`，不默认删除。
- 全部 Milestone / Issue read-back 成功后，才可向用户请求计划确认。

## Write-Ahead And Recovery

1. 本地 journal/outbox 持久化 intent；
2. 调用 Linear；
3. read-back 验证 status、marker、identity 与 fingerprint；
4. 一致时 ack；不一致时标 `conflict` 并停止；
5. Linear 不可用时保持 `pending/unavailable`，不得声称已同步。
