---
name: execute
description: 在需求基线已确认后，以 Goal Loop 持续完成软件开发、Bug 修复、重构、验证、提交或 PR 交付。用户说“实现、修复、修改、继续执行、做到 PR、运行任务”，或旧的 quick、task-runner、blocker-resume 流程需要执行时使用。若真实需求尚未确认，先进入 intake；最终业务验收进入 accept-deliver。
---

# Execute

在已确认的范围内持有目标并持续推进，直到达到目标状态、进入人工验收，或遇到不能自主解除的真实 Gate。不要把 Skill 切换、测试配置缺失或一次验证失败变成人工接力点。

## 三阶段边界

`execute` 只负责第二阶段：

1. `intake`：脑暴、调研、确认真实完整需求并写入基线；
2. `execute`：实现、验证、审核和技术交付；
3. `accept-deliver`：人工验收及明确授权后的合并或发布。

如果没有已确认的 Work Item，或实现需要改变产品语义，返回 `intake`。如果 Completion Oracle 已满足，进入 `accept-deliver`，不要自行认领人工验收。

## 输入

优先读取：

- `.vibeRig/project.yaml`；
- `.vibeRig/context-routes.yaml` 命中的项目规则、文档 owner、验证命令与 Reviewer；
- `.vibeRig/environments.yaml` 的目标环境 profile；
- 已确认的 `work-item.json`、`intake.md`、`requirement.yaml`；
- 存在时读取架构、AC、TC、风险、Issue、PR 和历史 Evidence；
- `tracking.provider`、Work Item 的外部系统 identity 与未确认 outbox；
- 当前仓库状态、用户未提交改动和项目 Gate。

将输入归一化为 [共享契约](./references/contracts.md) 中的 `WorkItem` 与 `GoalContract`。缺少非关键字段时从代码和现状补全；只有缺失信息会改变产品语义、扩大风险或越过权限时才询问用户。

按 [Context Router](./references/context-router.md) 生成最小 Task Context。项目已有 PRD、spec、ADR、测试指南、任务系统和 Runbook 是权威 owner；不要为了 VibeRig 再复制一份。

## 目标模式

| 用户目标 | `targetMode` |
|---|---|
| 分析原因 | `diagnosed` |
| 记录问题 | `recorded` |
| 形成可执行方案 | `planned` |
| 修复或实现 | `verified` |
| 修复并提交 | `committed` |
| 做到 PR | `pr_ready` |
| 合并 | `merged`，需要明确授权 |
| 发布 | `released`，需要明确授权 |

用户只说“完成”时，读取项目 PR 策略和当前上下文推断终点；不同解释会产生明显外部副作用时才询问。

## Goal Loop

完整循环见 [goal-loop.md](./references/goal-loop.md)。

每轮执行：

1. **Understand**：检查 Work Item、代码、现有证据和上轮失败，区分事实、假设与未知；
2. **Plan**：选择最小可验证增量，确定风险、测试保真度、审核与交付动作；
3. **Implement**：在授权范围内修改，保护无关用户改动，不做顺手重构；
4. **Verify**：按 Verification Graph 运行受影响测试和 Gate，记录与当前工作区或 commit 绑定的 Evidence；
5. **Review**：按风险和信息增益决定主 Agent 检查或独立 Reviewer；
6. **Decide**：检查 Completion Oracle；未满足且仍可推进时进入下一轮；
7. **Deliver**：只执行 `targetMode` 与 authority 允许的动作。

一次失败后定向修复。相同失败第二次出现时必须改变假设、工具、测试层级或实现策略，禁止机械重跑。连续三次没有新增证据或状态进展时，合并成一个 Blocker。

## Linear 生命周期投影

当 `.vibeRig/project.yaml` 的 `tracking.provider: linear` 且 Work Item 已有 Linear identity 时，把生命周期投影视为每轮 Goal Loop 的必需动作，而不是交付末尾的可选记录。读取共享 [vb-linear](../vb-linear/SKILL.md)，只请求语义 transition，由它解析团队真实状态并选择具体能力；本 Skill 不指定工具名或重新定义状态映射。

主 Agent 在以下边界发出 transition：

- 第一次产品实现写入前：`execution_started`；
- 进入独立 Review 前：`review_started`；
- blocking finding 触发返修前：`repair_started`；从人工验收拒绝返回时使用 `acceptance_rejected`；
- Completion Oracle 达到 `verified`、`committed` 或 `pr_ready` 时：`technically_ready`。

