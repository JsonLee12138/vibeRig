---
name: accept-issue
description: 对 standalone、高风险或用户明确抽查的单个 Issue 做证据审核与人工验收。当用户说“验收这个 issue”“抽查这个 issue”或明确给出单点验收结论时使用；普通里程碑 Issue 默认等待 accept-milestone 统一验收。
---

# Accept Issue（单 Issue 验收）

## 契约

- 只由用户手动触发，不从 `task-runner` / `agent-sop` 自动调用。
- 适用于 standalone、高风险或显式抽查；普通里程碑 Issue 的技术证据可直接由 `accept-milestone` 汇总，不强制逐个验收。
- 只审核当前 Issue 及 sub-issue，不操作 PR、不合并、不碰 main、不清理 worktree。
- 测试、CI 和 Proof Packet 不能替代用户验收结论；若用户只要求“开始验收”，先执行检查，再请求明确结论。
- 明确的人工验收通过就是复盘与知识沉淀边界，不等待 PR 合并，也不等待所属 Milestone 验收；合并状态只作为来源元数据和后续一致性检查。
- 验收通过授权本流程执行 `insights → vb-wiki`，但不等于用户授权创建 skill；工具化仍需 `vb-wiki` 完成知识提交并取得单独明确授权。
- 入口必须先查持久化 active event；`pending_acceptance` 和“当前对话再次验收”只约束新事件。用户明确要求继续/重试同一 event 时进入 `recovery_only`，不得要求重复验收。

## 证据复用

先读 `acceptance.json`、`test-cases.json`、`traceability.json` 与 Proof Packet；代码成果再读 PR 当前 commit/CI，非代码成果读取待验收的 immutable 或 content-backed final record：

- commit、要求环境、测试定义一致的成功自动化证据直接复用，不重跑；
- 新 commit、合入最新 main、相关代码/测试/Fixture/依赖变化或环境不满足时，只重跑受影响 TC/Gate；
- `manual`、`owner_uat` 与尚未真实执行的步骤不能从自动化结果推断 PASS；
- 旧需求没有 TC 时进入 `legacy mode`，按相关 AC 的 `verification` 做窄范围验证。

## 验收评论

评论必须让人可以复现：在哪个文件配置什么、运行什么、打开哪个入口、按什么顺序操作、实际看到哪些精确数据/页面状态、失败信号是什么。不得只写“功能正常”或“验证通过”。

## 流程

