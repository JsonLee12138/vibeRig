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
- `risk-register.json`
- `release-plan.md` / `delivery-plan.md`
- `traceability.json`
- `pre-development-review.md`

不要为满足清单创建空洞文档。不适用产物在 review 中写理由。

## 语义漂移

技术规划发现以下情况时返回 `intake` 人工 Gate：

- 推荐方案改变用户行为或业务规则；
- scope、非目标或兼容承诺需要变化；
- 风险从可逆局部修改升级为不可逆或高副作用；
- AC 无法在已确认需求下写成可判定条件。

纯技术细化、测试工具选择、fixture、mock 或环境搭建不要求用户再次确认。

## 交接

计划满足 DoR 后直接更新 Goal Contract 并进入 `execute`。不要要求用户再调用 `task-runner`。人工需求 Gate 仍是 `intake` 的确认；最终业务 Gate 是 `accept-deliver`。

## 完成检查

- [ ] 只为 L2/L3 或显式请求运行。
- [ ] 产物深度与风险匹配。
- [ ] L2 未固定启动完整红白队。
- [ ] 产品语义漂移已返回 `intake`。
- [ ] 技术计划已自动交给 `execute`。
