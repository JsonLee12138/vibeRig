# AI 驱动软件交付中的文档与验收治理手册

适用对象：高级架构师、技术负责人、AI 研发效能负责人、QA 负责人
版本：2026-06-08
目标：解决 AI 生成文档不利于人类审核、AI 自定义验收标准失真、AI 完工可信度不足的问题。

---

## 1. 核心结论

在 AI 参与完整软件交付时，不能让 AI 同时承担“需求定义者、实现者、验收者”三个角色。成熟团队的做法是把 AI 输出纳入工程门禁：

```text
业务目标 -> 人类审核简报 -> Agent 执行规格 -> 验收矩阵 -> 实现 -> 证据包 -> 独立审查 -> 人工签字
```

AI 可以生成候选需求、候选验收标准、实现方案、测试代码和证据包，但最终验收标准必须由人类确认。架构师审核的重点不应是 AI 写了多少文档，而是以下链路是否闭合：

```text
业务目标 -> 业务规则 -> Acceptance Criteria -> 测试/证据 -> PR diff -> 人工决策点
```

---

## 2. 调研发现

### 2.1 AI 文档的主要问题

调研社区反馈和研究材料后，AI 生成文档常见问题包括：

- 结构很完整，但人类无法快速判断哪些内容是事实、哪些是假设。
- 文档倾向于铺陈背景和解释，缺少可审核的决策点。
- 需求、设计、任务、验收标准混在一起，审查者很难定位问题。
- “看起来合理”的描述掩盖了缺失的边界条件、权限规则和失败路径。
- 文档随代码变化后没有同步更新，逐渐变成半正确档案。

