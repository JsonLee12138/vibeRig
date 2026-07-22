---
name: accept-milestone
description: 对完整里程碑执行证据汇总、增量回归、E2E、老板 UAT、PR 审核与最终合并。当用户要求“验收里程碑”“验收通过并合并”时使用；普通 Issue 不要求预先逐个人工验收。
---

# Accept Milestone（里程碑验收）

## 契约

- 新验收范围是一个 `pending_acceptance` 里程碑及其全部 Issue、sub-issue 和常驻集成 PR；已有 durable event 的 `recovery_only` 也适用于已经变成 `accepted`、但复盘/wiki、交付 reconciliation、聚合、候选重放或最终报告尚未完成的同一里程碑。
- 普通 Issue 只需具备 `task-runner` 的有效技术 Evidence；standalone 不适用。
- 用户触发“开始验收”只授权检查；当前对话中明确“验收通过”后立即复盘和入库，只有另有明确合并授权时才允许合并和写交付终态。
- 不做新功能开发、不新建 PR。缺陷走“缺陷回流”。
- `requirement.yaml` 只在 main 分支工作区读写。
- 入口顺序固定为“恢复探测 → 新事件状态门禁”：`status: accepted` 只允许 recovery-only；不得先用 mutable Milestone status 拒绝已有事件，也不得要求同一 accepted source 再次人工验收。

## 证据与回归边界

- 汇总每个 Issue 的 Proof Packet、AC/TC 覆盖、Review、PR CI 和残余风险。
- 相同 commit、要求环境和测试定义的成功 Unit/Integration/Contract Evidence 直接复用。
- 只执行 `executionStage: milestone` 的 TC、跨 Issue E2E、里程碑回归集合、失效 Required Gate 和老板 UAT。
- 不把“全量回归”解释为人工重跑每个 Issue 的全部单元测试。
- 旧需求没有 TC 时按里程碑 AC 进入 `legacy mode`，仍避免重复执行同一有效命令。

## 验收记录

Project Update 验收记录按 `acceptance-guide.md` / `ownerVerification` 展开：前置配置、命令/服务、入口、顺序操作、精确数据、页面/图表状态、失败信号、证据和清理。禁止抽象结论。

## 流程（严格按顺序）

