# VibeRig 开发质量门禁与验收流程设计

## 文档信息

| 属性 | 值 |
|---|---|
| 状态 | Proposed |
| 版本 | 1.0 |
| 日期 | 2026-07-21 |
| 适用范围 | VibeRig 开发阶段的测试、审核、Issue 验证、里程碑验收与发布验证 |
| 上游设计 | [开发前流程总体设计](./pre-development-workflow.zh-CN.md) |
| 主要影响 | `task-runner`、`agent-sop`、`accept-issue`、`accept-milestone`、测试与追踪 schema |
| 不适用范围 | Intake、PRD 决策、开发前架构调研、老板对开发前方案的审批 |

## 1. 背景

开发前流程新增 `test-plan.md`、`test-cases.json` 和 `traceability.json` 后，VibeRig 已经能够在开发前定义测试场景，但现有开发流程尚未真正消费这些产物。

当前 `task-runner` 主要读取 Issue、架构片段和 `acceptance.json`，并在开发完成后执行 AC 验证与项目门禁。与此同时，`agent-sop` 还会进行测试编写、测试 QA、主 Agent 验证、Final QA 和多角色质量审核；之后 `accept-issue` 再次逐条验证 AC，`accept-milestone` 又执行全量 gate 和全部 AC。

结果是：测试设计与执行脱节，同一验证被多个阶段重复运行，Subagent 调用数量偏高，人工验收与工程验证职责混合，最终增加 Token 消耗和交付时间，却没有等比例提高准确性。

本设计将开发质量流程改造成“测试用例驱动、风险分级、分层门禁、证据复用、老板最终验收”的企业级交付流程。

## 2. 问题定义

### 2.1 当前主要问题

| 编号 | 问题 | 当前表现 | 后果 |
|---|---|---|---|
| P-01 | 测试用例未接入开发 | `test-cases.json` 只在开发前生成，`task-runner` 不读取 | 开发 Agent 不知道应实现哪些具体测试 |
| P-02 | AC 与 TC 职责混淆 | AC 的 `verification` 同时承担业务验收和工程测试入口 | 验收标准越来越像脚本，老板验收难以理解 |
| P-03 | 重复验证 | `agent-sop`、`task-runner`、`accept-issue`、`accept-milestone` 重复运行测试 | 浪费时间、Token 和 CI 资源 |
| P-04 | 重复 QA | Test QA、Final QA、Test Engineer 的检查范围重叠 | 同一测试覆盖被多次分析 |
| P-05 | 所有任务固定高强度审核 | 普通改动也可能执行代码、安全、测试三路审核 | 小任务成本过高 |
| P-06 | 证据没有有效期模型 | 验证结果没有稳定关联 commit、环境和测试版本 | 无法判断旧证据能否复用 |
| P-07 | 人工参与过细 | 普通里程碑内 Issue 也要求用户单点验收 | 老板被迫参与工程内部流程 |
| P-08 | 里程碑回归边界过大 | 最终阶段再次执行全部底层工程验证 | 发现问题晚，且大量结果只是重复确认 |
| P-09 | 缺少发布后验证 | 当前验收更关注合并前，缺少部署 Smoke 和可观测性闭环 | PR 合并容易被误认为交付完成 |

### 2.2 根因

| 根因 | 说明 |
|---|---|
| 测试设计与任务拆分未闭环 | `traceability.json` 目前能关联 Outcome、AC、TC 和 Milestone，但不能直接定位 Issue |
| 缺少权威执行阶段 | 每个 skill 都认为自己需要重新验证，没人知道哪份证据是权威证据 |
| 验收语义未分层 | 工程验证、代码审核、产品验收和老板验收被统称为“验收” |
| 质量策略没有风险路由 | 复杂和简单任务使用近似相同的 Subagent 阵容与门禁 |
| Proof Packet 证据粒度不足 | 当前只记录命令结果与 AC 覆盖，没有逐个 TC、环境和 commit 的机器可判定结果 |

## 3. 设计目标

| 目标 | 说明 |
|---|---|
| 测试用例驱动开发 | 每个 Issue 在执行前获得与其相关的 TC，而不是开发后临时决定怎么测 |
| 单一权威阶段 | 每个 TC 明确在哪个阶段产生权威结果，其他阶段默认复用证据 |
| 分层质量门禁 | 单元、集成、E2E、人工验收和发布 Smoke 在不同层级执行 |
| 风险分级审核 | Code Review、Security Review、Test Review 根据变更风险动态选择 |
| 降低 Token 消耗 | 减少重复 Subagent、重复上下文注入和重复验证分析 |
| 提高准确性 | 通过 AC—TC—Issue—Commit—Evidence 的闭环追踪避免漏测 |
| 提高代码质量 | 保留 TDD、主 Agent 独立验证、代码审核、CI 和里程碑回归 |
| 简化人工流程 | 老板主要参与里程碑业务验收，不逐个验收内部技术 Issue |
| 支持增量返工 | 只重跑受影响 TC 和失效门禁，不全量重走开发链 |
| 完成交付闭环 | 合并后保留 Smoke、监控和回滚验证，不把合并等同于上线成功 |

