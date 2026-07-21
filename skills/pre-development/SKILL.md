---
name: pre-development
description: 在需求基线确认后自动编排完整开发前流程，组织领域调研、可行性分析、架构设计、验收设计、测试计划、风险与交付草案，并由 CTO 汇总成一次老板审批包。通常由 intake 自动进入；也用于继续未完成或被退回的开发前评审。不执行开发任务。
---

# Pre-development（开发前评审）

把已确认的需求基线转化为可审批、可开发、可验收的交付方案。老板只审批最终汇总包；专业分析由内部角色和 subagent 完成。

完整阶段、角色、门禁见 [references/lifecycle.md](./references/lifecycle.md)。统一产出格式见 [assets/pre-development-review-template.md](./assets/pre-development-review-template.md) 与 [assets/domain-research-template.md](./assets/domain-research-template.md)。

## 入口契约

- 只接受已完成 `intake` 且老板确认过的需求基线。
- 读取 `.vibeRig/project.yaml`，人读内容使用 `output.language`。
- 开始时将 `requirement.status` 置为 `pre_development`。
- 本流程可以调用 `prd-brainstorm`、`tech-research`、`architecture-design`、`define-acceptance`、`split-milestones`、`split-issues` 的内部模式。
- 审批前只生成本地草案，禁止创建 Linear Milestone / Issue，禁止进入 `task-runner`。

## 编排流程

1. **建立上下文包**
   - 读取 `intake.md`、`requirement.yaml`、关联 PRD、项目约束、代码与历史决策。
   - 标出事实、推断、假设和真正需要老板决策的事项。
2. **自动判断 PRD**
   - `existing`：关联已有 PRD；
   - `create`：调用 `prd-brainstorm` 内部综合模式生成 PRD 草案；
   - `not_required`：记录不需要 PRD 的理由。
3. **影响分类与角色路由**
   - 识别前端、后端、数据、安全、运维、QA、产品、合规等受影响领域。
   - 通过 `subagent-routing` 选择最小必要角色；每个角色拿到同一上下文包和独立研究使命。
   - 优先使用基线能力及明确模式：

| 领域 | 基线 Agent / Mode |
|---|---|
| 通用证据、官方资料 | `researcher` |
| 前端架构 | `frontend_architect` |
| 后端架构 | `backend_architect` |
| 数据与迁移 | `data_architect` |
| 安全 | `security_auditor / design_threat_model` |
| SRE、性能、发布 | `reliability_engineer / pre_development` |
| QA 与测试设计 | `qa / test_design` |
| UI/UX | `uiux_design / report_only` |

   - 支付、计费、合规、AI 等业务领域不做成通用基线 Agent；由 `update-team` 创建项目角色或现场选择已有领域能力。
4. **并行领域调研**
   - 各角色按 `tech-research` 内部协议返回结构化研究结果，不写文件、不碰 Linear。
   - 主 agent 统一写入 `research/{domain}.md`，并汇总 `research/feasibility.md`。
5. **CTO 架构综合**
   - 调用 `architecture-design`，综合跨领域结论；通过独立 `architecture_red_team` 实例按所需 `attackFocus` 完成攻击，再由原领域 Agent 白队回应、CTO 裁决。
   - 产出 `architecture.md`、必要 ADR、迁移/回滚/可观测性方案。
6. **质量与验收设计**
   - 调用 `define-acceptance` 生成 `acceptance.json` 与 `acceptance-guide.md`。
   - 生成测试策略与 schema `version: 2` 的测试用例；每条 TC 指定 `executionStage`、`required`、`environment`、`riskLevel`，但不写运行状态。
   - 生成 schema `version: 2` 的需求—架构—验收—测试—Issue 追踪关系；Draft 阶段可先使用本地 Issue ID，Materialize 后补 Linear key。
7. **交付规划草案**
   - 调用 `split-milestones`、`split-issues` 的 draft 模式。
   - 里程碑按可验收用户价值切分；Issue 草案绑定验收项、测试、风险和依赖。
8. **DoR 审核与 CTO 汇报**
   - 执行生命周期文档中的 DoR；不满足则内部返工，只有权限性阻塞才询问老板。
   - 生成 `pre-development-review.md`，将状态置为 `awaiting_owner_approval`。

## 深度与 Token 控制

