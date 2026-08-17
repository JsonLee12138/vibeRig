---
name: split-issues
description: 把已确认 Work Item 的里程碑拆成可验证垂直 Issue。由 pre-development 内部生成草案，并在需求基线已确认后按 Rolling Wave materialize；不作为人工流程入口，不指派人员或 subagent。
---

# Split Issues（Issue 规划）

审批前让老板看到完整工作范围，审批后保持 Rolling Wave，只把近期工作正式建单，降低计划腐烂。

## 前置门禁

- `requirement.yaml` 有里程碑草案；
- `acceptance.json`、测试用例、架构与风险登记可用；
- L2/L3 工作有 `verification-graph.json` 或等价的 AC → TC → stage/fidelity 映射；
- 目标里程碑有 AC IDs 和清晰用户价值。

## 三种模式

### Draft 模式

由 `pre-development` 调用，不操作 Linear：

1. 为所有里程碑生成供人阅读的 `delivery-plan.md` 和机器权威 `delivery-plan.json`，后者通过 `../pre-development/assets/delivery-plan.schema.json`；
2. 第一个里程碑拆到可执行粒度，后续里程碑保持可估算的规划粒度并标记 `indicative`；
3. 每项写目标、范围、非目标、AC/TC/风险 IDs、验证图节点、契约引用、验证摘要、尺寸、依赖、内部实施清单、并行组、冲突集合、集成点、回滚单元和完成证据；保留验证图声明的 stage/fidelity，跨 Issue 的 E2E/回归 TC 只绑定 Milestone；
4. 依赖采用 `blocks` / `blockedBy` 语义；不选择实现人员或 subagent；
5. 随 CTO 汇总包一次审批，不单独询问老板。

### Publish Proposal 模式

在需求基线确认、DoR 成立且人工计划确认之前执行：

1. 请 `vb-linear` 按稳定 id、Milestone 与标题查重，复用或更新已存在 Issue；
2. 把所有 Milestone 的 Issue 草案写入 Linear，让用户能看到完整范围；远期 Issue 可保持 `indicative`，但不得省略；
3. 描述写目标、范围/非目标、AC/TC/风险 IDs、依赖、验证摘要、契约路径、`plan_fingerprint` 和 `VibeRig-Plan-Draft`，不粘贴本地全文；
4. 不指派人员，不进入 In Progress，不把 Proposal 当成已批准任务；
5. 回填 Linear identity、更新 `linear.yaml`，逐项 read-back 后写计划同步摘要。写入失败时保留 durable outbox，不能跳过该对象后请求计划确认。

### Materialize 模式

仅在老板批准当前 `plan_fingerprint`、Milestone 已 materialize 后执行：

1. 按 Rolling Wave 选择最靠前的 `not_started` Milestone；
2. 重新核对代码现状和草案漂移，保持在批准范围内细化；
3. 复用 Publish Proposal 已创建的 Issue；缺失时请 `vb-linear` 查重后补建，不重复创建；
4. 更新近期 Issue 的依赖与 `req:{requirement-id}` label，移除不可执行草案语义；描述继续保留 AC-ID、TC-ID、风险和契约引用；
5. 将 `traceability.json` 中本地 `issueIds` 补充或替换为 Linear key，更新 `linear.yaml` 并写计划同步摘要。

后续 Milestone 到启动前再 materialize。若必须改变老板批准的范围、验收或关键风险，退回 `pre-development` 做定向变更评审。

## Issue 标准

使用“最少充分拆分”：如果两个候选不能分别验收，就合并为一个 Issue；代码、测试、迁移和文档共同完成一个行为时属于同一 Issue 的内部 checklist。

1. 是一个可独立验收的交付单元，通常对应一个有意义的 PR；时间或文件数只作异常信号；
2. 是端到端垂直切片，能单独提交且仓库保持可用；
3. 映射至少一个 AC 和对应测试用例；纯跨 Issue TC 映射到 Milestone，不强塞给单个 Issue；
4. 有明确输入/输出、依赖、风险与完成证据；
5. 只有能独立验收/发布、真正并行、需要独立验证/回滚，或明显超过一个有意义 PR 时继续拆分；
6. 每个 Milestone 默认 2–6 个 Issue；超过 8 个时逐项解释独立验收价值，不为了数量强行拆合。

Issue 中的 TC 只表达责任范围，不保存运行结果。`manual`、`owner_uat` 和跨 Issue `milestone` TC 写入里程碑待验收清单，不要求实现 Agent 标记通过。

| 尺寸 | 涉及文件 | 典型范围 |
|---|---:|---|
| XS | 1 | 单一可观察行为或配置结果，不是任意函数 |
| S | 1–2 | 一个小切片 |
| M | 3–5 | 一条完整功能路径 |
| L | 5–8 | 多组件切片，优先再拆 |
| XL | 8+ | 必须再拆 |

禁止纯脚手架、纯层次任务、Checkpoint、独立联调或独立 QA Issue。前端/后端不默认拆成两个 Issue；只有契约稳定、可真正并行且产物可分别验收时才拆。共享契约、迁移或核心文件进入同一 `conflictSet`，执行时不得并发修改。

## 红线

- 审批前把 Linear Issue 标成可执行，或 Materialize 多个未来里程碑。Publish Proposal 可以在审批前创建不可执行草案。
- Issue 没有 AC、测试用例或可执行验证。
- 把 subagent/assignee 选择固化在规划阶段；执行路由属于 `execute`。
- 为了技术分层创建无法独立验证的壳任务。
- 细化时偷偷扩大已批准范围。

## 完成检查

- [ ] Draft 覆盖所有里程碑，近期详细、远期可估算且标明置信度。
- [ ] 每项映射 AC、测试、风险、依赖和证据，无 XL/壳任务。
- [ ] 不能独立验收的候选已合并为 checklist；超过 8 个 Issue 时有逐项理由。
- [ ] `parallelGroup`、`conflictSet`、`integrationPoints` 和 `rollbackUnit` 足以约束执行并发。
- [ ] `traceability.json` 可从 Outcome/AC/TC 定位到本地或 Linear Issue；跨 Issue 与老板验收 TC 留在 Milestone。
- [ ] `delivery-plan.json` schema-valid，机器字段与人读草案一致；超过 8 个 Issue 有独立验收理由。
- [ ] L2/L3 Issue 继承验证图节点及其 stage/fidelity，没有把 Milestone E2E 降级为单 Issue 模拟测试。
- [ ] 审批前只存在带 `VibeRig-Plan-Draft` 与当前 fingerprint 的不可执行 Proposal，全部对象已 read-back。
- [ ] Materialize 只处理下一个 Milestone，已查重且未指派。
- [ ] 计划漂移未越过批准范围；越界时已退回定向评审。
- [ ] 人读内容使用 `output.language`。

## 下一步

需求基线已确认且近期 Issues materialize 后，更新 Goal Contract 并进入 `execute`。