## 4. 非目标

本设计不做以下事情：

- 不取消测试、主 Agent 验证、代码审核或 CI；
- 不要求所有测试都自动化；
- 不要求所有项目具备相同的测试基础设施；
- 不把老板变成 QA、代码 Reviewer 或发布工程师；
- 不让 Subagent 修改 Linear、提交 PR 或作出最终验收决定；
- 不在 `test-cases.json` 中保存某次运行状态；
- 不让 `task-runner` 自动开始未经老板批准的开发任务；
- 不改变开发前流程的需求基线和 CTO 审批职责。

## 5. 核心概念与边界

| 概念 | 回答的问题 | 典型内容 | 生命周期 |
|---|---|---|---|
| Outcome | 业务最终获得什么结果 | 用户能完成某项业务目标 | 需求级 |
| AC | 什么结果才算需求被接受 | 精确业务状态、数据、页面结果 | 需求到里程碑级 |
| TC | 如何验证某个行为或风险 | 前置、步骤、预期、证据 | 设计稳定，按执行产生多次结果 |
| Gate | 哪些检查必须通过才能进入下一状态 | lint、build、test、review、CI | 项目或风险策略级 |
| Evidence | 某个 TC 或 Gate 在特定版本上的真实结果 | commit、命令、日志、截图、CI 链接 | 单次执行级 |
| Engineering Verification | 工程实现是否可靠 | 单元、集成、契约、静态检查 | Issue 和 PR 级 |
| UAT | 业务流程是否符合老板预期 | 配置、操作、数据、页面、可视化 | 里程碑级 |
| Release Verification | 部署后的系统是否可用且可恢复 | Smoke、监控、告警、回滚 | 发布级 |

### 5.1 AC 与 TC 的关系

| 规则 | 说明 |
|---|---|
| 一条 AC 可以映射多个 TC | 正向、负向、权限、边界和恢复通常需要不同测试用例 |
| 一条 TC 可以覆盖多个 AC | 完整 E2E 流程可能同时验证多个业务结果 |
| AC 不保存执行状态 | AC 是稳定的业务判定标准 |
| TC 不保存运行结果 | TC 是稳定的测试设计 |
| Evidence 保存一次执行结果 | Evidence 必须绑定版本、环境、时间和执行方式 |
| 老板不需要理解全部 TC | 老板只使用 `acceptance-guide.md` 中的业务验收步骤 |

## 6. 核心决策

| 编号 | 决策 |
|---|---|
| D-01 | `test-cases.json` 成为开发阶段测试范围的权威来源 |
| D-02 | `traceability.json` 增加 Issue 映射，形成 Outcome—AC—TC—Issue—Milestone 追踪链 |
| D-03 | `task-runner` 只向 Subagent 注入当前 Issue 相关的 AC、TC 和架构片段 |
| D-04 | 每个 TC 必须声明权威执行阶段；非权威阶段默认读取证据而非重跑 |
| D-05 | 本地定向验证用于快速反馈，PR CI 是自动化项目门禁的权威证据 |
| D-06 | `agent-sop` 合并重复测试审核，取消固定 Final QA Subagent |
| D-07 | Code Review 对非简单代码改动必选；Security Review 与 Test Review 按风险触发 |
| D-08 | 普通里程碑内 Issue 不要求老板逐个执行 `accept-issue` |
| D-09 | `accept-issue` 保留为 standalone、高风险或显式抽查流程，并以证据审核为主 |
| D-10 | `accept-milestone` 只执行里程碑级 E2E、回归、人工 TC、老板 UAT 和失效门禁 |
| D-11 | 验证证据必须与 commit、环境、测试定义和时间关联 |
| D-12 | 合入最新 main 或代码变化导致证据失效时，由 CI 重跑相关门禁 |
| D-13 | 合并或部署后必须执行发布 Smoke；高风险发布还要检查监控和回滚能力 |
| D-14 | 返工只重跑受影响 TC、依赖 TC 和已失效 Gate |

## 7. 企业研发流程参考模型

不同企业的具体工具和审批制度不同，但成熟研发组织通常把质量控制分为以下层级，而不是让每个参与者重复执行全部测试。

| 企业阶段 | 主要负责人 | 主要活动 | 质量门禁 |
|---|---|---|---|
| 需求与设计 | 产品、架构、研发、QA | 定义范围、架构、AC、测试策略 | Definition of Ready |
| 开发 | 开发工程师 | TDD、实现、重构、定向自测 | 本地快速测试通过 |
| 代码评审 | Peer Reviewer、领域负责人 | 正确性、架构、可维护性、风险审核 | Review Approval |
| PR CI | CI 平台 | lint、build、unit、integration、contract | Required Checks |
| 集成验证 | QA、研发 | 跨模块 E2E、回归、兼容和专项测试 | Release Candidate Ready |
| 产品验收 | Product Owner、业务方 | 在类生产环境执行真实业务流程 | UAT Approval |
| 发布 | SRE、研发 | 灰度、Feature Flag、迁移、部署 | Change/Release Gate |
| 发布后观察 | SRE、研发、业务 | Smoke、指标、日志、告警、回滚判断 | Production Healthy |

