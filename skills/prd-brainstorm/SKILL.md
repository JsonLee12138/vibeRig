---
name: prd-brainstorm
description: PRD 脑暴（访谈式）。当用户要写 PRD、做产品级规划、或一个中大型需求需要产品视角的范围/用户故事/优先级定义时使用。不创建任何 Linear Milestone / Issue，不负责 PRD 归档。
---

# PRD Brainstorm（PRD 脑暴）

用本 skill 产出一份产品级 PRD。PRD 是产品视角的文档，可以覆盖多个需求；单个需求的记录走 `intake`。

## 契约

- 只产出 `prd.md` 并同步 Linear Document。
- **禁止**创建任何 Linear Milestone / Issue。
- **不负责归档** —— PRD 的归档由 `accept-milestone` 在其名下需求全部验收后触发。
- 不在 PRD 里写技术方案（走 `tech-research` / `architecture-design`）。

## 访谈规则（先问清确认，后写入）

以产品经理对接客户的方式**逐项访谈**，一次一个问题，附最佳猜测，确认一项再问下一项。必须逐项问清并获得用户确认：

1. **范围（Scope）**：这个 PRD 覆盖哪些能力？拆到用户可感知的粒度。
2. **非目标（Non-goals）**：明确不做什么、这一期不做什么。
3. **用户故事（User Stories）**：作为〈谁〉，我想〈做什么〉，以便〈得到什么〉；逐条与用户确认。
4. **优先级（Priority）**：P0/P1/P2 分层，P0 是"没有它这个 PRD 就不成立"的部分。

全部确认完毕才写入文件。不把访谈过程写进 PRD，只写收敛结论。

## 产出

PRD id 用 `prd-NNNN` 递增（扫描 `prd/` 与 `prd/archive/` 取最大号 +1）。

```text
.vibeRig/prd/<prd-id>/
  prd.md    # 背景 / 范围 / 非目标 / 用户故事 / 优先级 / 成功指标 / 开放问题
```

需求与 PRD 的关联**不记在 PRD 侧**：由各需求的 `requirement.yaml` 的 `prd` 字段指向本 PRD。若访谈中已明确本 PRD 覆盖某些已有需求，提醒用户（或代为）更新对应 `requirement.yaml` 的 `prd` 字段。

## Linear 操作

- `save_document`：PRD 同步副本 → Linear Document（挂容器 Project），标题用 `output.language`。
- **不建 issue、不建 milestone。**

## 红线

- 未逐项确认就写入 PRD → 回到访谈；确认是写入的前置门禁。
- 在本 skill 内做归档、或写入归档逻辑 → 归档属于 `accept-milestone`。
- PRD 里出现接口设计、表结构、技术选型 → 移出，指向 `tech-research` / `architecture-design`。
- 创建了任何 Milestone / Issue → 违反探索阶段禁令。

## 检查清单

- [ ] 范围、非目标、用户故事、优先级四项均经用户逐项确认。
- [ ] `prd.md` 已写入，id 不冲突。
- [ ] 相关需求的 `requirement.yaml` `prd` 字段已更新或已提醒用户。
- [ ] Linear Document 同步副本已创建。
- [ ] 没有创建任何 Milestone / Issue；没有做归档。
- [ ] 人读内容使用 `output.language`。

## 下一步

PRD 覆盖的每个需求各自走 `intake`（若尚未记录）→ `define-acceptance` → `split-milestones`。
