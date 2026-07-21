---
name: prd-brainstorm
description: 生成产品级 PRD。用户明确要独立做产品脑暴或写 PRD 时采用访谈模式；由 pre-development 调用时采用内部综合模式，根据已确认的 Intake 自动判断范围、用户故事与优先级，不重复询问老板。不创建 Linear Milestone / Issue。
---

# PRD Brainstorm（PRD 脑暴）

产出产品视角的 PRD。单个需求事实以 `intake.md` 为准，PRD 可覆盖一个或多个相关需求。

## 两种模式

### 独立访谈模式

仅当用户明确要求先做产品脑暴/PRD 时使用。逐轮确认范围、非目标、用户故事、优先级、业务规则、成功指标和开放问题；一次问一个高价值问题，最后整体确认再写入。

### 开发前内部综合模式

由 `pre-development` 调用。读取已确认的 Intake、已有 PRD 和项目上下文，不重复询问老板：

1. 判断 `existing`、`create` 或 `not_required`；
2. 记录判断理由到 `requirement.planning.prd_reason`；
3. 需要新 PRD 时，从需求基线综合范围、非目标、用户故事、优先级、规则和指标；
4. 无法自主裁决的业务权限问题进入 CTO 汇报的“需要老板决定”，不单独打断；
5. 技术细节留给调研和架构，不写入 PRD。

## 判断原则

以下任一成立，通常需要 PRD：覆盖多个用户旅程或需求、存在版本/优先级取舍、改变产品定位或商业规则、需要跨阶段交付。范围单一且 Intake 已能完整表达时可标记 `not_required`，但必须说明理由。

## 产出

PRD id 使用稳定的全小写 ASCII kebab-case 语义 slug，2–5 个英文单词；扫描 `prd/` 与 `prd/archive/` 查重，冲突追加序号。

```text
.vibeRig/prd/<prd-id>/prd.md            # 独立、可复用的产品级 PRD
.vibeRig/requirements/<req-id>/prd.md  # 仅该需求使用的开发前 PRD 草案
```

PRD 必须包含：背景、目标用户、用户旅程、范围、非目标、业务规则、优先级、成功指标、开放问题。需求通过 `requirement.yaml` 的 `prd` 字段关联独立 PRD。

独立访谈模式可请 `vb-linear` 同步 PRD Document。内部综合模式默认只落本地文件，由 `pre-development` 统一汇报；两种模式都禁止创建 Milestone / Issue。

## 红线

- 内部综合模式重复询问 Intake 已确认的内容。
- 没有记录 PRD 决策与理由。
- PRD 出现接口、表结构、库选择或任务拆分。
- 内部草案在老板审批前造成 Linear 规划副作用。

## 完成检查

- [ ] 模式选择正确，范围、非目标、用户故事、优先级和指标完整。
- [ ] `requirement.planning.prd_decision` 与理由已更新。
- [ ] 需要 PRD 时已写入并建立关联；不需要时理由充分。
- [ ] 没有创建 Milestone / Issue，没有替代架构设计。