0. **恢复路由（先于状态门禁）**：读 main 工作区 `requirement.yaml` 只解析稳定 Milestone scope、registered Linear Project host、所属需求/PRD及是否最后一个里程碑；在检查 `pending_acceptance`、PR/Evidence/CI/UAT 或询问新验收结论前，先从 Project Updates 的 typed markers 重建同 scope 的 `acceptance_event` / `delivery_intent` / `delivery_event`，以及所属 requirement 的 `aggregation_event`。用户明确说继续/重试或携带 exact event 恢复请求时，唯一且结构有效的非撤回 `acceptance: recorded` 是跨对话 durable authority：重算 canonical source fingerprint 并验证 accepted source 后进入 `recovery_only`，不得再次要求验收、重跑步骤 1–7、重写 acceptance record 或创建 revision；acceptance 恢复首个未完成 phase，delivery-only resume 只完成 provider proof、状态同步和 `reconcile_only`，aggregation 只做 `aggregate_only`，只剩 queued proposal/final report 时只重放同一 outbox/报告。Milestone 已为 `accepted` 仍按此恢复；全部 phase 与交付均终态则返回 `already_processed`。多条候选、坏记录、source 不一致或意图含糊时 fail closed/展示 event ID 后询问，绝不猜测。
1. **新验收前置**：仅当步骤 0 没有可恢复/已记录 acceptance 且 Milestone 不是 `accepted` 时，才确认它为 `pending_acceptance`，并定位 `task-runner` 已维护的集成分支 → main PR。`status: accepted` 且缺少可证明事件时 fail closed，禁止补造新 acceptance event。
2. **Issue Evidence 审核**：枚举全部 Issue/sub-issue，核对当前集成 commit 上 Required TC、Gate 和 Review；普通 Issue 不要求已有 `accept-issue` 评论。缺失、失败或未批准风险阻塞验收。
3. **同步最新 main**：`git fetch` 后将最新远程 main rebase/merge 到集成分支。冲突必须逐处说明双方意图和影响并与用户确认；不得自行取舍。产生新 commit 时 push 更新原 PR，并使相关 Evidence 失效。
4. **当前 commit CI**：等待/读取 Required Checks；只接受与同步后 commit 一致的结果。失败时停止并回流。
5. **里程碑验证**：执行里程碑 TC、跨 Issue E2E、增量回归、失效 Gate 和 `gate_policy.manual_checks`；逐条记录环境、执行者、命令/步骤、结果和证据。
6. **老板 UAT**：按验收指南完成配置、启动、操作、数据和可视化检查；记录失败信号、证据、清理和残余风险。
7. **仅新事件的验收门禁**：先锁定当前集成 PR full head 为 `accepted_commit` / `accepted_source_fingerprint`，再按同 scope + fingerprint 做 race-safe typed-marker 查询；若已出现有效 `acceptance: recorded`，立即切到 `recovery_only` 并进入步骤 8，不要求当前对话再次验收。只有仍无 event 时，才汇报 TC/Gate/CI/UAT 与风险并要求用户在当前对话明确“验收通过”；随后只计算 `acceptance_event.id = acceptance:<milestone-id>:<accepted-source-fingerprint>:r<revision>` 并准备 immutable `delivery_target` 与初始 phase payload，**本步骤不写 acceptance record**。若只说“开始验收”，等待明确结论。验收授权与合并授权分别记录，不能互相推断。
8. **唯一验收记录、立即复盘与知识沉淀**：Milestone 没有评论 API。新 event 在 Project Update 真正写入前，以 exact scope + fingerprint + revision 做最后一次 typed-marker 查重：zero matches 才请 `vb-linear` 写一次同时带 `VibeRig-Event` 与 `VibeRig-Record: acceptance:<event-id>` marker、accepted source、`delivery_target`、phase state 和可复现步骤的验收记录；one structurally valid match 立即认领为 recovery，multiple/malformed/conflict fail closed，不得再写。恢复 event 只在同一 host 续写 phase overlay。把已处理的 Issue 事件作为 `prior_acceptance_events` 传给 `insights`，只新增跨 Issue 集成、Milestone TC/E2E/UAT 或未覆盖证据的 signals，Issue signals 只引用、不复制。先恢复/触发未完成的 `insights`（仍写/查同一 Project Updates host，但只匹配 retrospective typed marker），成功后检查 wiki + promotion 两层 state：wiki `pending` / `writing` / `commit_pending` / `failed`；或 `wiki: committed` 且 promotion 为 `not_started` / `approved` / `applying` / `failed`；或 `wiki: zero_atoms` 且 promotion 仍为 `not_started`，都以 `defer_promotion_question: true` 立即恢复/触发 `vb-wiki <milestone-id>`。zero-atom 分支只补 `promotion: not_applicable`，不重新 atomize；`proposal_pending` 是 outbox 等待态，其余明确终态才跳过。不得等待 PR 合并。每个 phase 结果都以 `VibeRig-Record: phase:<event-id>` 写回该 host。defer 只避免工具问题打断已授权步骤，不由本 skill 直接调用 `vb-learn`。收尾失败不撤销验收，也不阻断已单独授权的合并；报告可恢复的失败 phase。
9. **待执行合并的授权门禁**：先读 provider PR 状态；只有 `OPEN`、下一步会产生新的 merge 外部副作用、且没有 exact 未撤销 `prepared` delivery intent 时，才要求用户在当前对话明确授权合并。已有 matching intent 的 retry 复用其 durable `merge_authorization_record`，只重验动态 gate 与 exact base/head binding，不重复询问；后续明确撤销优先。若只批准验收，收集当前 event 与 `prior_acceptance_events` 中所有 `proposal_pending` queued outbox，按 candidate ID raw UTF-8 bytes 稳定排序并逐条展示；多个候选要求回复明确写 candidate ID。它们保持 queued、允许重试重放，直到 bound yes/no acknowledgment。然后以 `merge_pending` 停止；用户对 candidate 的回复交回 `vb-wiki`，不能解释成合并授权。`MERGED` recovery 不重新索取合并授权，也绝不能再次调用 merge API。
10. **PR 状态分流、写前意图与合并证明**：始终先按 immutable `delivery_target` 读取 provider 状态，再做 open-PR mergeability 逻辑。
    - `CLOSED` 且未合并或状态未知：fail closed，不制造 delivery。
    - `MERGED`：不得再次 merge。严格证明 repository/PR identity、exact base ref 与 final provider head 对应 accepted source（或验收前已持久化且绑定两端 full OID 的结构化等价证明）；取得唯一 full `provider_merge_commit_oid`。有 matching `delivery_intent` 时标记 `merge_origin: viberig_intent`；没有 intent 只可标记事实来源 `merge_origin: provider_observed`，不得反推此前授权、执行者或事后伪造 intent。
    - `OPEN`：再次确认 head 与 `accepted_commit` 内容一致、目标为 main、CI、冲突、必需审批和批准范围均满足；取 exact `expected_base_oid` / `expected_head_oid` 和 merge method，按状态契约计算 `delivery_intent.id`，在调用合并 API **之前**先向同一 Project Updates host 写唯一完整的 `VibeRig-Record: delivery-intent:<intent-id>`，绑定 `merge_authorization_record`。zero/one/multiple 规则分别为写入/认领/fail closed；之后用 `expected_head_oid` CAS（provider 不支持则调用前立即重读）只调用一次 merge。prepared intent 的 retry 重验动态门禁但不重复索取同一授权；任何绑定漂移停止并重新验收/授权。
    - 两种 merged 路径都 fetch exact remote base ref，验证 provider OID 是 commit 且执行 `git merge-base --is-ancestor <provider_merge_commit_oid> <remote/base-ref>` 成功。不得使用目标分支当前 HEAD 代替 `provider_merge_commit_oid`，否则返回 `blocked: delivery_commit_unproven`。仅 merge/squash 造成 commit hash 变化不算内容漂移；实质变化必须重新验收。
