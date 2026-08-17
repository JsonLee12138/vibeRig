---
name: pre-development
description: 为已确认的 L2/L3 Work Item 生成技术调研、架构、AC/TC、风险和交付计划。通常由 intake 在人工需求基线确认后内部调用；用户明确要求架构或开发前方案时也可使用。不用于 L0/L1 固定流程，不新增人工审批阶段，结论改变产品语义时返回 intake。
---

# Pre Development

将已确认需求转成可执行技术计划。它是 `intake` 与 `execute` 之间的内部能力，不是第二次完整需求访谈。

## 进入条件

满足任一条件时使用：

- 风险 L2/L3；
- 公共 API、数据迁移、权限、安全、支付、核心链路或发布策略；
- 未知性足以改变实现或验收；
- 用户明确要求完整架构/技术方案。

L0/L1 使用 Work Item 中的 scope、AC 和测试策略直接进入 `execute`。

## 输入

读取 confirmed `work-item.json`、`intake.md`、`requirement.yaml` 和项目约束。存在 PRD、历史架构、Wiki、Issue 或代码证据时按需读取。任务根上下文最多执行一次相关知识查询。

## 风险自适应流程

| 风险 | 默认产物与能力 |
|---|---|
| L2 | 定向 research、architecture、acceptance、test、risk、delivery；默认不做完整红白队 |
| L3 | 多领域 research、独立 architecture red team、threat/failure analysis、完整 Gate 与回滚 |

按需调用 `prd-brainstorm`、`tech-research`、`architecture-design`、`define-acceptance`、`security-and-hardening`、`uiux-design`。调用 `subagent-routing` 时只选择能带来独立信息的能力。

## 产物

在需求目录按风险生成：

- `research/*.md`
- `architecture.md`
- `acceptance.json` 与 `acceptance-guide.md`
- `test-plan.md` 与 `test-cases.json`
- `e2e-contract.json`（AC 要求 API/UI E2E 时）
- `risk-register.json`
- `release-plan.md` / `delivery-plan.md` / `delivery-plan.json`
- `traceability.json`
- `verification-graph.json`（多 AC、跨阶段或 L2/L3 时）
- `pre-development-review.md`

不要为满足清单创建空洞文档。不适用产物在 review 中写理由。

## Linear 计划发布与确认

当 `.vibeRig/project.yaml` 的 `tracking.provider: linear` 时，开发前计划不能只留在本地产物或聊天摘要中。读取共享 [vb-linear](../vb-linear/SKILL.md)，由主 Agent 完成以下闭环：

1. 技术产物与 DoR 成立后，调用 `split-milestones` 的 Local Draft 和 `split-issues` 的 Draft，先形成包含全部 Milestone / Issue、AC/TC、依赖、风险、验证摘要和契约引用的同一版 `plan_fingerprint`；
2. 调用 `split-milestones` 的 Publish Draft 与 `split-issues` 的 Publish Proposal，把全部 Milestone 和 Issue 作为不可执行草案幂等写入 Linear；不得只创建空标题、只写状态，或只发布近期 Issue；
3. 每个 Linear 对象都必须带 `VibeRig-Plan-Draft`、本地契约路径、AC/TC IDs 和 `plan_fingerprint`。再写一条计划同步摘要，列出对象链接、依赖、近期执行范围、主要风险及待确认事项；
4. 对每个对象和计划同步摘要 read-back。全部成功后才把 planning state 置为 `linear_draft_visible` 并向用户请求计划确认；
5. 每次外部写入前分别持久化 durable outbox intent，记录稳定 event id、目标 host、对象 identity、payload fingerprint 与动作。状态与内容是两个 intent，分别 read-back/ack；Linear 不可用时保留 `pending/unavailable`，不得声称计划已经可见；
6. 用户批准当前 fingerprint 后，调用 Activate：去掉草案语义、写批准摘要，只激活近期可执行范围；后续 Milestone 仍可见但保持 Backlog。批准结论与当前 fingerprint 不一致时重新发布并再次确认。

Linear 未配置时，本地计划仍是权威来源并继续交接；不得虚构 Linear identity 或同步结果。计划发布是主 Agent 的外部记录职责，Subagent 只返回规划证据。

同时通过 Context Router 识别项目已有 spec、contract、ADR 和 Runbook owner。规划只写回原 owner 或保存引用，不创建平行真相源。涉及运行、迁移、部署、恢复、监控或外部依赖变化时，把 Runbook 更新与演练作为 TC，而不是额外文档阶段。

需要 API/UI E2E 时读取 [E2E Test Contract](../execute/references/e2e-test-contract.md)。在生产实现前生成可运行测试并记录正确 RED；独立 QA/技术负责人检查测试没有把 setup 失败冒充业务 RED。业务 Oracle 与测试锁定结果并入现有规划审批包，不新增逐测试审批流程。跨 Issue E2E 可以先锁定契约、在集成分支首次运行 RED，但必须明确记录尚未执行的边界。

## 语义漂移

技术规划发现以下情况时返回 `intake` 人工 Gate：

- 推荐方案改变用户行为或业务规则；
- scope、非目标或兼容承诺需要变化；
- 风险从可逆局部修改升级为不可逆或高副作用；
- AC 无法在已确认需求下写成可判定条件。

纯技术细化、测试工具选择、fixture、mock 或环境搭建不要求用户再次确认。

## 交接

计划满足 DoR，且配置 Linear 时已完成草案发布与当前 fingerprint 的人工计划确认后，更新 Goal Contract 并进入 `execute`。不要要求用户再调用 `task-runner`。人工需求 Gate 仍是 `intake` 的确认；最终业务 Gate 是 `accept-deliver`。

## 完成检查

- [ ] 只为 L2/L3 或显式请求运行。
- [ ] 产物深度与风险匹配。
- [ ] L2 未固定启动完整红白队。
- [ ] 产品语义漂移已返回 `intake`。
- [ ] 技术计划已自动交给 `execute`。
- [ ] Verification Graph 指定了 TC 的权威阶段和最低保真度；Operational change 已映射 Runbook Gate。
- [ ] 必需 E2E 有 schema-valid contract、测试路径、正确 RED、review/lock revision；跨 Issue E2E 明确首次可运行阶段。
- [ ] 配置 Linear 时，全部 Milestone / Issue 草案及计划同步摘要已写入并 read-back，状态与内容 intent 分别 ack；未配置或不可用时没有虚报同步。
- [ ] 进入 `execute` 前人工计划确认绑定当前 `plan_fingerprint`，不存在只在本地生成计划却直接执行的路径。