每次投影都先追加本地 journal 并持久化 outbox intent，包含稳定 event id、Linear host identity、语义 transition 与 payload fingerprint；再请 `vb-linear` 投影，read-back 目标后才 ack。超时或响应丢失时 search/adopt，禁止盲目重试。状态不匹配时保留当前外部状态并记录 phase；工具不可用时把 outbox 标为 `pending/unavailable`。两种情况都继续所有不依赖 Linear 的本地工作，但不得跳过投影意图、虚报同步成功或声称 read-back 已完成。

只有主 Agent 执行投影。缺少 Linear identity 时记录 `missing_identity` 并继续本地 Goal Loop；`execute` 不因此创建新 Issue。技术完成只进入 `pending_acceptance`，不得发出 `done`；`done` 仅由 `accept-deliver` 在当前人工验收和交付证据同时成立后请求。

## Linear 执行内容记录

状态流转不等于内容记录。当已配置 Linear 且 Work Item 有 Linear identity 时，主 Agent 还必须按 [Linear execution records](./references/linear-records.md) 写入可读记录：

- `execution_started`：第一次产品实现写入前，记录目标、scope/non-goals、目标模式、计划/AC/TC 引用、当前分支或工作区、预计验证与已知风险；
- `review_started` / `repair_started` / `acceptance_rejected`：只在真实进入这些阶段时追加简短 phase record，包含触发证据、影响范围和下一步，不为每轮无变化循环刷评论；
- `technically_ready`：Completion Oracle 满足后写完整 Proof Packet，至少包含 workspace/branch、完整 commit 或明确的未提交工作区、改动摘要、验证命令与结果、AC/TC 覆盖、Evidence/CI 对齐、残余风险、PR 链接或不适用原因。

Issue identity 的内容写到该 Issue 评论；Milestone/requirement 聚合内容按 `vb-linear` 映射到注册 Project 的 Project Update。每条记录使用稳定 event id、`VibeRig-Event` 与 typed `VibeRig-Record: phase:<event-id>` marker。写入前为内容单独持久化 outbox intent，携带 host identity、payload fingerprint 和记录类型；写后按 marker 与 fingerprint read-back 才 ack。状态 intent 与内容 intent 必须分别完成，不能因为状态已同步就跳过评论或 Proof Packet。Linear 不可用时两类 intent 分别保留并继续本地执行，恢复时 search/adopt，禁止盲目重复评论。

## 不得中断的情况

以下情况由 Goal Loop 自行处理：

- Skill 或阶段切换；
- 测试配置、测试 Secret 或本地依赖缺失但可模拟；
- 测试、类型检查、Lint 或 Review 失败且原因可定位；
- 需要在授权范围内补测试、修实现或收窄方案；
- Linear、知识库或其他记录系统暂时不可用；
- 可逆且不改变产品语义的技术选择。

先通过 [Environment Driver](./references/environment-driver.md) 运行项目声明的 bootstrap/start/health/reset；缺少充分环境时再读取 [test-environment-broker.md](./references/test-environment-broker.md)，自动选择 fixture、fake、stub、ephemeral dependency 或 sandbox。不要向用户索取可生成的测试凭证，也不得输出已提供的凭据值。

## 允许暂停的 Gate

只在以下情况暂停：

- 需要新的产品语义或业务取舍；
- merge、deploy、生产写入、删除数据、发送通知或产生费用未获授权；
- TC 明确要求真实环境，且无法使用 sandbox 或 emulator；
- 范围从局部修改升级为破坏性公共契约、不可逆迁移或高风险操作；
- 第三方权限或状态只能由用户解除；
- 连续三次无进展，且已改变过策略。

暂停时一次性报告：已完成部分、证据、尝试历史、唯一阻塞、最小所需输入和恢复动作。先完成所有不依赖该 Gate 的工作。

## 风险与能力预算

| 风险 | 默认执行 |
|---|---|
| L0 | 主 Agent 直接完成；静态验证；不强制 Subagent |
| L1 | 主 Agent或一个实现能力；定向测试；最多一个独立 Review |
| L2 | 结构化计划；实现与 Review 分离；按风险增加测试或专业审核 |
| L3 | 明确设计与威胁/失败分析；独立实现和多项专业 Gate；关键副作用人工授权 |

