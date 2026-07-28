---
name: split-milestones
description: 将已确认 Work Item 按可验收用户价值拆成里程碑，先作为不可执行草案写入 Linear 供人工可视化确认，再在批准后激活。由 pre-development 内部调用；也可用于继续已确认需求的里程碑规划。
---

# Split Milestones（里程碑规划）

先形成本地交付草案，再幂等写入 Linear 作为**不可执行计划草案**。人工确认针对 Linear 中真实可见的 Milestone / Issue，而不是聊天摘要。需求基线确认和计划确认是两个不同 Gate；产品语义漂移仍必须返回 `intake`。

## 前置门禁

- `acceptance.json` 存在并通过 schema 校验；
- `architecture.md`、测试计划、风险登记和 CTO 汇总所需输入已完成，或明确说明不适用；
- 每条 AC 可分配到一个可交付阶段。
- `requirement.planning.owner_approval` 已确认需求基线；此字段不代表交付计划已批准。

## 三个阶段

### 1. Local Draft

由 `pre-development` 在技术计划阶段调用：

1. 读取需求、架构、验收、测试、风险、发布与追踪信息；
2. 按可验收用户价值和可发布增量拆分，不按模块一一对应；
3. 架构依赖只约束顺序、并行性和技术边界；
4. 每条 AC 恰好分配到一个里程碑并回填 `acceptance.json`；
5. 将里程碑草案写入 `delivery-plan.md` 与 `requirement.yaml`，初始 `linear_id: null`、`status: draft`；
6. 计算包含 Milestone、Issue、AC/TC、依赖和范围的 `plan_fingerprint`；
7. 若分解改变已确认 scope、业务规则或验收语义，返回 `intake`。

### 2. Publish Draft

需求基线已确认、DoR 技术内容已形成后，在人工计划确认**之前**执行：

1. 校验待写计划与需求基线一致；
2. 请 `vb-linear` 按需求和标题查重，优先复用/更新；
3. 创建或更新挂在容器 Project 下的 Milestone；
4. 描述仅放 Document 链接、本地契约路径、用户价值、AC IDs、`plan_fingerprint` 和稳定标记 `VibeRig-Plan-Draft`，不粘贴全文；
5. 回填 `linear_id`，本地状态改为 `pending_plan_confirmation`，更新 `linear.yaml`；
6. `requirement.status = plan_draft_sync`，`planning.plan_approval = pending`；
7. 再调用 `split-issues` Publish Draft；Milestone 和 Issue 都可见后才进入人工确认。

Linear 暂不可用时，将稳定 id、目标 host、payload fingerprint 和预期动作写入 outbox。不得跳过可视化直接请求计划批准；同步恢复后再展示 Linear 链接。

### 3. Activate

仅在用户明确批准与当前 `plan_fingerprint` 一致的 Linear 草案后执行：

1. 持久化 plan approval event，记录用户结论、时间、条件、fingerprint 和 Linear 对象；
2. `planning.plan_approval = approved|conditional`，写 `plan_approved_at`；
3. Milestone 本地状态进入 `ready_for_development`；条件批准项保持 Gate；
4. 请 `vb-linear` 更新草案标记和计划同步摘要，但不把 Milestone/Issue 置为 In Progress；
5. 与 `split-issues` 一起只激活近期可执行范围；后续计划继续留在可见 Backlog。

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

- 把 Linear 草案的存在当成计划已批准。
- 草案使用 In Progress、Done 或其他表示已经授权执行的状态。
- 以模块边界代替用户价值边界。
- AC 遗漏、重复归属或里程碑无可执行验收。
- 修改计划后沿用旧 `plan_fingerprint` 或旧人工批准。
- Linear 写入失败后仍宣称用户看到了可视化计划。
- 把 Issue 拆分或 subagent 路由混入本 skill。

## 完成检查

- [ ] 每个里程碑满足五项标准，AC 分配不重不漏。
- [ ] Local Draft 已计算稳定 `plan_fingerprint`。
- [ ] 人工确认前 Milestone 已幂等写入 Linear 且明确标为不可执行草案。
- [ ] Linear 不可用时已排队，未提前请求可视化确认。
- [ ] Activate 使用与批准记录相同的 fingerprint，未进入 In Progress。
- [ ] 人读内容使用 `output.language`。

## 下一步

Local Draft 交给 `split-issues` 完成全部 Issue 草案；Publish Draft 将 Milestone 与 Issue 一起展示给用户；批准后由 `split-issues` 激活近期 Issues。
