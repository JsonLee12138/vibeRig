---
name: merge-issue
description: 合并一个不挂在任何里程碑下的独立 issue 自己的 PR 到 main。当某个 issue 没有里程碑归属、由 task-runner 直接开出面向 main 的 PR、且 accept-issue 已经验收通过后使用。挂在里程碑下的 issue 不适用——那些 PR 只能在 accept-milestone 里合并。
---

# Merge Issue（单 issue PR 合并）

用本 skill 专门处理"没有里程碑、只有单个 issue 自己面向 main 的 PR"这一种情况的合并动作。存在这个 skill 的唯一目的：把"这个 issue 现在能不能合"这个判断收敛到一个专门、狭窄的地方，不让 `task-runner` / `accept-issue` 里掺杂这层判断逻辑——避免归属判断错了导致提前合并或漏合并。

## 契约

- 范围：一个 issue 自己的、直接面向 main 的 PR。
- 前置：`accept-issue` 已经对这个 issue 验收通过。
- **强制前置检查（红线级）**：这个 issue 不属于任何里程碑。检查 main 分支工作区的 `requirement.yaml` 里所有 `milestones[].issues`（或 Linear 上该 issue 的 Milestone 字段）——只要命中任何一个里程碑，立即拒绝执行，告诉用户改走 `accept-milestone`。判断不出归属（比如既查不到 requirement.yaml 也查不到 Linear milestone 字段）时，同样拒绝并停下问用户，不允许自行判定为"没有里程碑"。
- 不重跑 AC/TC、不改验收结论、不新建 PR——这些由 `accept-issue` 的证据审核和人工结论负责。
- 只做：归属检查 → 验收来源一致性检查 → 可合并性检查 → 合并 → 本地/远程同步 → 记录。`insights → vb-wiki` 已由 `accept-issue` 在验收通过时完成，本 skill 不重复执行。

## 流程

1. 解析入参（issue id/key）。
2. **归属检查**：读 main 分支工作区的 `requirement.yaml`（含 `archive/`）与 Linear 该 issue 的 Milestone 字段，确认它不挂在任何里程碑下。
   - 命中里程碑 → 停止，告诉用户这个 issue 属于里程碑 `<milestone-id>`，改走 `accept-milestone`。
   - 无法判定（数据缺失/矛盾）→ 停止并报告，问用户确认归属，不自行假定。
3. **验收检查**：读该 issue 的 Linear 评论和[验收学习状态](../insights/references/acceptance-learning-state.md)，确认 `accept-issue` 已经给出 active 验收记录，并取得 `acceptance_event`、`accepted_commit`、不可变 `delivery_target`、已有 `delivery_intent` / `delivery_event` 与 phase state。没有验收记录 → 停止，告诉用户先走 `accept-issue`。`insights` 未完成、wiki 未 `committed` / `zero_atoms`，`wiki: committed` 后 promotion 仍为 `not_started`，或 `wiki: zero_atoms` 后 promotion 仍未写成 `not_applicable` → 记录 `learning_resume_pending` 并在最终报告中指示用同一 event 恢复 `accept-issue <issue-key>`，但不得把知识收尾失败解释为验收失败，也不得阻断用户另行授权的合并；本 skill 不补跑正常复盘、知识编辑/提交或 promotion。`proposal_pending` 是可交付 outbox 等待态；`approved` / `applying` / `failed` 是独立工具应用恢复态，记录 `promotion_resume_pending` 并允许合并继续，最终报告必须路由回 `vb-wiki`，不得静默当成终态。legacy event 仅能从一个唯一且与 accepted source 一致的 provider PR 补全 `delivery_target`；任何歧义 fail closed。
4. **PR 状态分流（先于 open-PR mergeability）**：只按 `delivery_target` 的 provider/repository/PR number/URL 定位面向 main 的 PR，`git fetch` exact remote base 后先读 provider 状态：
   - `CLOSED` 且未合并或状态未知 → 停止，不制造 delivery；
   - `MERGED` → 不得再次调用 merge API。严格证明 immutable PR identity、exact base ref、final provider head 等于 stored accepted head（或存在验收前已持久化且绑定两端 full OID 的结构化等价证明），并取得唯一 full `provider_merge_commit_oid`；有 matching intent 时 `merge_origin: viberig_intent`，没有 intent 只标 `merge_origin: provider_observed`，不得反推此前授权/执行者或事后伪造 intent；然后跳到步骤 6 的 commit/reachability 证明；
   - `OPEN` → 确认 PR 当前内容、验收记录、Proof Packet 与 Required CI 都对应 `accepted_commit`，再检查 mergeability：
     - head hash 变化但树和行为与 `accepted_commit` 等价 → 只接受验收前已持久化、绑定两端 full OID 的结构化等价证明；否则回到 `accept-issue`；
     - 代码、配置、依赖或行为实质变化 → 停止并重新完成受影响证据与验收；不得把 merge 当作更新复盘/wiki 的时机；
     - 有冲突 → 和用户逐处确认取舍，不自作主张；解决后除非严格证明等价，否则重新验收。“同意冲突取舍”不等于重新验收；
     - CI 未过、必需审批未齐全 → 停止并报告，不合并。
