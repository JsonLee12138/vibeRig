---
name: accept-deliver
description: 对已完成技术验证的 VibeRig 工作执行证据审计、人工 UAT、明确验收和授权交付。用户说“验收、确认完成、accept、合并已验收 PR、交付、发布”，或旧的 accept-issue、accept-milestone、merge-issue 流程触发时使用。发现问题时返回 execute Goal Loop，不在本 skill 内修代码。
---

# Accept Deliver

这是第三个人工阶段。自动化负责准备可信 Evidence，人负责判断真实需求是否被满足。自动化测试不能代替业务验收。验收与 merge/release 授权是两个独立决定。

## 输入

读取：

- `.vibeRig/project.yaml` 的语言、PR 和 Gate 策略；
- 已确认 Work Item、需求基线和验收指南；
- Goal Contract、Evidence Packet、当前 diff/commit、CI 和 PR；
- Issue 或 Milestone 的已有验收、交付和知识状态；
- 用户指定的验收范围。

无法证明 Evidence 对应当前 commit 或交付目标时，不开始人工验收，返回 `execute` 补齐。

## 模式

| 模式 | 范围 |
|---|---|
| `work_item` | 单个 Work Item 或 standalone issue |
| `milestone` | 一个里程碑的聚合 Evidence、回归、E2E 和 UAT |
| `delivery` | 已验收内容的 commit、PR、merge 或 release |

旧的 `accept-issue` 与 `accept-milestone` 只选择验收范围；`merge-issue` 只选择 delivery mode。三者不再维护独立协议。

## 阶段 1：Evidence 审计

1. 解析 Work Item、scope、AC/TC、风险和交付目标；
2. `git fetch` 或读取 provider 状态，确认 Evidence、CI、PR head 与当前 commit 一致；
3. 检查 Required Evidence 的环境和保真度；
4. 复用仍有效的证据，只重跑失效或聚合层 Gate；
5. 汇总 blocking finding、SKIP/BLOCKED 和残余风险；
6. 生成用户可执行的最短 UAT 清单。

Mock、fake 或 local pass 不能满足要求 sandbox、real、owner UAT 或 post-release 的条件。

## 阶段 2：人工验收 Gate

向用户展示一个合并摘要：

- 已确认的真实需求与非目标；
- 当前交付内容和 commit/PR；
- 自动化 Evidence 与环境；
- 需要用户执行或观察的 UAT 步骤；
- 精确预期、失败信号和证据；
- 已知残余风险；
- 验收通过后仍不会自动执行的副作用。

等待明确结论：

- **通过**：持久化 acceptance event，Work Item 置为 `accepted`；
- **有条件通过**：记录条件；未满足的 blocking 条件返回 `execute`；
- **退回**：记录失败 Evidence 和期望修正，返回同一 Goal Loop；
- **仅确认技术完成**：不得冒充业务验收通过。

不要根据“看起来没问题”、CI 通过或用户沉默推断验收。

## 阶段 3：交付授权

验收通过后单独解析 authority：

| 用户授权 | 可执行动作 |
|---|---|
| 无额外授权 | 只记录验收 |
| 提交 / PR | 完成对应 Git/Provider 动作 |
| 合并 | 校验 accepted commit、PR head、CI、审批和冲突后合并 |
| 发布 | 校验发布 Gate、回滚和 Smoke 后发布 |

merge 或 release 未明确授权时停止在已验收状态。这是合法终态，不是 Blocker。

任何 merge/release API 前必须先持久化完整 Delivery Intent，绑定 acceptance event、provider target、expected base/head、执行方式和本次用户授权；随后重新检查动态 Gate。

Provider 已显示 `MERGED` 时不得再次调用 merge。使用 immutable PR identity、accepted head 和 provider merge commit 证明交付；无法唯一证明时 fail closed。

## 返工

发现问题时创建结构化返工输入：

- 失败的 AC/TC 或 UAT 步骤；
- 实际结果和证据；
- 期望修正；
- 受影响范围；
- 已失效 Evidence；
- 仍有效 Evidence。

将其交回 `execute` 的 `REPAIR` 状态。不要要求用户重新调用 `quick`、`task-runner` 或另一个验收 Skill。

## 外部记录与知识

- 主 Agent 写 acceptance/delivery event，Subagent 不写；
- 外部记录暂不可用不改变人工验收事实，保留幂等 outbox；
- 验收后生成 Evidence-backed retrospective；
- retrospective 保留 schema-valid Subagent/model route observations；单次观测不自动改变默认模型；
- 只有 novelty、重复缺陷、里程碑或批量阈值触发 `vb-wiki` 编译；
- 工具 Skill 晋升仍需要用户显式授权；
- 知识写入失败不应撤销已成立的验收或已授权交付。

状态与幂等细节见 [acceptance-and-delivery.md](./references/acceptance-and-delivery.md)。

## 完成检查

- [ ] Evidence、CI、PR 与当前 commit 对齐。
- [ ] Required Evidence 的保真度满足 AC/TC。
- [ ] 用户看到了可执行 UAT、失败信号和残余风险。
- [ ] 仅在用户明确表示通过后记录 acceptance。
- [ ] 验收与 merge/release 授权被分别记录。
- [ ] 退回项进入同一 `execute` Goal Loop，未创建人工 Skill 接力。
- [ ] 外部事件幂等，未重复验收、合并、发布或知识编译。