VibeRig 对应这一模型时，AI Subagent 承担内部研发角色，用户主要承担老板或 Product Owner 的业务决策与最终验收角色。

## 8. 目标流程

| 阶段 | 主责 | 输入 | 执行动作 | 输出 | 用户参与 |
|---|---|---|---|---|---|
| 1. 开发前测试设计 | QA + CTO | 需求、架构、风险 | 定义 AC、TC、执行阶段和自动化要求 | `acceptance.json`、`test-cases.json` | 否 |
| 2. 交付映射 | 拆分流程 | AC、TC、Milestone/Issue 草案 | 把每个 Issue 绑定 AC-ID、TC-ID、风险和契约 | `traceability.json`、Linear Issue | 否 |
| 3. Issue 准备 | `task-runner` | Issue、追踪矩阵、架构 | 构建最小 Task Brief，确定测试与审核策略 | Task Brief | 否 |
| 4. RED | 实现 Agent | 相关自动化 TC | 新行为先产生能够失败的测试 | RED 证据 | 否 |
| 5. GREEN/REFACTOR | 实现 Agent | 测试与契约 | 实现最小代码并重构 | 代码、测试 | 否 |
| 6. 定向验证 | 主 Agent | 改动与相关 TC | 执行受影响测试、检查 diff 和范围 | 本地 Evidence | 否 |
| 7. 风险审核 | Reviewer Subagents | Diff、TC、风险 | 代码审核；按需进行测试或安全审核 | 审核结论 | 否 |
| 8. PR CI | CI | Commit、项目 Gate | 执行项目级自动化门禁 | CI Evidence | 否 |
| 9. Issue 交付 | `task-runner` | 全部证据 | 提交、维护 PR、写 Proof Packet | Ready for Milestone | 否 |
| 10. 里程碑验证 | `accept-milestone` | 集成分支、里程碑 TC | E2E、回归、人工 TC、UAT | Milestone Proof | 是 |
| 11. 合并与发布 | 集成流程 | 已批准的 Milestone | 合并、部署或交接发布 | Release Candidate | 视风险而定 |
| 12. 发布验证 | SRE/主 Agent | 部署版本 | Smoke、监控、告警和回滚检查 | Release Evidence | 否，异常时升级 |

## 9. 测试用例执行分层

### 9.1 不同测试层级的默认权威阶段

| TC Level | 默认权威阶段 | Issue 阶段行为 | 里程碑阶段行为 |
|---|---|---|---|
| `unit` | PR CI | 本地定向执行以快速反馈 | 不人工重跑，读取 CI 证据 |
| `integration` | PR CI | 能快速执行时跑受影响子集 | 只在依赖或环境变化时补跑 |
| `contract` | PR CI | 检查契约测试是否存在 | 不重复执行相同 commit 的成功结果 |
| `e2e` | Milestone/Staging | 仅执行完全独立且稳定的局部 E2E | 执行跨 Issue 关键路径 |
| `regression` | Milestone/Staging | 执行受影响子集 | 执行里程碑回归集合 |
| `performance` | Risk Gate | 高风险时执行基准或 Spike | 执行批准方案要求的性能验证 |
| `security` | Risk Gate/CI | 触发安全审核和定向扫描 | 验证残余风险和高风险场景 |
| `manual` | Milestone/UAT | 记录为待验收，不伪造 PASS | 在目标环境按步骤执行 |

### 9.2 自动化决策

| `automation` | 执行要求 |
|---|---|
| `required` | 对应 Issue 不得完成，直到自动化测试存在并产生有效证据 |
| `recommended` | 有成熟测试设施时自动化；否则记录人工验证与残余风险 |
| `manual` | 只能由指定人工或具有真实环境能力的 Agent 执行 |
| `not_applicable` | 不需要执行，但必须说明该用例为什么不适用 |

### 9.3 测试跳过规则

测试不得静默跳过。允许跳过时必须同时满足：

| 条件 | 要求 |
|---|---|
| 用例确实不适用于本次范围 | 提供与 Issue 范围或架构差异相关的理由 |
| 缺少环境或凭证 | 标为 `BLOCKED`，不得伪装成 `SKIP` |
| 更高层已有更准确的验证方式 | 指向具体替代 TC 或 Evidence |
| 测试基础设施不存在 | 记录风险，并由风险策略决定是否阻塞交付 |
| 纯文档、静态文案或无行为配置 | 可以不新增自动化测试，但仍需执行适当静态检查 |

## 10. 风险分级质量策略

### 10.1 风险等级