5. **持久化 delivery_intent 后才合并 OPEN PR**：取 exact `expected_base_oid`、`expected_head_oid` 与 merge method，按状态契约计算 `delivery_intent.id`；在任何 merge API 前，先请 `vb-linear` 向该 Issue comments 写唯一完整的 `VibeRig-Record: delivery-intent:<intent-id>`，绑定 exact acceptance/source/PR/base/head/method 与当前合并授权 `merge_authorization_record`。zero matches 写入，one structurally complete match 认领，multiple/malformed/conflict fail closed。随后重验动态 gate，并用 `expected_head_oid` CAS（provider 不支持则调用前立即重读）只调用一次 merge；prepared intent 的 retry 不重复索取同一授权，绑定漂移或后续明确撤销则停止。
6. **证明 provider merge commit 并同步**：无论步骤 4 接管还是步骤 5 刚合并，都只从 provider immutable merge metadata 取得唯一 full `provider_merge_commit_oid`；fetch exact target ref，证明该 OID 是 commit 且 `git merge-base --is-ancestor <provider_merge_commit_oid> <remote/base-ref>` 成功。不得使用目标分支当前 HEAD 代替 provider OID；缺失、不唯一或不可达返回 `blocked: delivery_commit_unproven`。证明后把本地 main 与远程 main 同步一致。
7. **先持久化交付事件**：用 `provider_merge_commit_oid` 生成 `delivery_event.id = delivery:<issue-key>:<accepted-source-fingerprint>:<provider_merge_commit_oid>`，先在 mapped Issue comments 查 exact typed delivery marker：zero matches 写 `pending`，one structurally complete match 认领，multiple/malformed 或同一 PR/source 映射不同 OID/event 返回 `blocked: delivery_event_conflict`。
8. **记录并复用验收收尾**：只有 `pending` delivery event 已持久化后，才请 `vb-linear` 在该 Issue 下记录 PR 链接、provider merge OID、`merge_origin` 与同步结果。基础 wiki 为 `committed` / `zero_atoms` 时，以该 event 和 `reconcile_only: true` 调用 `vb-wiki <issue-key>`，只核对交付内容并按需补 merge 来源；`failed` 只恢复 reconciliation，`reconciled` 幂等返回。基础学习未完成时只保持 delivery reconciliation pending，并把 `learning_resume_pending` 路由回同一 `accept-issue` event；不得在本 skill 重新知识编辑、重写复盘或再次运行工具晋升门禁。
9. 报告：PR 链接、`accepted_commit`、合并 commit hash、内容一致性依据、是否遇到冲突及如何解决、本地/远程同步结果，以及已复用的复盘/wiki 引用。若同一 acceptance event 仍有 queued `proposal_pending`，从 durable outbox 重放同一 candidate ID；若为 `approved` / `applying` / `failed`，报告 `promotion_resume_pending` 并交回 `vb-wiki` 恢复同一批准。只有用户明确同意 queued ID 才记录独立 approval。本 skill 不直接调用 `vb-learn`，重复报告也不生成新候选。

## 红线

- 该 issue 挂在某个里程碑下却在本 skill 合并了 → 里程碑内的 issue 只能在 `accept-milestone` 合并，本 skill 必须先拒绝。
- 归属判断不出来却自行当作"没有里程碑"处理 → 必须停下问用户，不允许猜测。
- `accept-issue` 还没验收通过就合并 → 验收通过是合并的前提，没有就停止。
- 有冲突时自作主张解决，没有和用户逐处确认取舍 → 必须先确认。
- 在本 skill 里重新做了 AC 验证或改了验收结论 → 那是 `accept-issue` 的职责，不要重复。
- Proof Packet、验收记录或 CI 对应旧内容却仍合并 → 当前 PR 必须与 `accepted_commit` 内容一致；实质漂移必须重新验收。
- 合并后没有把本地 main 和远程同步 → 必须同步，避免后续操作基于过期的本地状态。
- 把 `insights` / 正常 `vb-wiki` 沉淀延迟到本 skill，或在这里重复 atomization、promotion、调用 `vb-learn` → 学习边界是验收通过；本 skill 只允许 `reconcile_only`。
- 发现验收学习 phase 未完成后由本 skill 自己补跑，或把收尾失败当成验收/交付失败 → 错；记录 `learning_resume_pending`，允许另行授权的合并继续，恢复责任仍属于同一 `accept-issue` 事件。
- provider 已显示 `MERGED` 后再次调用 merge；或未证明 immutable PR identity、accepted head、唯一 `provider_merge_commit_oid` 与 remote-base reachability 就认领 delivery。
- merge API 前未先持久化完整 `delivery_intent`，或用目标分支当前 HEAD 冒充 provider merge OID；恢复时不得事后伪造授权/intent。

## 检查清单

- [ ] 已确认该 issue 不属于任何里程碑（检查过 requirement.yaml 与 Linear milestone 字段）。
- [ ] 已确认 `accept-issue` 验收通过记录存在。
- [ ] Proof Packet、验收记录和 Required CI 均对应 `accepted_commit`，PR 当前内容与其一致。
- [ ] 已 `git fetch` 拉最新 main，确认无冲突（或冲突已与用户确认取舍后解决）、CI 通过、审批齐全。
- [ ] OPEN 合并前已持久化 exact `delivery_intent`；MERGED 接管已证明 provider OID 与 remote base，且未重复调用 merge。
- [ ] PR 已合并；本地 main 与远程已同步一致。
- [ ] 合并结果（PR 链接、commit hash）已写入 Linear 评论。
- [ ] 已读取 `accept-issue` 的 insights/wiki/promotion phase；基础不完整显式记录 `learning_resume_pending` 且未在本 skill 补跑，已批准但未完成的工具应用记录 `promotion_resume_pending`，二者均未冒充验收失败或阻断另行授权的合并。
- [ ] `pending` delivery event 已先持久化且冲突检查通过；reconcile 使用独立 `delivery_event.id`，未重复 retrospective、atomization、promotion、`vb-learn` 或自动创建 skill。