11. **先持久化交付事件，再同步状态/reconcile**：用 `provider_merge_commit_oid` 生成 `delivery_event.id = delivery:<milestone-id>:<accepted-source-fingerprint>:<provider_merge_commit_oid>`，先在 mapped Project Updates 查 exact typed delivery marker：zero matches 写 `pending`，one structurally complete match 认领其状态，multiple/malformed 或同一 PR/source 映射不同 OID/event 返回 `blocked: delivery_event_conflict`。只有 pending 已持久化后，才同步本地 main、请 `vb-linear` 更新全部 Issue/sub-issue 与合并 Project Update、在 main 工作区把 Milestone 置 `accepted`。wiki 为 `committed` / `zero_atoms` 时以 `reconcile_only: true` 调用 `vb-wiki <milestone-id>`；`failed` 只恢复 reconciliation，`reconciled` 幂等返回，绝不重新 atomize、promotion 或复盘。wiki 未完成则记录 reconciliation pending，留给同一 event 恢复。
12. **需求归档**：最后一个 Milestone 时，只有全部子事件均为 `insights: completed` 且 wiki 为 `committed` / `zero_atoms`，才以这些显式 Milestone `acceptance_event` 派生 aggregation：exact child IDs 按 raw UTF-8 bytes 升序、以 `LF` 连接并保留结尾 `LF`，取完整 lowercase SHA-256，生成 `aggregation_event.id = aggregate:<requirement-id>:<digest>`，同时把同一 IDs 存在 `aggregation_event.derived_from` 并在每次恢复时复算校验。用 `aggregate_only: true` 执行 `insights` 和 `vb-wiki <requirement-id>`，其 retrospective/phase record 仍写入并只搜索同一 registered Project Updates host，只汇总、交叉链接和去重既有结论。它不是 `acceptance_event`，不设置 `human_accepted`，不引入新 claims，也不运行工具晋升门禁；子 phase 不完整时记录 aggregation pending，不伪造聚合。关联 PRD 仅在全部需求 accepted 后归档。
13. **发布验证**：若本流程包含部署，执行 `post_release` Smoke，并按风险检查日志、指标、告警与回滚；未部署则记录为发布交接项，不伪造 PASS。
14. **清理**：仅在 PR 已合入、分支无未推送 commit、worktree 干净时移除 worktree；否则保留并报告。
15. **最终报告**：汇总验收、即时复盘/wiki、phase 恢复、合并/reconciliation、聚合、发布与清理结果。按相同稳定规则重放 current + prior events 中仍 queued 的 `proposal_pending` candidate IDs；多个候选必须逐个按 ID 回答。只有用户明确同意某个 ID，才记录独立 approval 并交回 `vb-wiki` 按同一 candidate 恢复工具应用，本 skill 不直接调用 `vb-learn`。