1. **恢复探测优先**：读 `.vibeRig/project.yaml`，解析 Issue、归属、全部 sub-issue、评论、Proof Packet 和 PR；在任何新验收门禁前，按[验收学习状态](../insights/references/acceptance-learning-state.md)从该 Issue comments 的 typed markers 查同 scope 的非撤回 event。若用户明确说继续/重试或携带 exact `learning_resume_required` / `learning_resume_pending`，且唯一 event 的 `acceptance: recorded`、canonical source fingerprint 与可解析的 accepted source 均有效，则进入 `recovery_only`，跳过步骤 2–6，从步骤 7 首个未完成 phase 恢复；不得重跑已完成 Evidence、重写验收评论、创建 revision 或要求再次验收。多条候选、坏记录或 fingerprint 不一致 fail closed；“重新验收”与“继续收尾”语义不清时展示 event ID 后询问，不自行选择。当前 PR 漂移只阻断后续交付，不得改写或阻断既有 accepted source 的复盘/wiki 收尾。
2. **仅新验收**：定位相关 AC/TC；若是普通里程碑 Issue，说明单点验收是可选抽查，但用户已经明确要求时继续。
3. 审核 Evidence：逐 TC 判断 `PASS`、`FAIL`、`SKIP`、`BLOCKED` 及有效性；代码成果核对当前 commit 的 Required CI 与必需 Review，非代码成果核对 final record 身份、内容和相应批准证据。
4. 只补做缺失、失效或本层人工 TC。属于 `milestone` / `post_release` 的 TC 留给对应阶段；Required TC 失败或阻塞时停止。
5. 按相关 `ownerVerification` / `verification` 展开人工步骤，记录真实结果；向用户汇报证据和残余风险。
6. **仅新验收的人工门禁**：用户已在当前对话明确批准时进入通过分支；否则等待用户给出通过、拒绝或条件性结论。`recovery_only` 不经过此门禁，因为它只恢复已经持久化的同一结论。
7. **通过或恢复**：
   - 新验收先确认 source 与已审 Evidence 一致：code-backed source 锁定 full `accepted_commit` 并以其生成 `accepted_source_fingerprint`；non-code source 锁定 immutable record ID，或锁定 exact normalized content-backed accepted record 后按 canonical payload 生成 fingerprint，不得虚构 commit。`recovery_only` 只采用步骤 1 已严格证明的 accepted source，并从首个未完成 phase 继续；
   - 无 active event 时才计算 `acceptance_event.id = acceptance:<issue-key>:<accepted-source-fingerprint>:r<revision>`。在 canonical acceptance 评论真正写入前，必须以 exact scope + fingerprint + revision 做最后一次 typed-marker 查重：zero matches 才请 `vb-linear` 写一次同时带 `VibeRig-Event` 与 `VibeRig-Record: acceptance:<event-id>` marker、accepted source、初始 phase state 和精确交付目标；one structurally valid match 立即认领并切到 recovery，multiple/malformed/conflict fail closed，不得再写。standalone direct-to-main PR 才写不可变 `delivery_target.kind: pull_request`（provider/repository/number/URL、exact target、full accepted head）；挂里程碑写 `milestone_handoff` + stable Milestone ID；非代码/已在权威分支写 `no_merge_required`，不得为它们虚构 main PR。随后把 Issue 与全部 sub-issue 更新到团队最接近 Done 的状态；被撤回后对同一 source 重新验收必须递增 revision；已有 event 只续写 phase overlay；
   - 记录 `delivery_state`：挂里程碑为 `accepted_in_milestone`，standalone 待合并 PR 为 `accepted_unmerged`，已在权威分支为 `authoritative_branch`，已合并为 `merged`，非代码成果为 `no_merge_required`；不得用该字段决定是否学习；
   - **立即复盘**：仅当 `insights` phase 未完成时，以验收评论和 `accepted_commit`（非代码成果用最终记录）触发 `insights`；成功记录 comment，失败记录 `insights: failed`，重试时恢复同一 event。不得因 PR 尚未合并或 Issue 挂在 Milestone 下而延迟；
   - **立即入库**：`insights: completed` 后检查 wiki 与 promotion 两层 state，并以 `defer_promotion_question: true` 立刻触发/恢复 `vb-wiki <issue-key>`：wiki 为 `pending` / `writing` / `commit_pending` / `failed`；或 `wiki: committed` 且 promotion 为 `not_started` / `approved` / `applying` / `failed`；或 `wiki: zero_atoms` 且 promotion 仍为 `not_started` 时都必须调用。最后一种只恢复写入 `promotion: not_applicable`，不得重新 atomize。`proposal_pending` 进入 durable-outbox 等待态，`wiki_only` / `declined` / `completed` / `not_applicable` 才是 promotion 终态。`delivery_state` 只是元数据。每次结果必须写回 phase state，避免 commit/zero-atom 后 promotion 漏评估或批准后工具漏应用；
   - `vb-wiki` 可以在知识提交后产生至多一个 `proposal_pending`，但必须按 phase state 恢复，不得从 wiki commit 推断已经评估。`defer_promotion_question` 只保证问题不打断 `insights → vb-wiki`；本次验收最终报告无论后续是否待合并/Milestone 交付，都从 durable outbox 展示同一 candidate ID。若最终响应中断，重试可重放同一 ID，直到用户明确 yes/no；重复展示不生成新候选。用户回复必须交回 `vb-wiki` 绑定 candidate，本 skill 不判断、不创建 skill。若复盘或 wiki 收尾失败，保留验收结论、记录可恢复 phase 并报告“验收成功、知识收尾部分失败”，不得回滚或伪装成验收失败；
   - **后续交付路由**：挂里程碑的 Issue 仍由 `accept-milestone` 聚合与合并；standalone 且 PR 尚未合入 main 时仍告知下一步 `merge-issue`。两者都复用本次复盘和 wiki 结果，不再次执行同一 Issue 的学习链路。
8. **发现问题**：请 `vb-linear` 创建关联 AC-ID/TC-ID、失败证据和修复验证方式的 `type:acceptance-fix` Issue；挂同一 Milestone，原 Issue 保持非终态，修复继续走 `task-runner`。

## 红线

- 相同 commit 的有效 CI/自动化证据被无条件重跑。
- 从 Proof Packet 或测试通过推断用户已经验收。
- 在 durable `acceptance: recorded` 的明确恢复请求中要求用户重复验收，或先做 mutable status 门禁再查 active event。
- 人工、里程碑或发布 TC 未真实执行却标 PASS。
- 在本 skill 发起、更新或合并 PR。
- 普通里程碑 Issue 被描述为必须逐个人工验收。
- 只更新主 Issue，遗漏 sub-issue。
- 验收通过后仍因“未合并”或“挂里程碑”延迟 `insights` / `vb-wiki`，或从验收通过推断用户同意创建 skill。
- 从本 skill 调用 `vb-learn`；知识到工具的晋升只能由 `vb-wiki` 在知识提交后提议，并等待单独授权。

## 完成检查

- [ ] Evidence 对应当前 commit 或 non-code accepted record、要求环境和测试定义；复用与重跑都有理由。
- [ ] Required TC、CI 与 Review 无失败；后续阶段 TC 已明确交接。
- [ ] 新 event 有当前明确验收结论；`recovery_only` 则有唯一、有效、source 未漂移的既有 acceptance event，且未要求重复验收。
- [ ] 状态覆盖 Issue 与全部 sub-issue，未操作 PR/main/worktree。
- [ ] 通过后已立即执行或按 phase state 恢复 `insights → vb-wiki`；未因 merge / Milestone 状态延迟，也未重复验收评论、知识 commit 或 promotion。
- [ ] 未调用 `vb-learn`，未把验收授权扩张为 skill 创建授权；失败时建立可追踪的修复 Issue。
- [ ] 人读内容使用 `output.language`。
