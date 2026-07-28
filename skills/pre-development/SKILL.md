---
name: pre-development
description: 为已确认的 L2/L3 Work Item 生成技术调研、架构、AC/TC、风险和交付计划，并把 Milestone / Issue 作为不可执行草案写入 Linear 供人工确认。通常由 intake 在需求基线确认后内部调用；用户明确要求架构或开发前方案时也可使用。
---

# Pre Development

将已确认需求转成可执行技术计划。内部研究与设计不反复打断用户；但交付拆分必须先投影成 Linear 草案，再经过一次独立的计划确认 Gate。

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
| L2 | 对会改变设计的未知项派发定向 research；实现与 Review 分离；仅在公共契约、不可逆、安全或数据风险触发时选择一个最高信息增益 red-team focus |
| L3 | 并行多领域 research；强制独立 `architecture` 与 `delivery` red-team focus；按风险追加 `security` / `failure_modes`；完整 Gate 与回滚 |

按需调用 `prd-brainstorm`、`tech-research`、`architecture-design`、`define-acceptance`、`security-and-hardening`、`uiux-design`。调用 `subagent-routing` 时先标记 Gate 为 `required`、`recommended` 或 `optional`：

- `required` 必须产生真实 dispatch receipt；缺少 capability 或派发失败时进入 `pre_development_blocked`；
- `recommended` / `optional` 可由主 Agent 降级，但必须记录原因；
- 主 Agent 不得冒充独立研究、红队、白队或 Review。

## 产物

在需求目录按风险生成：

- `research/*.md`
- `architecture.md`
- `acceptance.json` 与 `acceptance-guide.md`
- `test-plan.md` 与 `test-cases.json`
- `risk-register.json`
- `release-plan.md` / `delivery-plan.md`
- `traceability.json`
- `pre-development-review.md`

不要为满足清单创建空洞文档。不适用产物在 review 中写理由。

每次真实 Subagent 派发同时保存 `route_observation` 与 `dispatch_receipt`。前者用于模型路由学习，后者证明实际调用、artifact fingerprint、独立关系和返回结果；二者不能互相替代。

## 语义漂移

技术规划发现以下情况时返回 `intake` 人工 Gate：

- 推荐方案改变用户行为或业务规则；
- scope、非目标或兼容承诺需要变化；
- 风险从可逆局部修改升级为不可逆或高副作用；
- AC 无法在已确认需求下写成可判定条件。

纯技术细化、测试工具选择、fixture、mock 或环境搭建不要求用户再次确认。

## 人工 Gate 2：Linear 计划确认

DoR 通过后：

1. 调用 `split-milestones` 与 `split-issues` 生成稳定本地草案和 `plan_fingerprint`；
2. 在人工计划确认前将全部 Milestone / Issue 幂等写入 Linear，明确标为不可执行草案；
3. 展示 Project、Milestone、Issue 链接、范围、依赖、风险和 indicative 项；
4. 只请求一次整体计划确认；
5. 批准后绑定 fingerprint，近期 Issues 进入 Ready/Todo；修订时复用原 Linear 对象更新；
6. Linear 不可用时写 outbox，恢复同步前不请求“Linear 可视化计划”的确认。

只有计划批准且近期 Issues 已激活后，才更新 Goal Contract 并进入 `execute`。不要要求用户再调用 `task-runner`。最终业务 Gate 仍是 `accept-deliver`。

## 完成检查

- [ ] 只为 L2/L3 或显式请求运行。
- [ ] 产物深度与风险匹配。
- [ ] L2 只在触发信号存在时选择一个 red-team focus；L3 已完成规定的独立派发。
- [ ] 所有 required Gate 有真实 dispatch receipt；缺失时未伪装通过。
- [ ] 产品语义漂移已返回 `intake`。
- [ ] Milestone / Issue 在人工确认前已作为不可执行草案写入 Linear。
- [ ] 人工批准绑定当前 plan fingerprint；批准后才交给 `execute`。
