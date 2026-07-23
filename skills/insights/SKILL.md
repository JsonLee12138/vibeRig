---
name: insights
description: 将已人工验收的 Evidence 编译为证据化复盘，记录 Subagent/model 路由结果与可比学习样本，并判断是否存在值得写入 vb-wiki 的新颖知识。由 accept-deliver 在 novelty、重复缺陷、Milestone、模型路由观察或批量阈值命中时内部调用；也可在用户明确要求复盘时使用。零知识是成功结果，不创建 Skill，也不凭单次结果自动改模型默认值。
---

# Insights

从 accepted Evidence 中提取真正会改变未来判断或执行方式的知识。不要把每次验收都变成重型学习事务。

## 进入条件

满足至少一项时运行：

- 用户明确要求复盘或沉淀；
- 出现此前未记录的因果机制、约束、失败模式或验证方法；
- 同类缺陷或返工重复出现；
- Milestone/requirement 需要跨 Issue 综合；
- 达到项目配置的批量编译阈值；
- 高风险验收要求立即保存决策依据。

普通任务只有 changed files、命令、时间线或已知结论时，返回 `zero-atoms`，不加载完整 `vb-wiki` 写入协议。

存在合法 route observation 但没有新知识时仍可返回 `zero-atoms`。模型/Agent 观测写入本次 retrospective record，供 `update-team` 和后续 `subagent-routing` 聚合；它本身不强制 Wiki transaction。

## 输入

- explicit acceptance event；
- accepted source 或完整 commit；
- Work Item、Goal Contract、Evidence Packet；
- UAT、Review、CI、失败和返工记录；
- Evidence Packet 中 schema-valid `routingObservations`，在 retrospective 中归一化为 `routing_observations`；字段包括 capability、Agent、model/reasoning、policy action、预测、实际指标与 confounders；
- prior knowledge matches（若 Task Context 已查询则复用，不重复查询）；
- delivery state 只作 provenance。

没有人工验收时返回 `deferred: acceptance_missing`。聚合模式只能重放已完成的子 acceptance event，不制造新验收事实。

## Novelty Gate

候选结论必须同时满足：

1. 有 accepted Evidence；
2. 不只是任务时间线或 changed-file 摘要；
3. 能改变未来设计、诊断、验证或运维决策；
4. 有适用范围和失效条件；
5. 与现有 canonical knowledge 不重复。

模型路由观测不是天然的 knowledge atom。只有跨多个可比 accepted events 形成稳定、可失效、会改变未来路由的结论时，才进入 Novelty Gate；单次 observation 只做运行笔记。

| 结果 | 动作 |
|---|---|
| `zero-atoms` | 记录 Evidence 已审查，不调用 `vb-wiki` 写入 |
| `novel` | 生成最小 retrospective signals，交给 `vb-wiki` |
| `batch_pending` | 保存候选与证据，等待阈值编译 |
| `conflict` | 标记与现有知识冲突，交给 `vb-wiki` lint/consolidate |

## Workflow

1. 读取 [post-acceptance-retrospective.md](./references/post-acceptance-retrospective.md) 与 [learning-policy.md](./references/learning-policy.md)；
2. 验证 acceptance event、accepted source 和 Evidence；
3. 重建最终接受路径，排除已放弃尝试和未接受代码；
4. 与 Task Context 中已有知识匹配；必要时只查询一次；
5. 校验 route observations；缺字段、未由主 Agent 验证或无法绑定当前 accepted source 的样本标记为 excluded，不回忆性补数；
6. 按 provider、platform、task family、risk、oracle fingerprint、evidence fidelity 与 policy version 建立 comparison group；
7. 将模型、Agent role prompt、上下文、Skill/policy、环境、工具和主 Agent 返工分开做 credit assignment；有 confounder 的样本保留审计但不进入直接 A/B；
8. 记录 accepted outcome、quality score、rework、failure classes、latency、token 与真实 provider cost；价格不可见时保持 unknown；
9. 根据 [adaptive model routing](../subagent-routing/references/model-routing.md) 判断 incumbent、challenger、exploration eligibility 和 promotion/demotion 状态。少于 5 个可比样本不改变默认；
10. 应用 Novelty Gate；
11. 对保留信号记录 statement、confidence、evidence、applicability、scope 与 invalidation；
12. 对丢弃信号记录原因；
13. `novel` 或 `conflict` 时通过稳定 event id 交给 `vb-wiki`；`zero-atoms` 直接结束；
14. 不提出 Skill 名称，不调用 `vb-learn`。

## 输出

- scope、acceptance event、accepted source 和 delivery provenance；
- `zero-atoms`、`novel`、`batch_pending` 或 `conflict`；
- retained/discarded signal counts；
- Evidence 引用、适用范围和失效条件；
- route observation count、comparison groups、excluded/confounded samples、当前 incumbent、eligible challenger 和 next-trial reason；
- `vb-wiki` handoff 或不写入理由。

## 红线

- 每次验收无条件运行完整 Wiki transaction；
- 为避免空结果编造“经验”；
- 把 changed files、测试命令或 Issue 时间线当知识；
- 从未验收工作提取结论；
- 自动创建或修改 Skill；
- 从一次成功推出全局“最佳模型”；
- 把不同 provider、任务族、风险、oracle 或证据保真度混成一个比分；
- 为了探索让 challenger 拥有 accept/security/merge/release/生产副作用决策权；
- 在 provider 未提供价格时编造美元或 credits；
- 因知识写入失败撤销已成立的验收。

## 完成检查

- [ ] 所有保留信号有 accepted Evidence、适用范围和失效条件。
- [ ] 已检查重复、冲突与 novelty。
- [ ] `zero-atoms` 未调用重型 Wiki 写入。
- [ ] 结果使用稳定 event id，重试不重复写。
- [ ] 没有 Skill 提案或自动晋升。
- [ ] 所有 route observations 绑定 accepted source，主 Agent 已验证 outcome。
- [ ] 直接 A/B 只使用同 comparison group 且无阻断 confounder 的样本。
- [ ] 少于 5 个可比样本没有改变默认；Critical 安全/权限/证据失败已阻止探索。
