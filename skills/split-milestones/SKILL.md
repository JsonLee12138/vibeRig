---
name: split-milestones
description: 里程碑拆分——第一个写 Linear 结构的 skill。当用户要拆里程碑、把需求拆成 Milestone、或 define-acceptance 完成后进入交付轨时使用。前置门禁：acceptance.json 必须存在。
---

# Split Milestones（里程碑拆分）

用本 skill 把一个需求切成若干 Linear Milestone。**这是探索轨到交付轨的分界：第一个写 Linear 结构的 skill。**

## 前置门禁（DoR）

- `requirements/<req-id>/acceptance.json` 必须存在且通过 schema 校验——没有验收标准不拆分，停止并引导走 `define-acceptance`。
- 跨模块需求：`architecture.md` 必须存在——模块依赖图直接决定里程碑边界，缺失则停止并引导走 `architecture-design`。

## 契约

- 创建 Linear Milestone（挂容器 Project）、回填 `requirement.yaml`、更新 `linear.yaml`。
- 只切里程碑，**不拆 issue**（issue 走 `split-issues`，按里程碑滚动拆）。
- 不指派任何人/subagent。

## 里程碑标准（大厂四条，缺一不可）

每个候选里程碑必须同时满足：

1. **完成后用户能做一件之前做不了的事**（能写出"用户从此可以…"）；
2. **有独立的验收标准**：分到了自己的 AC-ids；
3. **值得向外汇报进度**；
4. **通常包含 ≥3 个任务**——预估不足 3 个任务时：与相邻里程碑合并；若整个需求都撑不起一个里程碑，判定该需求无需里程碑，停止并引导走 `record-issue`。

## 流程

1. 读 `requirement.yaml`、`acceptance.json`、`architecture.md`（存在时）、`.vibeRig/project.yaml`（linear 上下文与 `output.language`）。
2. 依据模块依赖图切里程碑：模块边界 = 里程碑边界；模块依赖顺序 = 里程碑先后顺序。单模块小需求可以只有一个里程碑。
3. 把 `acceptance.json` 的 AC-ids 分配到各里程碑：每条 AC 恰好归属一个里程碑，不遗漏、不重复；回填每条 AC 的 `milestone` 字段。
4. 对每个候选里程碑逐条核对四条标准，不满足则合并或降级。
5. 向用户展示拆分方案（里程碑列表 + 各自 AC-ids + 顺序理由），确认后再写 Linear。
6. Linear 写入（用共享 `linear` skill 的规则）：
   - 先 `list_milestones` 查重，已存在同名/同需求的先复用或更新；
   - `save_milestone` 创建，挂 `project.yaml` `linear.project_id`；
   - Milestone 描述只放三样：Linear Document 链接 + 本地契约路径（`.vibeRig/requirements/<req-id>/`）+ 该里程碑的 AC-id 清单。**不粘贴文档全文。**
7. 回填本地文件：
   - `requirement.yaml`：`milestones` 列表（每项：`id` / `linear_id` / `title` / `module` / `ac_ids` / `status: not_started`），需求 `status` 置为 `planned`；
   - `linear.yaml`：milestoneIds。
8. `save_comment` 或 Document 评论区写一条计划同步摘要（里程碑清单 + AC 覆盖）。

## 红线

- acceptance.json 不存在就开拆 → DoR 门禁，停止。
- 未查重就 `save_milestone` → 重复里程碑污染 Project，先查后建。
- 某条 AC 没有归属里程碑、或归属了两个 → AC 分配必须是不重不漏的划分。
- Milestone 描述里粘贴了 intake/PRD 全文 → 只放链接、路径、AC-ids。
- 拆出了"不满足四条标准"的里程碑（如纯技术脚手架里程碑）→ 合并或降级走 `record-issue`。
- 未经用户确认拆分方案就写入 Linear → 先展示后写入。
- 顺手把 issue 也拆了 → issue 拆分是 `split-issues` 的职责，且要滚动拆。

## 检查清单

- [ ] DoR 门禁通过（acceptance.json 存在且校验通过）。
- [ ] 每个里程碑满足四条标准。
- [ ] AC-ids 对里程碑不重不漏；acceptance.json 的 `milestone` 字段已回填。
- [ ] 查重后才创建；Milestone 描述只含链接/路径/AC-ids。
- [ ] `requirement.yaml` milestones 列表已回填（初始 `not_started`），需求状态置 `planned`；`linear.yaml` 已更新。
- [ ] 人读内容使用 `output.language`。

## 下一步

`split-issues`——只拆第一个（下一个待做的）里程碑，后续里程碑到跟前再拆（Rolling Wave）。