| 等级 | 典型范围 | 默认测试 | 默认审核 |
|---|---|---|---|
| 低风险 | 文档、静态内容、局部样式、无行为配置 | 静态检查或定向验证 | 主 Agent 检查；代码审核可省略并记录理由 |
| 标准风险 | 普通业务逻辑、局部 API、可回滚数据变化 | Unit + 必要 Integration + CI | Code Review 必选；Test Review 按覆盖复杂度触发 |
| 高风险 | 权限、安全、支付、不可逆数据、核心链路、外部契约 | Unit + Integration + Contract + E2E/专项 | Code、Security、Test 三路独立审核 |

### 10.2 审核路由

| 审核角色 | 强制触发条件 | 可跳过条件 | 输出 |
|---|---|---|---|
| Code Reviewer | 非简单代码改动 | 纯文档、静态文案、无行为配置 | APPROVE / REQUEST CHANGES |
| Test Reviewer | 新行为复杂、回归风险高、覆盖不确定、Bug 修复 | 简单行为且现有测试模式清晰 | PASS / REWORK |
| Security Reviewer | 鉴权、权限、输入、敏感数据、供应链、外部接口 | 与安全边界无关 | 分级 Findings |
| Performance Reviewer | 性能预算、核心高频路径、容量变化 | 无性能影响 | 预算结论与风险 |

## 11. 证据模型

### 11.1 设计原则

`test-cases.json` 只定义“应该怎么测”，不记录“某一次测得怎么样”。执行结果放入 Proof Packet、CI 或里程碑验证记录。

### 11.2 单条执行证据

| 字段 | 必填 | 说明 |
|---|---|---|
| `testCaseId` | 是 | 对应 `TC-N` |
| `result` | 是 | `PASS`、`FAIL`、`SKIP` 或 `BLOCKED` |
| `commit` | 是 | 证据绑定的完整 commit SHA |
| `environment` | 是 | `local`、`ci`、`staging` 或具体环境标识 |
| `executor` | 是 | 主 Agent、CI Job、人工验收人或工具 |
| `command` | 条件必填 | 自动化检查的真实命令 |
| `evidence` | 是 | 日志摘要、CI 链接、截图、响应或数据路径 |
| `executedAt` | 是 | ISO 8601 时间 |
| `skipReason` | 条件必填 | `SKIP` 时说明原因 |
| `blockedBy` | 条件必填 | `BLOCKED` 时说明缺少的条件 |

### 11.3 证据有效性

| 条件 | 是否可以复用 |
|---|---|
| commit、环境、测试定义均未变化 | 可以复用 |
| 只重复查看同一 PR 的同一 CI Job | 直接引用，不重跑 |
| commit 变化但改动与 TC 明确无关 | 由追踪与影响分析决定，可复用并记录理由 |
| 合入最新 main 产生新 commit | 相关 CI Gate 失效，必须重跑 |
| 测试代码或 Fixture 变化 | 对应 TC Evidence 失效 |
| 执行环境由 local 变为 staging | local 证据不能替代要求 staging 的 TC |
| 外部依赖版本或配置变化 | 受影响的 Integration、Contract、E2E 失效 |
| 人工步骤尚未真实执行 | 不得从自动化结果推断人工 PASS |

### 11.4 证据优先级

| 优先级 | 证据来源 | 用途 |
|---|---|---|
| 1 | 与当前 commit 绑定的 Required CI | 自动化 Gate 的权威结果 |
| 2 | Staging/真实环境执行记录 | E2E、集成和 UAT |
| 3 | 主 Agent 本地定向验证 | 开发反馈与 PR 前检查 |
| 4 | Subagent 自述 | 仅作线索，不作为最终证据 |

## 12. 数据结构调整

### 12.1 `test-cases.json`

当前字段继续保留，建议增加以下字段：

| 字段 | 类型 | 用途 |
|---|---|---|
| `executionStage` | enum | `issue_local`、`pr_ci`、`milestone`、`owner_uat`、`post_release` |
| `required` | boolean | 是否为阻塞门禁 |
| `environment` | enum/array | local、CI、staging、production-like、production |
| `riskLevel` | enum | low、standard、high |
| `gateRef` | string/null | 对应项目 Gate 或 CI Job 名称 |
| `timeoutSeconds` | integer/null | 避免 Agent 无界等待 |

不建议在此文件增加 `result`、`status`、`lastRun`，因为这些是运行时状态。

### 12.2 `traceability.json`

建议在每个 link 中增加：

| 字段 | 类型 | 用途 |
|---|---|---|
| `issueIds` | string[] | 定位负责实现 Outcome/AC/TC 的 Issue |
| `ownerAcceptanceRequired` | boolean | 是否必须进入老板 UAT |
| `releaseGateIds` | string[] | 关联发布、迁移、监控或回滚门禁 |

Issue 草案阶段可以使用本地 ID；批准并写入 Linear 后再补充 Linear key，不改变 AC-ID 和 TC-ID。

### 12.3 Proof Packet

Proof Packet 的验证部分从“命令列表”升级为：