## 缺陷回流

失败必须关联 AC-ID/TC-ID、当前 commit、环境和证据。产品缺口回到定向需求评审；实现缺陷走 `bugger`/修复 Issue 并挂当前 Milestone；环境或 CI 故障标明阻塞源。只重跑失败 TC、直接依赖 TC 和失效 Gate。

## 红线

- 在同步最新 main 前完成最终回归并直接复用旧 commit 证据。
- 无条件重跑全部 Issue 的 Unit/Integration 测试。
- 普通 Issue 因未走 `accept-issue` 而被拒绝，即使技术 Evidence 完整有效。
- 用户只说“开始验收”就推断批准并合并。
- 已有 `acceptance: recorded` 却因当前对话没有再次验收措辞、或 Milestone 不再是 `pending_acceptance`，而重跑 TC/UAT、新建 event 或再次索要验收。
- Required TC、CI、UAT 或审批未通过却合并。
- 自行解决有实质取舍的冲突；或在本 skill 新建 PR。
- 未部署却把发布 Smoke 标 PASS。
- 验收通过后仍等待 PR 合并才写复盘/wiki，或把里程碑验收授权解释成合并授权或 skill 创建授权。
- 验收后的 PR head 发生实质变化却沿用旧 Evidence、旧验收或旧知识继续合并。
- provider 已显示 `MERGED` 却再次调用 merge；或未证明 immutable PR identity、accepted head、唯一 `provider_merge_commit_oid` 与 remote-base reachability 就认领 delivery。
- 调用 merge API 前未先持久化完整 `delivery_intent`；或用目标分支当前 HEAD 冒充 provider merge OID，导致 delivery ID 漂移。
- 从本 skill 调用 `vb-learn`；工具晋升必须先由 `vb-wiki` 完成知识提交，再取得单独的用户确认。

## 完成检查

- [ ] 已先重建 acceptance/delivery/aggregation 状态；新验收才要求 `pending_acceptance`，`accepted` 上的 recovery-only 未重复验收或已完成 Evidence。
- [ ] 前置状态、PR、全部 Issue Evidence 与当前 commit 已核对（恢复模式只复核持久化 source/PR identity）。
- [ ] 最新 main 已同步；相关 CI、里程碑 TC、E2E、增量回归和 UAT 通过。
- [ ] 用户明确验收通过后已立即完成或恢复 `insights → vb-wiki`；`prior_acceptance_events` 只产生 Milestone delta，合并授权与验收授权分别核对。
- [ ] Project Update 验收记录可复现；全部 Issue/sub-issue、Project Update 和 requirement 状态已更新，未假设 Milestone comments 存在。
- [ ] 合并前 PR head 与 `accepted_commit` 内容一致；合并后只补交付记录，没有重复执行学习链路。
- [ ] OPEN 合并前已持久化 exact `delivery_intent`；MERGED 接管已证明 provider OID 与 remote base，先落 `pending` delivery event，且未重复 merge。
- [ ] 最后一个 Milestone 的需求级聚合、归档、发布交接和 worktree 清理均有结果。
- [ ] 未调用 `vb-learn`，未自动创建或更新任何 skill。
- [ ] 人读内容使用 `output.language`。