调用 `subagent-routing` 时按专业价值、独立性和并行收益选择能力，不因任务来自 Linear 就强制委派。Subagent 返回的是证据，不是完成声明。

模型选择由 `subagent-routing` 按 provider、任务族、风险和 accepted observations 动态完成。使用 challenger 时必须满足低风险、可逆、Completion Oracle 可判定和主 Agent 可独立验证；accept/security/不可逆副作用不做在线探索。每次委派把 `route_observation` 附到 Evidence Packet。

## Verification Graph、Runbook 与完成

L2/L3 或含多个 AC/执行阶段的工作使用 [Verification Graph](./references/verification-graph.md) 将 Outcome、AC、TC、权威阶段和 Evidence 连接起来。L0/L1 可把等价最小映射内嵌在 Goal Contract，不能因此省略完成判据。

必需 API/UI E2E 同时读取 [E2E Test Contract](./references/e2e-test-contract.md)。开始生产实现前确认当前 contract revision 已有正确 RED Evidence 和所需 review/lock；实现循环不得自行弱化锁定测试。Milestone E2E 在集成阶段运行，Issue Agent 只交接该节点。

每轮 Plan 检查 [Runbook Contract](./references/runbook-contract.md) 的触发条件。只有运行、部署、迁移、恢复、外部依赖、监控或 Smoke 行为变化时更新权威 Runbook，并在允许环境实际演练；未触发时记录 `not_applicable`，不创建空文档。

使用 [evidence-packet.schema.json](./assets/evidence-packet.schema.json) 组织证据。每条 Evidence 必须记录：

- 对应 AC/TC 或完成条件；
- 命令、检查或人工步骤；
- 结果与时间；
- 工作区或完整 commit；
- 环境及 `mock`、`fake`、`stub`、`ephemeral`、`sandbox`、`real` 保真度；
- 未覆盖差异与残余风险。

只有以下条件同时成立才能结束 Goal Loop：

```text
targetMode 已达到
AND requiredEvidence 全部有效
AND diff 未越出 scope
AND 没有 blocking finding
AND Evidence、CI、PR 与当前 commit 对齐
```

达到 `verified`、`committed` 或 `pr_ready` 后，将 Work Item 置为 `pending_acceptance`，完成 `technically_ready` 投影或留下可恢复 outbox，再进入 `accept-deliver`。自动化测试不能代替业务验收。

## 外部记录

- 用户仅要求分析或 Review 时，不写 Linear、不改代码、不创建 PR；
- 用户要求记录时，使用 `intake` 形成并确认完整 Work Item，再一次性写入；
- 已配置 Linear 且存在 identity 时，生命周期投影必须尝试并 read-back；暂不可用时保留本地权威记录和待同步动作，不阻塞代码执行；
- 主 Agent 负责 Linear、PR、Proof Packet 和状态写入；Subagent 不执行这些副作用；状态同步成功不能替代执行内容与 Proof Packet 的写入。

## 完成检查

- [ ] 已确认 Work Item、`targetMode`、scope、authority 与风险。
- [ ] 未在 Skill 边界或可模拟配置缺失处打断用户。
- [ ] 失败后进行了定向修复；重复失败时改变了策略。
- [ ] Required Evidence 保真度满足对应 AC/TC。
- [ ] 修改路径已通过 Context Router 加载最小权威上下文和验证命令。
- [ ] Environment Driver 已证明目标环境健康，或诚实记录更低保真边界。
- [ ] Verification Graph 的 required 节点闭合，Operational change 的 Runbook 已实际演练。
- [ ] 主 Agent 已检查 diff、真实输出和当前 commit。
- [ ] 已配置 Linear 时，生命周期 transition 已由主 Agent 投影并 read-back，或有状态诚实的可恢复 outbox；未把技术完成写成 `done`。
- [ ] 已配置且有 identity 时，`execution_started` 内容与 `technically_ready` Proof Packet 已写入并 read-back，或各自有 durable outbox；没有只改状态不留可读内容。
- [ ] 每次 Subagent 委派记录了 capability、model/reasoning、policy action、实际质量/返工/耗时/token 与 confounders。
- [ ] Completion Oracle 已满足，或只剩一个真实 Gate。
- [ ] 需要业务验收时已进入 `accept-deliver`，未自行宣称验收通过。