2026 年一项关于 AI agent 文档 PR 的研究发现，AI agent 已经大量提交文档类 PR，但这些文档经常很少经过人类后续修改，引发了对文档质量保证的担忧。参考：[Who Writes the Docs in SE 3.0?](https://arxiv.org/abs/2601.20171)

### 2.2 AI 验收标准的主要问题

AI 常把验收标准写成：

- “功能正常运行”
- “用户体验良好”
- “权限控制正确”
- “性能满足要求”
- “测试通过”

这些都不是合格验收标准，因为它们不可证伪、不可观察，无法指导测试或人工审核。

Atlassian 对 Acceptance Criteria 的定义强调：验收标准应是清晰、具体、可测试的完成条件，并且描述的是期望结果，而不是实现方案。参考：[Atlassian Acceptance Criteria](https://www.atlassian.com/work-management/project-management/acceptance-criteria)

### 2.3 成熟团队的调整方向

论坛和官方实践中反复出现几个共识：

- 先定义 done，再委派 agent。
- 不让实现 agent 自己最终验收自己的工作。
- PR 必须附带测试结果、日志、截图、风险和未覆盖项。
- 文档拆成“给人看的短文档”和“给 AI 执行的长规格”。
- 验收标准必须映射到测试、截图、接口响应、日志或人工确认项。
- 没有验收矩阵，不允许进入开发。
- 没有证据包，不允许进入 review。

V2EX 上一个 Agent Harness 实践总结得很直接：不能指望 agent 每次自觉检查验收标准，要让它在没有逐条检查的情况下无法提交。参考：[写了三个月 Agent Harness，我终于敢让 Claude Code 全自动写代码了](https://www.v2ex.com/t/1205752?p=1)

---

## 3. 推荐治理模型

### 3.1 四类文档

不要让 AI 输出一份“大而全”的项目文档。建议固定为四类文档。

| 文档 | 读者 | 作用 | 是否必须人工审核 |
|---|---|---|---|
| Human Review Brief | 架构师、PM、QA、业务方 | 对齐目标、范围、风险、人工决策点 | 必须 |
| Agent Spec | AI agent、开发者 | 提供详细上下文、接口、数据模型、约束 | 抽查 |
| Acceptance Matrix | 架构师、QA、agent、reviewer | 定义可验证完成条件 | 必须 |
| Proof Packet | reviewer、QA、架构师 | 证明实现满足验收标准 | 必须 |

### 3.2 角色分离

| 角色 | 可以由 AI 做吗 | 说明 |
|---|---:|---|
| 候选需求整理 | 可以 | AI 可以总结访谈、会议纪要、issue |
| 业务目标确认 | 不应完全交给 AI | 必须由业务负责人或产品负责人确认 |
| 架构方案候选 | 可以 | AI 可以提供多个方案和取舍 |
| 架构决策 | 不应完全交给 AI | 架构师负责决策和 ADR |
| 代码实现 | 可以 | 可由 agent 完成大部分代码 |
| 测试生成 | 可以 | 但测试本身需要审查 |
| 验收标准生成 | 只能生成候选 | 最终 AC 必须由人确认 |
| 最终验收签字 | 不可以 | 必须由人负责 |

---

## 4. Human Review Brief 模板

这个文档给人看，目标是快速判断“需求是否值得做、范围是否清楚、风险是否可控”。

```md
# Human Review Brief: <功能名称>

## 1. 背景
为什么现在要做这个功能？当前问题是什么？

## 2. 目标
- G-001:
- G-002:

## 3. 非目标
- NG-001:
- NG-002:

## 4. 用户路径
### Path-001: <路径名称>
1. 用户处于什么状态
2. 用户执行什么动作
3. 系统返回什么结果
4. 用户如何判断成功

## 5. 关键业务规则
- BR-001:
- BR-002:
- BR-003:

## 6. 人工决策点
| ID | 决策问题 | 候选选项 | 推荐 | 决策人 |
|---|---|---|---|---|
| HD-001 |  |  |  |  |

## 7. 主要风险
| ID | 风险 | 影响 | 缓解方式 |
|---|---|---|---|
| R-001 |  |  |  |

## 8. 审核结论
- [ ] 目标清楚
- [ ] 非目标清楚
- [ ] 业务规则清楚
- [ ] 人工决策点已确认
- [ ] 可以进入 Agent Spec
```

---

## 5. Agent Spec 模板

这个文档给 AI 和开发者使用，可以长，但必须结构化。人类只需要抽查它是否与 Human Review Brief 一致。

```md
# Agent Spec: <功能名称>

## 1. 来源
- Human Review Brief:
- 相关 issue:
- 相关 ADR:
- 相关设计稿:

## 2. 功能范围
### In Scope
-

### Out of Scope
-

## 3. 现有系统上下文
### 相关模块
-

### 相关文件
-

### 相关接口
-

### 相关数据表/集合
-

## 4. 业务规则映射
| BR ID | 规则 | 影响模块 | 备注 |
|---|---|---|---|
| BR-001 |  |  |  |

## 5. 架构约束
- 不允许修改：
- 必须复用：
- 必须兼容：
- 安全要求：
- 性能要求：

## 6. 数据模型
### 新增字段
| 字段 | 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|

### 迁移策略
-

## 7. API 契约
### <METHOD> <PATH>
请求：
响应：
错误码：
权限：

## 8. UI/交互契约
- 页面：
- 状态：
- 错误提示：
- 空状态：
- 加载态：

## 9. 测试策略
- 单元测试：
- 集成测试：
- E2E：
- 安全测试：
- 回归测试：

## 10. 实现任务拆分
| Task ID | 目标 | 依赖 | 覆盖 AC |
|---|---|---|---|
| T-001 |  |  |  |
```

---

## 6. Acceptance Matrix 模板

验收标准必须使用矩阵。每条 AC 都必须满足：

- 有来源
- 有前置条件
- 有操作
- 有可观察结果
- 有证据方式
- 有优先级
- 有执行方式：自动、人工、自动+人工

```md
# Acceptance Matrix: <功能名称>

| AC ID | 来源 | 前置条件 | 操作 | 期望结果 | 证据 | 优先级 | 执行方式 |
|---|---|---|---|---|---|---|---|
| AC-001 | BR-001 |  |  |  |  | P0 | 自动 |
| AC-002 | Path-001 |  |  |  |  | P0 | 自动+人工 |
| AC-003 | R-001 |  |  |  |  | P1 | 人工 |
```

### 合格 AC 示例

```md
AC-003
来源：BR-004 权限隔离
前置条件：用户 A 属于 org_1，项目 P 属于 org_2
操作：用户 A 请求 GET /api/projects/P
期望结果：返回 403；响应体不包含项目名称、成员列表、org_2 任意字段
证据：集成测试 tests/auth/project-access.test.ts 通过；保存接口响应样例
优先级：P0
执行方式：自动
```

### 不合格 AC 示例

```md
AC-X
系统应正确控制权限。
```

问题：

- 没有前置条件
- 没有操作
- 没有具体期望结果
- 没有证据
- “正确”不可验证

---

## 7. Given-When-Then 约束

对用户行为和业务规则，建议把 AC 改写成 Given-When-Then。Agile Alliance 对该格式的定义是：Given 描述上下文，When 描述动作，Then 描述可观察后果。参考：[Agile Alliance: Given-When-Then](https://agilealliance.org/glossary/given-when-then/)

```md
Given 用户 A 属于 org_1，项目 P 属于 org_2
When 用户 A 请求 GET /api/projects/P
Then 系统返回 403
And 响应体不包含 org_2 的任何业务数据
```

---

## 8. Definition of Done 与 Acceptance Criteria 的边界

AI 很容易混淆 DoD 和 AC。建议明确区分：

| 类型 | 作用范围 | 示例 |
|---|---|---|
| Acceptance Criteria | 单个需求/用户故事 | 无权限用户访问订单详情时返回 403 |
| Definition of Done | 所有任务通用质量门槛 | 测试通过、无高危漏洞、文档更新、部署到 staging |

Atlassian 强调 DoD 是团队级共享质量标准，AC 是用户故事或功能的具体接受条件。参考：[Atlassian Definition of Done](https://www.atlassian.com/agile/project-management/definition-of-done)

### 推荐 DoD

```md
# Definition of Done

- [ ] 所有关联 AC 均有 pass/fail 结果
- [ ] P0 AC 全部通过
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 关键用户路径 E2E 通过
- [ ] lint/typecheck 通过
- [ ] 无高危安全扫描问题
- [ ] 数据迁移可回滚
- [ ] 监控/日志已补齐
- [ ] 文档已更新
- [ ] Proof Packet 已提交
- [ ] 人工复核点已处理
```

---

## 9. Proof Packet 模板

AI 完工后必须提交证据包。没有证据包，不进入 review。

```md
# Proof Packet: <功能名称>

## 1. 任务信息
- Feature:
- Branch:
- PR:
- 执行 Agent:
- 时间:

## 2. AC 执行结果
| AC ID | 结果 | 证据位置 | 备注 |
|---|---|---|---|
| AC-001 | PASS |  |  |
| AC-002 | FAIL |  |  |
| AC-003 | NOT RUN |  |  |

## 3. 测试命令
```bash
npm test
npm run lint
npm run e2e
```

## 4. 测试结果摘要
- Unit:
- Integration:
- E2E:
- Lint:
- Typecheck:

## 5. 关键证据
- 测试日志：
- 截图：
- API 响应样例：
- 数据库迁移结果：
- 性能数据：

## 6. 修改范围
### 主要文件
-

### 高风险文件
-

### 明确未修改
-

## 7. 已知风险
| 风险 | 影响 | 建议 |
|---|---|---|

## 8. 人工复核点
| ID | 复核内容 | 负责人 |
|---|---|---|

## 9. Agent 自评
- 哪些地方最可能错：
- 哪些地方没有足够证据：
- 哪些地方需要业务确认：
```

---

## 10. AI Reviewer 规则

实现 agent 和 reviewer agent 必须隔离上下文。Reviewer 不应复述实现过程，而应按规则审查。

```md
你是独立验收审查员。你的任务不是评价代码风格，而是判断交付是否满足已确认的 Acceptance Matrix。

审查规则：
1. 每条 AC 必须有 pass/fail/not-run 结论。
2. 没有证据的 pass 一律改为 fail。
3. 如果 AC 来源不存在，标记为 invalid-ac。
4. 如果 AC 使用模糊词，如“合理、稳定、完善、快速、友好、正确”，标记为 not-verifiable。
5. 如果实现修改了未授权文件，标记为 scope-violation。
6. 如果测试只覆盖 mock，不覆盖真实业务路径，标记为 weak-evidence。
7. 如果权限、数据隔离、计费、删除、迁移、并发未覆盖，按风险标记。
8. 不允许根据实现过程给同情分。

输出格式：

| AC ID | 结论 | 问题 | 必须补充的证据 |
|---|---|---|---|
```

---

## 11. 文档质量审查规则

AI 文档要按“人类可审查性”评分，而不是按篇幅评分。

### 11.1 人类文档检查项

```md
- [ ] 5 分钟内能看懂目标、范围和风险
- [ ] 所有假设都显式标记
- [ ] 决策点集中在一个表里
- [ ] 非目标明确
- [ ] 每条业务规则有编号
- [ ] 每条 AC 能追溯到业务规则、用户路径或风险
- [ ] 没有大段无结论背景描述
- [ ] 没有“完善、合理、优化、稳定”等不可审核词汇
- [ ] 术语表存在，且关键术语一致
- [ ] 文档说明哪些内容给人看，哪些内容给 agent 看
```

### 11.2 写作风格要求

参考 Google Developer Documentation Style Guide，文档应清晰、直接、避免术语堆砌和冗长句子。参考：[Google Developer Documentation Style Guide](https://developers.google.com/style/tone)

建议：

- 一段只表达一个观点。
- 长解释改成表格。
- 决策用“选项-取舍-结论”表达。
- 禁止无来源的肯定句。
- 禁止 AI 自行加入“最佳实践”但不说明与本项目关系。
- 设计文档实现后应归档为历史决策，不要当作最新运行手册。

Google 文档最佳实践也提醒：代码让机器理解还不够，文档要优先让人理解。参考：[Google Documentation Best Practices](https://google.github.io/styleguide/docguide/best_practices.html)

---

## 12. ADR 模板

架构决策不要散落在对话里。重大选择必须进入 ADR。

Google Cloud 对 ADR 的建议是记录关键选项、驱动决策的需求、最终选择和原因，并把 ADR 放在靠近代码的位置。参考：[Google Cloud ADR](https://docs.cloud.google.com/architecture/architecture-decision-records)

```md
# ADR-0001: <决策标题>

## 状态
Proposed / Accepted / Superseded

## 背景
当前要解决什么架构问题？

## 驱动需求
- FR-001:
- NFR-001:
- Risk-001:

## 候选方案
| 方案 | 优点 | 缺点 | 风险 |
|---|---|---|---|
| A |  |  |  |
| B |  |  |  |

## 决策
选择方案：

## 原因
为什么选择它？

## 后果
### 正面影响
-

### 负面影响
-

### 后续动作
-

## 关联文档
- Human Review Brief:
- Acceptance Matrix:
- PR:
```

---

## 13. 流程门禁

### 13.1 Ready for Development

进入开发前必须满足：

```md
- [ ] Human Review Brief 已审核
- [ ] 非目标明确
- [ ] 人工决策点已关闭或标记为 blocker
- [ ] Agent Spec 与 Brief 一致
- [ ] Acceptance Matrix 已审核
- [ ] P0 AC 全部可验证
- [ ] 高风险项已有测试或人工验收方式
- [ ] 任务已拆到可独立 review 的粒度
```

### 13.2 Ready for Review

进入 review 前必须满足：

```md
- [ ] Proof Packet 已提交
- [ ] 所有关联 AC 有 pass/fail/not-run
- [ ] P0 AC 全部 pass
- [ ] 测试日志可查看
- [ ] 高风险文件已标记
- [ ] 未覆盖项已说明
- [ ] 文档和 ADR 已同步
```

### 13.3 Ready for Release

进入发布前必须满足：

```md
- [ ] 人工复核点已签字
- [ ] staging 已验证
- [ ] smoke test 通过
- [ ] 监控和日志可用
- [ ] 回滚方案存在
- [ ] 数据迁移已演练或可回滚
- [ ] Release note 已更新
```

---

## 14. 推荐落地步骤

### 第 1 周：建立模板

- 建立 `docs/briefs/`
- 建立 `docs/specs/`
- 建立 `docs/acceptance/`
- 建立 `docs/adr/`
- 建立 `docs/proof/`
- 建立 repo 级 `AGENTS.md` 或 `CLAUDE.md`

### 第 2 周：建立 AC 门禁

- 所有 AI 任务必须绑定 AC。
- AC 无来源则不能进入开发。
- AC 无证据方式则不能进入开发。
- P0 AC 未通过则不能进入 review。

### 第 3 周：建立 Proof Packet

- PR 模板要求提交 Proof Packet。
- 测试日志、截图、接口响应必须附链接。
- 未运行检查必须说明原因。

### 第 4 周：建立独立 AI Reviewer

- reviewer agent 审 AC 可验证性。
- reviewer agent 审 Proof Packet 完整性。
- reviewer agent 审 scope violation。
- 人类只处理 reviewer 标记的风险和最终判断。

---

## 15. 推荐目录结构

```text
docs/
  briefs/
    feature-x.brief.md
  specs/
    feature-x.spec.md
  acceptance/
    feature-x.acceptance.md
  proof/
    feature-x.proof.md
  adr/
    0001-use-event-driven-sync.md
  glossary.md
  definition-of-done.md

.github/
  pull_request_template.md
  copilot-instructions.md

AGENTS.md
CLAUDE.md
```

---

## 16. PR 模板

```md
## 变更目标

## 关联文档
- Brief:
- Spec:
- Acceptance Matrix:
- ADR:

## 覆盖 AC
- AC-001
- AC-002

## Proof Packet
- 链接：

## 测试
- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] Lint
- [ ] Typecheck
- [ ] Security scan

## 高风险改动

## 未覆盖项

## 人工复核点
```

---

## 17. 给 AI 的全局规则示例

```md
# AGENTS.md

## 工作原则
- 不允许自行扩大需求范围。
- 不允许把假设写成事实。
- 不允许用“优化、完善、合理、稳定、正确”作为验收结论。
- 实现前必须读取 Acceptance Matrix。
- 完工后必须生成 Proof Packet。
- 没有证据的 AC 不得标记为 PASS。

## 文档规则
- Human Review Brief 面向人类，必须短、清晰、可审查。
- Agent Spec 面向实现，可以详细，但必须引用 Brief 和 AC。
- ADR 只记录架构决策，不记录普通实现细节。

## 验收规则
- 每条 AC 必须包含：来源、前置条件、操作、期望结果、证据、优先级。
- P0 AC 失败时不得声称任务完成。
- 如果发现 AC 不可验证，先报告，不要自行改写后继续开发。

## 提交规则
- 保持 PR 小而可审查。
- 不做无关重构。
- 不修改未授权文件。
- 每次提交说明覆盖了哪些 AC。
```

---

## 18. 最终建议

AI 交付体系里，真正要治理的不是“AI 会不会写文档”，而是“文档能不能被人快速审查、能不能驱动验收、能不能阻断错误进入下一阶段”。

推荐的核心制度是：

```text
AI 生成候选内容，人类确认目标和验收。
AI 负责实现和提供证据，人类负责最终判断和签字。
```

如果只保留一条规则，应保留：

```text
没有 Acceptance Matrix，不开发。
没有 Proof Packet，不 review。
没有人工签字，不发布。
```