| 分区 | 内容 |
|---|---|
| TC Coverage | 本 Issue 应覆盖、已覆盖、未覆盖的 TC-ID |
| Test Results | 每条 TC 的结果、commit、环境、命令和证据 |
| Gate Results | lint、build、typecheck、CI Required Checks |
| Review Results | Code/Test/Security Review 结论与 Finding |
| Manual Pending | 延迟到 Milestone/UAT 的人工 TC |
| Residual Risk | 无法覆盖、延期或接受的风险 |

## 13. Skill 责任调整

### 13.1 `pre-development`

| 保留职责 | 新增要求 | 不承担 |
|---|---|---|
| 生成测试计划、测试用例和追踪关系 | 为每条 TC 指定层级、自动化要求、权威执行阶段、环境和风险 | 不执行测试，不生成运行结果 |

### 13.2 `split-issues`

| 修改项 | 新行为 |
|---|---|
| Issue 描述 | 明确写入 AC-ID、TC-ID、架构契约和风险引用 |
| TC 分配 | 每条 TC 至少有一个实现或执行责任位置 |
| 跨 Issue TC | 绑定 Milestone，而不是强行分配给单一 Issue |
| 人工 TC | 标记为 Milestone/UAT，不要求开发 Agent 完成 |
| 追踪矩阵 | Materialize 后补充 Linear Issue key |

### 13.3 `task-runner`

`task-runner` 成为测试用例进入开发流程的主要消费方。

| 阶段 | 新行为 |
|---|---|
| 读取任务 | 根据 Issue 的 AC-ID/TC-ID 读取相关用例和追踪关系 |
| Task Brief | 注入相关 TC 的前置、步骤、预期、自动化要求和执行阶段 |
| 测试决策 | 不再从零判断“要不要测试”，而是执行开发前定义的 TC；发现不合理时记录偏差并升级 |
| 开发 | `automation: required` 的新行为必须先获得 RED 证据 |
| 主 Agent 验证 | 只跑当前 Issue 相关 TC 和必要的快速 Gate |
| 风险审核 | 按风险等级选择 Reviewer，不固定启动所有角色 |
| PR CI | 等待或读取当前 commit 的 Required Checks |
| Proof Packet | 写入逐 TC 结果、Gate、Review、人工待办和残余风险 |
| 状态 | 通过技术门禁后进入最接近 `Ready for Milestone` / `In Review` 的非终态 |

`task-runner` 不做老板验收，不把人工 TC 标为 PASS，不因为 Subagent 自述通过而写 Proof Packet。

### 13.4 `agent-sop`

建议把当前多阶段 QA 收敛为以下流程：

| 新阶段 | 说明 |
|---|---|
| 任务与风险分析 | 识别范围、相关 TC、风险等级和审核路由 |
| 测试准备 | 普通任务由实现 Agent 按 TC 执行 TDD；复杂或高风险才单独委派测试编写 |
| 开发 | 实现、GREEN、重构 |
| 主 Agent 定向验证 | 执行受影响 TC、检查 diff、范围和项目快速 Gate |
| 风险审核 | Code Review 默认；Test/Security/Performance Review 按风险触发 |
| 证据综合 | 主 Agent综合验证、审核和 CI 结果，作出 PASS/REWORK/BLOCKED 决定 |

删除固定的独立 Final QA 阶段。原 Test QA 与并行 Test Engineer 合并为一个“测试覆盖审核”能力，避免同一测试方案被重复审核。

### 13.5 `accept-issue`

| Issue 类型 | 推荐行为 |
|---|---|
| 普通里程碑内 Issue | 默认不要求老板手动验收；技术门禁通过后等待里程碑统一验收 |
| Standalone Issue | 保留人工触发；审核 Proof Packet、CI 和必要的业务步骤 |
| 高风险 Issue | 可以要求单点工程验收或老板确认 |
| 用户显式要求抽查 | 执行指定 TC 或业务步骤 |

`accept-issue` 的默认流程改为证据审核：先检查当前 commit 与证据有效性，只补做缺失、失效、人工或环境相关的验证，不无条件重复运行全部 `verification`。

### 13.6 `accept-milestone`

| 保留职责 | 调整内容 |
|---|---|
| 同步最新 main | 同步产生新 commit 后让相关 CI Gate 重跑 |
| 审核集成 PR | 检查 Required Checks、Review、TC 覆盖和残余风险 |
| 全量回归 | “全量”限定为里程碑回归集合，不等于重跑每个 Issue 的所有单元测试 |
| E2E | 执行跨 Issue 关键业务路径 |
| 人工验收 | 按 `acceptance-guide.md` 执行老板 UAT |
| 合并 | 只有里程碑 Gate 和老板验收均满足才合并 |
| 缺陷回流 | 精确关联失败 TC 和 AC，创建修复 Issue |

### 13.7 `merge-issue`

Standalone Issue 合并前确认：

| 检查 | 要求 |
|---|---|
| Evidence | 与 PR 当前 commit 一致 |
| CI | Required Checks 通过 |
| Issue Acceptance | 已获得要求的人工或业务结论 |
| Residual Risk | 已记录且不阻塞合并 |

