---
name: agent-sop
description: execute Goal Loop 内部使用的实现、Bug 修复、重构、风险审核、证据验证与返工协议。仅在开发任务需要能力路由或工程质量门禁时加载；不作为用户入口，不负责需求发现、最终人工验收或 PR/Linear 副作用。
---

# Agent SOP

## 契约

主 Agent 持有 Goal Contract，负责范围与风险判断、能力路由、真实验证、证据综合、返工和 Completion Oracle。Subagent 只完成有边界的阶段并返回证据，不更新 Linear/VibeRig 状态、不操作 PR、不作最终验收决定。

不要把整个任务外包后等待。没有可用 Subagent 时主 Agent 可以直接完成对应阶段，但必须记录原因。保护无关用户改动，只修改任务范围。

## 输入与输出

输入：具体开发目标、仓库、AC/TC 或其他可判定结果；可选 Issue、架构契约、风险、日志、PR 和项目 Gate。

输出：范围与风险等级、测试策略、使用的阶段/能力、改动、验证与审核结果、跳过项、残余风险，以及 `PASS`、`REWORK` 或 `BLOCKED` 综合结论。

## 基本规则

1. 显式记录会影响实现方向的假设；只有缺失信息会改变方案或扩大风险时才询问用户。
2. 发现需求、架构或代码冲突时停止猜测，指出冲突与取舍。
3. 优先简单、局部、可回滚的实现，不做顺手重构。
4. Subagent 自述不是证据；主 Agent 必须读取 diff 和真实命令输出。
5. 不为所有任务强制新增测试，但必须有明确验证决策和 Evidence。
6. Skill 切换、一次验证失败和可模拟配置缺失不是人工 Gate；返回 `execute` 继续循环。
7. Subagent 先按 capability 匹配，再由 `subagent-routing` 选择 model/reasoning；便宜模型只能在质量与安全约束之后优化。
8. 每次委派保留 route observation；没有真实 token、耗时或 provider 价格时写 `null/unknown`，不得回忆性补数。

## 测试范围

VibeRig Issue 优先从 `test-cases.json` 与 `traceability.json` 读取相关 TC：

- `automation: required` 的新行为先取得 RED 证据，再 GREEN、REFACTOR；Bug 修复先复现失败。
- `issue_local` 执行受影响用例；`pr_ci` 由当前 commit 的 CI 产生权威证据。
- `milestone`、`owner_uat`、`post_release` 或 `manual` 只交接，不伪造 PASS。
- 旧需求没有 TC 时进入 `legacy mode`，根据 AC、风险和现有测试模式作窄范围决策。

纯文档、静态内容、无行为配置可不新增测试，但仍执行适当静态检查并记录理由。

测试配置或外部依赖缺失时读取 `execute/references/test-environment-broker.md`，自动建立充分保真的 fake、stub、ephemeral dependency 或 sandbox。不得把“没有 `.env.test`”直接变成人工阻塞。

## 风险与审核路由

| 风险 | 默认审核 |
|---|---|
| 低 | 主 Agent 检查；纯文档/静态改动可跳过独立 Code Review |
| 标准 | 非简单代码改动必须 Code Review；覆盖复杂时增加 Test Review |
| 高 | Code、Security、Test 独立审核；性能敏感时增加 Performance Review |

权限、鉴权、外部输入、敏感数据、不可逆迁移、支付、核心链路和外部契约不得判为低风险。通过 `subagent-routing` 按能力选择 Reviewer，不硬编码名称；需要多个审核时并行发出 Brief。

## 执行流程