先按影响分类选择最小充分流程，不以固定 agent 数量制造形式完整：

| 等级 | 适用范围 | 调研与评审深度 |
|---|---|---|
| 轻量 | 单域、低风险、无数据/权限/外部契约变化 | 一个 subagent 可合并相邻角色，但按领域分别输出结论 |
| 标准 | 跨域或存在接口/数据变化 | 受影响领域独立调研，CTO 统一综合，一轮独立红队 |
| 高风险 | 安全、合规、不可逆数据、核心链路或高成本 | 关键领域双人独立结论、必要 spike、加强红队与回滚演练 |

- 只向每个 subagent 发送统一需求摘要、其使命和相关文件索引，不发送完整访谈或无关仓库内容。
- 共用事实与来源放入上下文包，各领域只补增量，主 agent 去重后落盘。
- 相同问题不交给多个 subagent，除非高风险场景明确要求独立交叉验证。
- 退回或条件变更时按追踪关系只重跑受影响阶段，不重新生成全部材料。
- 报告保留结论、证据和差异，不保留冗长讨论过程。

## 老板审批

向老板一次性汇报：需求结论、推荐方案、核心架构、可行性、范围与非目标、成本/周期、风险、测试与质量策略、交付草案、待决策项，以及可照做的老板验收指南。

审批结果：

- **批准**：记录审批时间与范围，将状态置为 `ready_for_development`；随后由拆分 skills materialize 已批准计划，才可进入开发流程。
- **有条件批准**：记录条件，状态置为 `conditionally_approved`；满足条件并留证后再转 `ready_for_development`。
- **退回**：只重跑受影响阶段，保留原结论与变更原因。

老板验收指南必须明确：

1. 前置配置、账号、权限、测试数据和环境；
2. 要运行的命令、服务及成功启动信号；
3. 页面入口或 API 调用路径；
4. 按顺序执行的操作和每一步预期；
5. 正常数据的精确标准；
6. 正常可视化、状态、文案或图表应呈现什么；
7. 失败信号、证据采集和验收后清理。

## 允许打断老板的条件

仅当存在以下阻塞且无法从仓库、文档或合理默认值解决时提问：

- 互斥的业务方向；
- 预算、供应商或合同授权；
- 不可逆的数据或兼容性决策；
- 安全、隐私、合规风险接受；
- 范围、期限、成本、质量之间必须由老板取舍。

普通技术分歧由 CTO 在报告中裁决并说明理由，不逐项打断老板。

## 产出

```text
.vibeRig/requirements/<req-id>/
  intake.md
  requirement.yaml
  prd.md                         # 仅在自动判断需要新 PRD 时
  research/<domain>.md
  research/feasibility.md
  architecture.md
  acceptance.json
  acceptance-guide.md
  test-plan.md
  test-cases.json
  risk-register.json
  release-plan.md
  delivery-plan.md               # Milestone / Issue 本地草案
  traceability.json
  pre-development-review.md      # CTO 给老板的唯一审批入口
```

结构化文件使用 [test-cases.schema.json](./assets/test-cases.schema.json)、[risk-register.schema.json](./assets/risk-register.schema.json) 与 [traceability.schema.json](./assets/traceability.schema.json)。

## 红线

- 重复询问 `intake` 已确认的信息。
- 把技术选型逐项交给老板决定，而没有推荐结论。
- 研究 subagent 各自写文件、修改代码或碰 Linear。
- 老板审批前创建正式 Milestone / Issue 或开始开发。
- 验收标准只有一句笼统描述，没有可执行的老板验证流程。
- DoR 未通过却将需求标记为 `ready_for_development`。

## 完成检查

- [ ] PRD 决策有结论和理由。
- [ ] 受影响领域均有研究结论，事实/推断/假设可区分。
- [ ] 架构经过红白队对抗并完成 CTO 裁决。
- [ ] 每个需求结果都映射到验收项和测试用例。
- [ ] 每条测试用例有唯一权威执行阶段、环境、自动化要求和风险等级。
- [ ] 老板验收指南可由非开发者按步骤执行。
- [ ] 风险、迁移、回滚、可观测性和发布方案已覆盖或注明不适用理由。
- [ ] Milestone / Issue 仍是本地草案。
- [ ] DoR 通过后才发起一次老板审批。