### 13.8 发布验证

第一版可以把发布验证并入 `accept-milestone` 的合并后步骤或现有交付能力；当部署流程复杂后，再考虑独立 `release-verification` skill。

| 风险等级 | 合并后最低验证 |
|---|---|
| 低风险 | 主入口 Smoke |
| 标准风险 | Smoke + 关键日志/指标检查 |
| 高风险 | 灰度/Feature Flag + Smoke + 指标 + 告警 + 回滚就绪检查 |

## 14. Task Brief 新契约

Task Brief 只包含当前 Issue 所需的最小充分上下文。

| 分区 | 内容 |
|---|---|
| Goal | Issue 的单一交付目标 |
| Scope | 允许和禁止修改的范围 |
| AC | 相关 AC-ID 与业务预期 |
| Test Cases | 相关 TC-ID、层级、步骤、预期、自动化和执行阶段 |
| Architecture | 与本 Issue 相关的契约片段 |
| Risk | 风险等级、风险项与强制 Reviewer |
| Workspace | worktree、分支与基准信息 |
| Evidence Contract | 必须返回的 RED/GREEN、命令、文件和残余风险 |

禁止向实现 Subagent 注入完整 Intake、全部研究报告、全部架构文档或其他 Issue 的无关 TC。

## 15. Issue 质量门禁

### 15.1 标准 Issue

| Gate | 阻塞条件 |
|---|---|
| Scope Gate | Diff 包含未授权范围或无关改动 |
| Test Gate | Required TC 未实现、未执行或失败 |
| Build Gate | 项目要求的快速 build/typecheck/lint 失败 |
| Review Gate | Code Review 为 REQUEST CHANGES |
| Risk Gate | 必需的 Test/Security Review 未完成或存在阻塞 Finding |
| CI Gate | 当前 commit 的 Required Checks 未通过 |
| Evidence Gate | Proof Packet 缺少 commit、TC 结果或残余风险 |

### 15.2 高风险 Issue

除标准 Gate 外，还必须满足：

| Gate | 要求 |
|---|---|
| Independent Review | Code、Security、Test 三类审核相互独立 |
| Contract/Data Gate | 外部契约、数据迁移或兼容测试有证据 |
| Rollback Gate | 能描述并验证失败恢复路径 |
| Observability Gate | 指标、日志、告警与异常信号可观察 |

## 16. 里程碑质量门禁

| Gate | 验证内容 | 证据来源 |
|---|---|---|
| Issue Coverage | 全部 Issue 均有有效 Proof Packet | Issue 评论、追踪矩阵 |
| TC Coverage | 所有 Required TC 均为 PASS，或有批准的风险接受 | Proof Packet、CI、Milestone Proof |
| Integration | 集成分支构建和关键集成测试通过 | CI |
| Regression | 里程碑回归集合通过 | Staging/CI |
| E2E | 关键用户路径通过 | Staging、浏览器或 API 证据 |
| UAT | 老板按验收指南确认业务结果 | 验收评论、截图、数据证据 |
| Main Freshness | 已基于最新 main，变更后的 Gate 已重跑 | Git、CI |
| Release Readiness | 迁移、回滚、Feature Flag、监控满足方案 | Release Plan、Evidence |

## 17. 老板验收边界

老板不需要执行以下工作：

| 不要求老板做 | 由谁负责 |
|---|---|
| 执行全部单元测试 | CI |
| 检查 lint/typecheck | CI / 主 Agent |
| 审查代码结构 | Code Reviewer |
| 判断测试覆盖是否合理 | Test Reviewer |
| 逐个验收内部技术 Issue | 研发流程 |
| 阅读所有 Proof Packet | CTO/主 Agent 汇总 |

老板需要验证：

| 验收维度 | 内容 |
|---|---|
| 前置配置 | 账号、权限、环境、测试数据和必要配置 |
| 启动路径 | 运行哪些命令或打开哪些服务 |
| 操作流程 | 从哪个入口开始，按什么顺序操作 |
| 数据标准 | 正确数据的精确字段、数量、状态或阈值 |
| 可视化标准 | 页面、文案、图表、状态和交互应呈现什么 |
| 异常信号 | 哪些结果代表失败或不可接受 |
| 证据 | 截图、响应、数据记录、日志或链接 |
| 清理 | 测试数据、账号、Feature Flag 或临时配置如何恢复 |

## 18. 缺陷与返工流程

| 失败发生位置 | 处理方式 | 重跑范围 |
|---|---|---|
| RED 测试设计错误 | 修订测试设计或澄清 TC | 该 TC |
| 实现导致定向测试失败 | 返回实现 Agent 修复 | 失败 TC + 直接依赖 TC |
| Code Review 失败 | 按 Finding 修复 | 受影响 TC + Scope Gate |
| Security Review 失败 | 阻塞交付并修复 | 安全 TC + 相关回归 |
| PR CI 失败 | 定位失败 Job 和变更模块 | 失败 Gate，不盲目全量重复本地检查 |
| 里程碑 E2E 失败 | 建立缺陷 Issue，关联 AC/TC | 失败路径 + 受影响回归 |
| 老板 UAT 失败 | 区分需求偏差、实现缺陷或环境问题 | 对应 AC/TC 和受影响阶段 |
| 发布 Smoke 失败 | 停止发布、关闭 Flag 或回滚 | Smoke + 恢复验证 |

