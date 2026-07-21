---
name: split-milestones
description: 将需求按可验收用户价值拆成里程碑。由 pre-development 调用时仅生成本地 draft；老板批准完整开发前方案后才 materialize 到 Linear。也可用于继续已批准需求的里程碑规划。
---

# Split Milestones（里程碑规划）

先在开发前阶段形成无外部副作用的交付草案，审批后再把已批准计划写入 Linear。

## 前置门禁

- `acceptance.json` 存在并通过 schema 校验；
- `architecture.md`、测试计划、风险登记和 CTO 汇总所需输入已完成，或明确说明不适用；
- 每条 AC 可分配到一个可交付阶段。

## 两种模式

### Draft 模式

由 `pre-development` 在老板审批前调用：

1. 读取需求、架构、验收、测试、风险、发布与追踪信息；
2. 按可验收用户价值和可发布增量拆分，不按模块一一对应；
3. 架构依赖只约束顺序、并行性和技术边界；
4. 每条 AC 恰好分配到一个里程碑并回填 `acceptance.json`；
5. 将里程碑草案写入 `delivery-plan.md` 与 `requirement.yaml`，`linear_id: null`、`status: draft`；
6. 不向老板逐项确认，方案随 CTO 汇总包一次审批；
7. 禁止写 Linear。

### Materialize 模式

只在 `requirement.planning.owner_approval` 为 `approved`，且状态为 `ready_for_development` 或 `conditionally_approved` 的已满足条件状态时执行：

1. 校验待写计划与审批范围一致；
2. 请 `vb-linear` 按需求和标题查重，优先复用/更新；
3. 创建或更新挂在容器 Project 下的 Milestone；
4. 描述仅放 Document 链接、本地契约路径、用户价值、AC IDs，不粘贴全文；
5. 回填 `linear_id`，状态改为 `not_started`，更新 `linear.yaml`；
6. 需求状态置为 `planned`，写一条计划同步摘要。

## 里程碑标准

每个候选项必须同时满足：

1. 完成后用户能做一件此前做不到的事，或获得一个可独立衡量的结果；
2. 有不重不漏的 AC 集合和老板可执行的阶段验收；
3. 可以独立发布、启用或在隔离环境中演示；
4. 值得对外汇报进度，通常包含至少 3 个垂直任务；
5. 风险、依赖、迁移和回滚边界可说明。

纯脚手架、纯数据库、纯 API、纯 UI 或“联调/QA”不能独立成为里程碑；把它们并入产生用户价值的阶段。

## 本地草案内容

每个里程碑至少包含：`id`、标题、用户价值、范围/非目标、主要交付域（兼容 `module` 字段）、AC IDs、测试用例 IDs、风险 IDs、依赖、发布/回滚信号、预计 issue 数和规划置信度。

后续里程碑允许保留较低细节并标为 indicative，但范围、价值、AC、风险和依赖必须在审批前可见。

## 红线

- 老板审批前创建或更新 Linear Milestone。
- 以模块边界代替用户价值边界。
- AC 遗漏、重复归属或里程碑无可执行验收。
- Materialize 时没有检查批准状态和计划差异。
- 把 Issue 拆分或 subagent 路由混入本 skill。

## 完成检查

- [ ] 每个里程碑满足五项标准，AC 分配不重不漏。
- [ ] Draft 只写本地，`linear_id` 为 null，状态为 `draft`。
- [ ] Materialize 前批准状态、审批条件、查重均通过。
- [ ] 正式 Milestone 与审批版本一致，本地 ID/Linear ID 已回填。
- [ ] 人读内容使用 `output.language`。

## 下一步

Draft 模式交给 `split-issues` 生成 Issue 草案并返回 `pre-development`；Materialize 后由 `split-issues` 只创建下一个里程碑的正式 Issues。
