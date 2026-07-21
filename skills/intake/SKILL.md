---
name: intake
description: 新需求唯一需要老板参与的需求访谈入口。当用户提出新功能、业务目标、产品想法、记录需求或 intake 时，以产品经理方式补全需求并确认基线，随后自动进入 pre-development。Bug 和明确的单点小改动不使用本 skill。
---

# Intake（需求接洽）

像企业中的产品经理/项目经理一样，把老板的原始想法收敛成完整需求基线。此处只要求老板确认业务需求，不让老板承担技术调研、架构、测试或任务拆分工作。

## 契约

- 这是新需求开发前流程中唯一默认的人机访谈入口。
- 先检查仓库、文档和已有需求；能从现状确认的事实不要询问老板。
- 产出 `intake.md`、`requirement.yaml`，可同步叙事副本到 Linear Document。
- 老板确认需求基线后，自动进入 `pre-development`，不要求老板逐个调用后续 skills。
- 禁止创建 Linear Milestone / Issue，禁止做技术选型或开始开发。
- 明确 bug 走 `bugger`；一句话可定义且低风险的单点改动走 `record-issue`。

## 访谈方式

逐轮提问，一次只问一个最有信息增益的问题，并附上基于现状的最佳猜测。不要照表机械追问；已明确的内容直接复述确认。

必须收敛以下维度：

| 维度 | 必须得到的结论 |
|---|---|
| 背景与目标 | 为什么现在做、解决什么业务问题、期望结果 |
| 用户与权限 | 谁使用、谁管理、角色差异、数据可见范围 |
| 核心流程 | 入口、主路径、完成信号、异常与恢复路径 |
| 业务规则 | 状态、计算、数量、时限、优先级、边界条件 |
| 范围 | 本期包含、明确非目标、与现有能力的关系 |
| 成功指标 | 可观察且可量化的业务/用户结果 |
| 约束 | 时间、预算、兼容、平台、合规、外部依赖 |
| 风险偏好 | 可接受的降级、迁移、数据和发布风险 |
| 老板验收条件 | 验收人、环境、账号/权限、数据和可视化关注点 |

访谈目标是能准确预测老板对主要场景和边界的判断。含糊词（如“现代化”“好用”“高性能”）必须转成可观察标准。

## 基线确认

访谈完成后，向老板展示一份合并摘要：目标、用户、场景、规则、范围/非目标、约束、成功指标、验收关注点、尚未解决的权限性问题。

只进行一次整体确认：

- 确认后写入文件，`requirement.status` 置为 `requirement_baselined`；
- 未确认则继续修订，不启动任何开发前 subagent；
- 不把访谈原文或内部推理写入文档。

## 产出

读取 `.vibeRig/project.yaml` 的 `docs.root` 与 `output.language`。需求 id 使用稳定的全小写 ASCII kebab-case 语义 slug，2–5 个英文单词；扫描 `requirements/` 与 `requirements/archive/` 查重，冲突追加 `-2`、`-3`，创建后永不改名。

```text
.vibeRig/requirements/<req-id>/
  intake.md
  requirement.yaml
  linear.yaml        # 仅在创建 Linear Document 后存在
```

`requirement.yaml` 使用 [assets/requirement.schema.json](./assets/requirement.schema.json)：

```yaml
version: 1
requirement:
  id: "payment-refactor"
  title: "……"
  status: "requirement_baselined"
  prd: null
  created: "YYYY-MM-DD"
  planning:
    prd_decision: "pending"
    prd_reason: null
    owner_approval: "pending"
    approved_at: null
milestones: []
```

## Linear 操作

如项目已配置 Linear，请 `vb-linear` 把 `intake.md` 同步为挂在容器 Project 下的 Document，并把 documentId 写入 `linear.yaml`。Linear 不可用不阻塞本地开发前流程；记录原因即可。不得创建 Issue / Milestone 或发送规划评论。

## 自动交接

基线确认并写入后，直接调用 `pre-development`：

1. 传递需求 id 与已确认上下文；
2. 告知老板已进入内部开发前评审；
3. 除非遇到权限性阻塞，不再逐阶段要求老板确认；
4. 最终由 CTO 用一份完整审批包向老板汇报。

## 红线

- 询问可以从仓库或已有文档查到的事实。
- 需求未整体确认就写入基线或启动 subagent。
- 把技术方案、任务拆分、测试实现细节塞进需求访谈。
- 在 Intake 中创建 Milestone / Issue。
- 确认后让老板手动选择下一项 skill。

## 完成检查

- [ ] 九个需求维度均已确认或注明不适用理由。
- [ ] 老板已确认合并后的需求基线。
- [ ] `intake.md` 与 `requirement.yaml` 已写入且 schema 有效。
- [ ] 状态为 `requirement_baselined`，PRD 决策为 `pending`。
- [ ] 未创建 Milestone / Issue，未开始开发。
- [ ] 已自动交接 `pre-development`。
