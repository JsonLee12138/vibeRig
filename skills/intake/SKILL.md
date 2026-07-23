---
name: intake
description: 对任何尚未确认真实范围的软件工作进行脑暴、现状调研、问题建模和需求基线确认。用户描述新功能、Bug、小改动、优化、技术债、风险，要求记录问题，或直接要求实现但没有已确认 Work Item 时使用。确认后写入统一文档，并按目标自动进入 execute；用户不需要选择 bugger、record-issue 或其他流程 Skill。
---

# Intake

这是第一个人工阶段：先理解真正要解决的问题，再让用户一次确认。确认前不写需求基线、不创建 Linear Issue、不开始实现；确认后不要求用户手工选择下一个 Skill。

## 输入与边界

读取 `.vibeRig/project.yaml` 的文档根和输出语言。先检查仓库、现有文档、Issue、日志、截图和当前行为；能从事实确认的内容不要询问用户。

所有工作使用统一 Work Item，不按 Bug/Feature 分裂流程。契约和 schema：

- [Work Item 契约](../execute/references/contracts.md)
- [work-item.schema.json](../execute/assets/work-item.schema.json)
- [requirement.schema.json](./assets/requirement.schema.json)

已有 confirmed Work Item 且用户只要求执行时，直接进入 `execute`，不要重复访谈。

## 脑暴与调研

围绕用户目标主动探索：

| 维度 | 必须收敛的结论 |
|---|---|
| 问题 | 当前观察、预期结果、为什么现在处理 |
| 证据 | 代码、复现、日志、用户事实；区分事实与推断 |
| 原因模型 | 已确认原因、带置信度的假设，或 feature 的 limitation/opportunity |
| 用户与流程 | 使用者、角色、入口、主路径、异常和恢复 |
| 规则与边界 | 状态、计算、权限、错误、兼容和极端情况 |
| 方案 | 推荐修改、选择理由和关键替代方案 |
| 影响 | 用户、模块、接口、数据、安全、运维和 blast radius |
| 范围 | 本期包含、明确非目标、受影响模块 |
| 验收 | 可判定 AC、工程 Evidence、人工 UAT 关注点 |
| 测试 | 层级、环境、最低保真度、需要真实环境的边界 |
| 风险与依赖 | L0–L3、升级信号、外部系统和可模拟性 |
| 交付终点 | diagnosed、recorded、planned、verified、committed、pr_ready、merged、released |

缺陷优先复现和定位；无法证实 root cause 时写 `hypothesis` 与验证方法。新功能不编造 root cause，描述当前 limitation 或 opportunity。

## 交互方式

一次只问一个最有信息增益的问题，并附上基于当前证据的最佳猜测。不要机械遍历字段。

满足以下任一条件才询问：

- 两种答案会改变产品语义；
- 会改变 scope、风险或兼容性；
- 无法从代码、文档或现有证据推断；
- 涉及不可逆操作或外部副作用；
- 验收人真正关心的结果不明确。

技术实现细节、测试框架选择和可模拟配置不转交用户决定。

## 人工 Gate 1：需求基线确认

形成一份合并摘要：

1. 问题与期望结果；
2. 事实、原因或原因假设及置信度；
3. 推荐方案与关键替代方案；
4. 影响、范围与非目标；
5. AC、测试策略和人工验收步骤；
6. 风险、依赖和交付终点；
7. 尚未解决且必须由用户决定的事项。

只请求一次整体确认：

- 用户确认：写入权威文档；
- 用户修订：更新 Work Item 后再次展示受影响部分；
- 用户只要分析：返回分析，不写外部记录；
- 用户未确认：不得开始实现或创建 Issue。

## 写入文档

确认后创建稳定 kebab-case id：

```text
.vibeRig/requirements/<work-id>/
  intake.md
  work-item.json
  requirement.yaml
  linear.yaml          # 仅在外部记录成功后存在
```

- `work-item.json.status = baselined`；
- `requirement.yaml.status = requirement_baselined`；
- `requirement.yaml.planning.owner_approval = approved`，`approved_at` 记录本次 Gate；这是需求基线确认，不是 merge/release 授权；
- `intake.md` 是人读摘要，不包含内部推理；
- 扫描 requirements 与 archive 防止 id 冲突；
- Linear 不可用不阻塞本地权威文档。

如果目标是 `recorded`，请 `vb-linear` 查重后一次性写入完整 Work Item；不先建空 Issue 再补评论。

## 自动交接

确认并写入后：

| 风险/目标 | 下一步 |
|---|---|
| `diagnosed` / `recorded` / `planned` | 达到目标后停止 |
| L0/L1 开发 | 直接进入 `execute` |
| L2/L3 开发 | 内部调用 `pre-development` 补技术计划，再进入 `execute` |
| UI/UX 专项 | 按需调用 `uiux-design`，产物回到同一 Goal Contract |

`pre-development`、调研、架构和验收设计都不是新的人工阶段。只有其结论改变已确认的产品语义时，才返回本 Gate。

## 红线

- 要求用户先判断该用 `bugger`、`record-issue`、`quick` 或 `task-runner`。
- 未检查代码和现有文档就开始问事实型问题。
- 未确认就写需求基线、创建 Issue 或修改代码。
- 为 feature 编造 root cause，或把未证实假设写成事实。
- 只记录问题标题，没有方案、影响、范围、验收和测试策略。
- 确认后在内部 Skill 边界再次要求用户操作。

## 完成检查

- [ ] Work Item 的问题、原因状态、方案、影响、范围、验收、测试、风险和终点完整。
- [ ] 所有关键判断有证据或明确标记为假设。
- [ ] 用户已一次性确认真实需求基线。
- [ ] `intake.md`、`work-item.json`、`requirement.yaml` 已写入并通过 schema。
- [ ] 外部记录失败未阻塞本地流程。
- [ ] 需要开发时已自动进入 `execute` 或内部技术规划。