同族问题连续两轮没有收敛时，主 Agent 必须重新分析根因；需要业务取舍、风险接受、权限或外部环境时再询问用户。

## 19. 状态语义建议

具体状态名必须适配 Linear 团队已有工作流，不发明不存在的状态。语义映射建议如下：

| 语义状态 | 含义 | 进入条件 |
|---|---|---|
| Ready for Development | 开发前 DoR 和老板方案批准完成 | 正式 Issue 已 materialize |
| In Progress | 正在开发 | `task-runner` 开始执行 |
| In Review | 代码、测试或 PR 正在审核 | 实现完成，尚未通过全部 Gate |
| Ready for Milestone | Issue 技术 Gate 通过 | Proof Packet 与 CI 有效 |
| Pending Acceptance | 里程碑全部 Issue 技术就绪 | 集成分支准备验收 |
| Accepted/Done | 老板验收和里程碑 Gate 通过 | PR 合并及记录完成 |

普通里程碑内 Issue 可以停留在团队最接近 `Ready for Milestone` 的非终态，最终由 `accept-milestone` 统一核对并进入 Done。Standalone Issue 继续在 `accept-issue` 后由 `merge-issue` 合并。

## 20. Token 与执行效率控制

| 优化项 | 规则 | 预期收益 |
|---|---|---|
| 最小 Task Brief | 只提供当前 Issue 的 AC、TC、契约和风险 | 降低实现 Agent 上下文 |
| 合并测试审核 | Test QA 与 Test Engineer 合并 | 减少一次 Subagent 往返 |
| 删除固定 Final QA | 主 Agent综合真实证据 | 减少一次重复总结 |
| 风险路由 | 安全、测试、性能审核按条件触发 | 普通 Issue 不支付高风险成本 |
| Evidence 复用 | 相同 commit 和环境不重跑 | 减少命令、日志与推理消耗 |
| 增量回归 | 通过追踪关系选择受影响 TC | 避免每次全量回归 |
| 结论式返回 | Subagent 只返回 Findings、证据和 Verdict | 减少冗长过程文本 |
| 失败定向返工 | Brief 只包含失败证据与期望修正 | 避免重新注入完整任务 |

## 21. 兼容策略

| 兼容对象 | 策略 |
|---|---|
| 旧 `acceptance.json` | 继续读取 `verification`，没有 TC 时生成运行时兼容验证项 |
| 没有 `test-cases.json` 的旧需求 | `task-runner` 使用原 AC 验证流程，并在 Proof Packet 标记 legacy mode |
| 旧 Linear Issue | 没有 TC-ID 时从 AC 与 `traceability.json` 推导；无法推导则使用窄范围测试决策 |
| 无 CI 项目 | 主 Agent执行等价 Gate，并明确证据环境和残余风险 |
| 无测试基础设施 | 不伪造自动化；按风险决定补基础设施、人工验证或阻塞 |
| 旧 Proof Packet | 仍可读，但发生新提交后必须升级为逐 TC 证据格式 |

## 22. 方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 保持现状，再新增 TC 验证阶段 | 修改简单，看起来门禁更多 | 重复最严重，TC 与 AC 边界继续混乱 | 不采用 |
| B. 所有测试只在 `accept-milestone` 执行 | 流程表面简单 | 反馈过晚，缺陷修复成本高 | 不采用 |
| C. 每个 Issue 全量运行所有测试 | 单点信心高 | 慢、贵、噪声大，无法规模化 | 不采用 |
| D. 分层门禁 + 风险路由 + 证据复用 | 反馈快、可追踪、人工少、适合扩展 | 需要调整 schema 与多个 skill 契约 | 采用 |
| E. 完全依赖 CI，不做主 Agent 验证 | Token 较低 | PR 前反馈慢，无法覆盖人工与环境检查 | 不采用 |

## 23. 分阶段落地计划

### 23.1 第一阶段：让测试用例进入开发链

| 修改 | 完成标准 |
|---|---|
| 升级 `test-cases.schema.json` | 支持执行阶段、环境、风险和 Gate |
| 升级 `traceability.schema.json` | 支持 `issueIds` 和 UAT 标记 |
| 修改 `split-issues` | Issue 草案与 Linear 描述包含 AC-ID/TC-ID |
| 修改 Task Brief | 能注入相关 TC，而不是只注入 AC |
| 修改 Proof Packet | 能记录逐 TC Evidence |

### 23.2 第二阶段：消除重复 QA