1. **分析**：确定目标、范围、相关 AC/TC、架构约束、风险、未知项和 Gate。
2. **测试准备**：由当前实现者按相关 TC 做 TDD；仅在复杂/高风险自动化、Bug 复现需要独立所有权时，单独委派 `test_engineer` 编写批准的 TC。测试范围不清时使用 `qa / test_review` 审核，不让 `test_engineer` 从零设计产品测试策略。
3. **实现**：L0 默认主 Agent 直接完成；L1 根据隔离价值选择主 Agent 或一个 `implementation`；L2/L3 优先让实现与审核分离。Brief 只含相关范围、TC、契约和风险；禁止无关修改。
4. **主 Agent 定向验证**：读取 diff，执行受影响 TC、项目快速 Gate 和必要 Smoke；记录命令、结果、commit/工作区与跳过原因。
5. **风险审核**：按风险表执行 `code_review`、`qa / test_review`、`security_auditor / code_security_review`、`reliability_engineer / operational_review`，要求结构化 Findings 与 Verdict，不让 Reviewer 修改代码。
6. **CI 门禁**：Linear/PR 任务读取当前 commit 的 Required Checks；相同 commit、环境和测试定义的成功证据直接复用。
7. **证据综合**：主 Agent综合 TC、Gate、Review 和 CI，给出 `PASS`、`REWORK` 或 `BLOCKED`。`REWORK` 返回 `execute` 下一轮；只有真实 Gate 或连续三次无进展才 `BLOCKED`。不再额外委派一个重复的 Final QA。

每个发生 Subagent 路由的步骤都将 pending observation 更新为实际 outcome。模型导致的返工、Agent prompt 不匹配、上下文缺失、环境故障和 oracle 缺陷分开分类；不要把所有失败都归因于模型。

## Reviewer 输出

| Reviewer | 输出 |
|---|---|
| Code | `APPROVE` / `REQUEST CHANGES`；Correctness、Maintainability、Architecture、Evidence Findings 与专业审核触发信号 |
| Test | `PASS` / `REWORK`；AC/TC 覆盖、断言质量、边界、回归价值和缺口 |
| Security | Critical/High/Medium/Low/Info Findings；Critical 附可复现说明 |
| Performance | 预算、测量证据、退化风险与结论 |

任一 Critical 阻塞交付；Important/High 必须修复或作为显式残余风险报告。

## 证据有效性

证据仅在 commit、要求环境和测试定义未变化时复用。以下变化使相关证据失效：

- 新 commit 或合入最新 main 影响相关代码；
- 测试、Fixture、配置或外部依赖变化；
- local 证据被用于要求 CI/staging/production-like 的 TC；
- CI Job 与当前 commit 不一致。

无法判断影响时采用保守范围，不用重复运行掩盖 flaky test。

## 返工

把失败返回给产生该问题的阶段。返工 Brief 只包含失败证据、期望修正、相关文件/命令、保护范围和返回证据。

同族问题默认最多三轮；同一偏差第二次出现时必须改变假设、工具、测试层级或实现策略。连续三次没有新增证据或状态进展，或需要业务决策/权限/不可模拟外部状态时停止并升级。每轮修复后只重跑失败 TC、直接依赖 TC 和失效 Gate。

## 红线

- 固定为每个任务启动测试编写、Test QA、Final QA、Code/Security/Test Review 全套角色。
- 没读取 VibeRig 已批准 TC 就从零发明另一套测试范围。
- Reviewer 或实现 Subagent 更新 Linear、Proof Packet、PR 或终态。
- 主 Agent未读取真实输出就接受 Subagent 的 PASS。
- 人工/里程碑/发布 TC 在 Issue 阶段被标为 PASS。
- Critical Finding 未解决仍交付。
- 失败后无代码变化却反复执行同一命令碰运气。

## 验证与报告

- [ ] 范围、风险和测试决策有明确结论。
- [ ] Required TC 已通过，或在正确的后续阶段待办；没有静默跳过。
- [ ] 主 Agent检查 diff 并执行了真实验证。
- [ ] Reviewer 与 CI 按风险和项目策略执行，证据对应当前 commit。
- [ ] 综合结论、跳过项和残余风险完整。

最终报告只保留改动、TC/Gate/Review 结果、失败摘要、跳过原因和残余风险，不输出冗长内部讨论。
