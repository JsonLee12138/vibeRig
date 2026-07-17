---
name: accept-milestone
description: 里程碑验收（取代 accept）。当用户对某个里程碑说"验收里程碑"、"验收通过"、"合并"时使用。验收决定必须来自用户当前明确表态。
---

# Accept Milestone（里程碑验收）

用本 skill 对**整个里程碑**做最终验收。这是两级验收的上层，负责审核并**合并** `task-runner` 在各 issue 完成过程中已发起并持续更新的集成分支 → main PR；本 skill 不新建 PR。

## 契约

- 范围：一个里程碑（其下全部 issue 已完成并经 `accept-issue` 或等价验证）。
- 验收决定必须来自用户当前明确表态。
- 前置：`requirement.yaml`（main 分支工作区，不是里程碑 worktree 里的副本）中该里程碑 `status: pending_acceptance`；不是则停止并说明差什么（还有 issue 未完成 → `task-runner`；未拆分 → `split-issues`）。
- 本 skill 不做新的开发工作；发现缺陷走 §缺陷回流。
- `requirement.yaml` 的所有读写都在 **main 分支工作区**进行，不在里程碑 worktree 里改。

## 验收记录书写规范（强制）

与 `accept-issue` 相同：写入 Linear 的验收评论必须是**可照做的操作步骤**——第一步做什么、第二步做什么；在哪个文件配置什么；打开哪个网页看到什么。**禁止**"功能正常""验证通过"这类抽象话单独出现。步骤来源：该里程碑全部 AC 的 `verification` 字段展开成人话。

## 流程（严格按顺序）

1. **前置确认**：读 **main 分支工作区**的 `requirement.yaml`，确认目标里程碑存在、状态为 `pending_acceptance`、知道它属于哪个需求/PRD、是不是该需求最后一个里程碑。
2. **全量回归**：按 `project.yaml` `gate_policy` 跑全部 required commands / manual checks；再逐条验证该里程碑的 AC（按 `verification`）。任何一项失败 → 停止，走缺陷回流，不进入合并。
3. **拉取最新 main**：`git fetch` 后把最新远程 main rebase/merge 到集成分支——**不基于最新 main 的 PR 不算 PR**。若产生新 commit，push 更新到 `task-runner` 已发起的那个 PR 分支。
4. **冲突处理**：
   - 无冲突 → 直接继续；
   - 有冲突 → 先逐处分析：这处冲突涉及哪些改动、双方各自想干什么、取舍会影响什么；**与用户确认取舍后**再解决合并。不自作主张。
5. **合并 PR**：集成分支（`milestone/<req-id>-<n>`）→ main 的 PR 已由 `task-runner` 在各 issue 完成过程中发起并持续更新，**本 skill 不新建 PR**。核对该 PR 存在且目标分支正确；补全/更新 PR 正文（里程碑标题、issue 清单、AC 覆盖、本次全量回归证据、残余风险）；确认 CI 通过、无冲突、必需审批齐全后合并该 PR。任一不满足 → 记录阻塞并停止，不置任何终态；若该 PR 不存在，停止并报告，退回 `task-runner` 补发起。本地main分支合并远程main代码。
6. **issue 状态兜底核对**：请 `vb-linear`（见该 skill 的能力映射与规则）枚举该里程碑下全部 issue（含 sub-issue），逐个确认状态已是 Done；若有遗漏（如漏走 `accept-issue` 或验收后被改动），请 `vb-linear` 补齐（先解析团队工作流状态，不发明状态名）。
7. **Linear 记录**（请 `vb-linear` 执行）：
   - Milestone 验收评论（按书写规范：逐步操作说明 + 每步看到的结果 + PR 链接 + commit）；
   - 写 Project Update（该里程碑完成、整体进度）。
8. **更新 requirement.yaml**：在 **main 分支工作区**把该里程碑 `status` 置为 `accepted`。
9. **insights 复盘**：触发 `insights` 对该里程碑复盘（聚合其名下全部 issue 的证据），结论请 `vb-linear` 写入 Linear 评论区（紧随验收评论）。
10. **vb-learn 自学习**：待第 9 步复盘评论写入后，触发 `vb-learn <里程碑id>` 从评论区自学习（复盘评论 + 各 issue 的 proof packet + 验收评论）；无可泛化经验时由 vb-learn 自行返回 `skipped`。
11. **归档判定**：
    - 若这是该需求**最后一个**里程碑：需求 `status: accepted`（main 分支工作区），目录迁入 `requirements/archive/<req-id>/`，并做需求级复盘汇总（insights 汇总各里程碑复盘 → 写入 Linear；`vb-learn <req-id>` 做需求级自学习）；
    - 若该需求关联 PRD：扫描所有 `requirement.yaml`（main 分支工作区，含 `archive/`），该 PRD 名下需求**全部** accepted 时把 PRD 目录迁入 `prd/archive/`；有任何一个未 accepted 则不动。
12. **清理 worktree**：确认集成分支已合入且无未推送 commit（`git log origin/<branch>..<branch>` 为空）、工作区干净（`git status --short` 为空）后 `git worktree remove`；两项检查任一不过 → 不删，报告原因。
13. 报告：回归结果、PR 链接与合并结果、issue 状态核对结果、Linear 记录、requirement.yaml 变更、复盘评论链接、vb-learn 结果、归档结果、清理结果。

## 缺陷回流

验收中发现的 bug 走 `bugger`（独立流程：归因分析 → triage）：影响当前在途里程碑 → 挂该里程碑；否则 → 容器 Project backlog。

## 红线

- 里程碑状态不是 `pending_acceptance` 就开始验收 → 前置不满足，停止。
- 没拉最新远程 main 就合并 PR → 第 3 步是强制的。
- 有冲突却没跟用户确认取舍就解决了 → 撤回，逐处分析后与用户确认。
- 回归没过就合并 → 任何回归失败都阻塞合并。
- 在本 skill 新建了 PR → PR 由 `task-runner` 在各 issue 完成过程中发起并持续更新，本 skill 只同步、审核、合并。
- 在里程碑 worktree 里改了 `requirement.yaml` → 必须在 main 分支工作区改。
- 验收评论是抽象话 → 违反书写规范，重写成逐步操作说明。
- PRD 名下还有未 accepted 的需求却归档了 PRD → 扫描必须覆盖 `requirements/` 与 `archive/` 全部 requirement.yaml。
- 未验证推送/干净状态就删 worktree → 两项检查缺一不可。
- 合并 PR 前没核对该里程碑下全部 issue（含 sub-issue）状态 → 第 6 步是强制的兜底，不能假设 `accept-issue` 一定已正确回写。

## 检查清单

- [ ] 前置：main 分支工作区 requirement.yaml 的 `pending_acceptance` 确认；用户明确表态验收。
- [ ] 全量回归 + AC 逐条验证通过。
- [ ] 基于最新远程 main；冲突处理经用户确认。
- [ ] 合并的是 `task-runner` 已发起的 PR，本 skill 未新建 PR。
- [ ] PR 合并成功后才写终态；main 分支工作区 requirement.yaml 该里程碑置 `accepted`。
- [ ] 该里程碑下全部 issue（含 sub-issue）状态已核对为 Done，遗漏已补齐。
- [ ] 验收评论符合书写规范；Project Update 已写。
- [ ] insights 复盘评论已写入评论区。
- [ ] vb-learn （沉淀或 skipped 有原因）。
- [ ] 归档判定正确执行（需求 / PRD / 需求级复盘汇总，均在 main 分支工作区）。
- [ ] worktree 清理前通过两项检查。
- [ ] 人读内容使用 `output.language`。