| 修改 | 完成标准 |
|---|---|
| 精简 `agent-sop` | Test QA 与 Test Review 合并，删除固定 Final QA |
| 修改 `task-runner` | 按 TC 和风险执行定向验证、审核与 CI Gate |
| Evidence 有效性判断 | 相同 commit 的有效 CI 不重复运行 |

### 23.3 第三阶段：调整人工验收

| 修改 | 完成标准 |
|---|---|
| 修改 `accept-issue` | 默认审核证据，只补做缺失或人工验证 |
| 修改 `accept-milestone` | 只做里程碑回归、E2E、UAT 和失效 Gate |
| 普通里程碑 Issue | 不再要求老板逐个验收 |

### 23.4 第四阶段：发布闭环

| 修改 | 完成标准 |
|---|---|
| 发布 Smoke | 合并或部署后有明确验证证据 |
| 可观测性检查 | 标准/高风险发布检查日志、指标和告警 |
| 回滚验证 | 高风险发布有可执行的恢复路径 |

## 24. 验收标准

本设计实施完成后必须满足：

| ID | 验收标准 |
|---|---|
| AC-QG-01 | 新需求的每个交付 Outcome 均能追踪到 AC、TC、Issue 和 Milestone |
| AC-QG-02 | `task-runner` 的 Task Brief 包含本 Issue 相关 TC，不包含无关需求全文 |
| AC-QG-03 | `automation: required` 的新行为在实现前或修复前具有有效 RED 证据 |
| AC-QG-04 | Proof Packet 能逐条说明 TC 的结果、commit、环境、命令和证据 |
| AC-QG-05 | 相同 commit、环境和测试定义下，`accept-issue` 不重复执行已有有效自动化结果 |
| AC-QG-06 | 普通风险 Issue 不固定启动 Security Reviewer 和独立 Test Reviewer |
| AC-QG-07 | 高风险 Issue 必须完成 Code、Security 和 Test 独立审核 |
| AC-QG-08 | `accept-milestone` 不无条件重跑每个 Issue 的全部单元测试 |
| AC-QG-09 | 老板验收只要求执行可理解的业务流程、数据和可视化检查 |
| AC-QG-10 | 合入最新 main 导致 commit 变化时，相关 CI Gate 自动失效并重跑 |
| AC-QG-11 | 缺陷返工能够根据 AC/TC 追踪只选择受影响验证范围 |
| AC-QG-12 | 合并或部署后具有 Smoke 证据；高风险交付具有监控与回滚检查 |

## 25. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 影响分析错误导致漏跑 TC | 回归缺陷进入里程碑 | Required CI 保留项目基础 Gate；高风险扩大回归集合 |
| 证据复用过度 | 使用了已经失效的结果 | 强制绑定 commit、环境和测试定义；明确失效规则 |
| 开发前 TC 设计不准确 | 实现被错误测试约束 | 允许开发时提交 TC 偏差，CTO/QA 定向修订并更新追踪 |
| 低风险分类错误 | 跳过必要审核 | 权限、数据、外部契约等关键词自动提升风险等级 |
| CI 不稳定 | Gate 频繁误报 | 区分产品失败与基础设施失败，不允许通过重复运行掩盖 flaky test |
| 人工 UAT 过重 | 老板验收成本仍然较高 | 验收指南只保留关键业务路径，工程细节由 AI 汇总 |
| 多 schema 升级破坏旧需求 | 历史任务无法执行 | schema 版本化并保留 legacy mode |

## 26. 待实现时确认的细节

以下事项不影响本设计方向，可以在实现阶段根据现有代码和平台能力确定：

| 事项 | 默认建议 |
|---|---|
| Evidence 是否新增独立 JSON schema | 第一版先扩展 Proof Packet；需要机器聚合后再增加 `verification-results.schema.json` |
| CI 证据获取方式 | 优先使用 PR Provider 的 Required Checks；不可用时由主 Agent运行等价命令 |
| `Ready for Milestone` 对应 Linear 状态 | 运行时解析团队状态，选择最接近语义的非终态 |
| 普通 Issue 是否保留可选 `accept-issue` | 保留显式抽查入口，但不作为里程碑默认前置 |
| 发布验证是否独立成 Skill | 第一版并入里程碑/交付流程，复杂部署项目再拆分 |
| Evidence 时间有效期 | 默认不单独按时间过期；外部依赖或环境敏感 TC 可声明有效期 |

## 27. 最终结论

下一版不应简单地把 `test-cases.json` 添加到现有验证步骤中，而应让它成为开发和验收之间的质量控制索引。

推荐流程是：开发前定义 AC 和 TC，Issue 绑定相关 TC，`task-runner` 通过 TDD 和定向验证产生证据，PR CI 提供自动化权威结果，Reviewer 根据风险介入，普通 Issue 不逐个打断老板，`accept-milestone` 只完成跨 Issue 回归、E2E、老板 UAT 和发布就绪审核。

通过分层门禁、风险路由和证据复用，VibeRig 可以在不降低质量要求的前提下减少重复验证与 Subagent 调用，并把人工参与集中到真正需要业务决策和最终验收的位置。
