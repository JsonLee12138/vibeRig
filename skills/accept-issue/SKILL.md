---
name: accept-issue
description: 单个切片 issue 的验收（取代 accept-bug 的单点验收）。当用户对某个 issue 说"验收这个 issue"、"issue 验收通过"时使用。仅由用户手动触发，不从 task-runner / agent-sop 自动连带触发。
---

# Accept Issue（issue 级验收）

用本 skill 对**单个切片 issue** 做验收。这是两级验收的下层：issue 级只 commit、只改状态。挂里程碑的 issue，PR 与合入 main 只发生在 `accept-milestone`；不挂里程碑的独立 issue，验收通过后由 `merge-issue` 负责合并，本 skill 自己**永远不碰 PR**。

## 契约

- 范围：一个 issue（及其 sub-issue）。
- **不新开/不操作 PR（PR 由 `task-runner` 在 issue 完成时维护）、不合 PR、不碰 main、不清理 worktree。** 这一条不区分该 issue 是否挂里程碑——本 skill 一律不碰 PR，合并是 `accept-milestone`（挂里程碑）或 `merge-issue`（不挂里程碑）的职责。
- 验收决定必须来自用户当前明确表态；测试通过、proof packet、QA 结论都不算验收。
- 仅由用户手动触发，不从 `task-runner` / `agent-sop` 自动连带触发。

## 验收记录书写规范（强制）

写入 Linear 的验收评论是给人看的，必须写成**可照做的操作步骤**：

- 第一步做什么、第二步做什么，逐步列出；
- 涉及配置：写清在**哪个文件**配置**什么内容**；
- 涉及界面：写清打开**哪个网页/页面**、应该**看到什么**；
- **禁止抽象**："功能正常""验证通过"不允许单独出现，必须跟着具体步骤和看到的结果。

步骤来源：`acceptance.json` 中该 issue 映射的 AC 条目的 `verification` 字段，展开成人话。

## 流程

1. 读 `.vibeRig/project.yaml`（`output.language`、linear 上下文）。
2. 解析入参（issue id/key 或标题），`get_issue` + `list_comments` 读 issue、proof packet、映射的 AC-ids。
3. 定位 AC：从 `requirements/<req-id>/acceptance.json` 取出该 issue 映射的条目。
4. 逐条按 `verification` 验证（跑命令 / 照步骤操作），记录每条的实际结果。
5. 确认用户在当前对话中明确表态验收结论。
6. **通过**：
   - 确认改动已 commit 到对应分支（挂里程碑的 issue 是该里程碑的集成分支 `milestone/<req-id>-<n>`；不挂里程碑的独立 issue 是它自己的分支，PR 已直接面向 main）；
   - `save_comment` 写验收评论（按上方书写规范：每条 AC 的操作步骤 + 实际看到的结果 + commit hash）；
   - `save_issue` 把该 issue **及其全部 sub-issue** 状态改到团队最接近"已验收/Done"的状态（先 `list_issue_statuses` 解析，不发明状态名；逐个 sub-issue 单独 `save_issue`，不遗漏）；
   - 不挂里程碑的独立 issue：告诉用户下一步是 `merge-issue`，由它负责合并这个 issue 自己的 PR；挂里程碑的 issue：告诉用户合并要等 `accept-milestone`。
7. **发现问题**：
   - `save_issue` 创建 `type:acceptance-fix` issue，挂同一 Milestone；描述含问题现象、涉及 AC-id、修复验证方式；
   - 修复在**同一集成分支**上小修（走 `task-runner <fix-issue-id>`），不开新分支新 worktree；
   - 原 issue 状态保持非终态。
8. **insights 复盘（验收通过后）**：触发 `insights` 对该 issue 复盘，结论用 `save_comment` 写入该 issue 评论区（复盘评论是给人看的，也是 vb-learn 的输入）。
9. **vb-learn 自学习**：待第 8 步复盘评论写入后，触发 `vb-learn <issue-key>` 从评论区自学习（复盘评论 + proof packet + 验收评论）；无可泛化经验时由 vb-learn 自行返回 `skipped` 并说明原因。
10. 报告：AC 逐条结果、验收评论链接、状态变更、（如有）acceptance-fix issue、复盘评论链接、vb-learn 结果（沉淀的 skill 或 skipped 原因）。

## 红线

- 从测试通过推断验收 → 验收必须是用户当前明确表态。
- 验收评论写了"验证通过"却没有步骤 → 违反书写规范，重写。
- 在本 skill 发起、更新或合并了 PR → PR 的发起/更新属于 `task-runner`，合并属于 `accept-milestone`。
- 为修复问题开了新分支/新 worktree → acceptance-fix 在同一集成分支小修。
- 验收的其实是整个里程碑 → 走 `accept-milestone`。
- 只改了主 issue 状态、漏了 sub-issue → 状态更新必须覆盖该 issue 及其全部 sub-issue。

## 检查清单

- [ ] 用户当前明确表态了验收结论。
- [ ] 每条映射 AC 按 `verification` 实际验证过，结果已记录。
- [ ] 验收评论符合书写规范（逐步操作 + 看到的结果 + commit hash），无抽象话单独出现。
- [ ] 状态经 `list_issue_statuses` 解析后更新，且覆盖该 issue 及其全部 sub-issue；未新开/操作 PR、未动 main。
- [ ] 发现的问题已建 `type:acceptance-fix` issue 并挂同里程碑。
- [ ] 验收通过后：insights 复盘评论已写入评论区；
- [ ] vb-learn（沉淀或 skipped 有原因）。
- [ ] 人读内容使用 `output.language`。
