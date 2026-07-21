---
name: accept-milestone
description: 对完整里程碑执行证据汇总、增量回归、E2E、老板 UAT、PR 审核与最终合并。当用户要求“验收里程碑”“验收通过并合并”时使用；普通 Issue 不要求预先逐个人工验收。
---

# Accept Milestone（里程碑验收）

## 契约

- 范围是一个 `pending_acceptance` 里程碑及其全部 Issue、sub-issue 和常驻集成 PR。
- 普通 Issue 只需具备 `task-runner` 的有效技术 Evidence；standalone 不适用。
- 用户触发“开始验收”只授权检查；只有当前对话中明确批准才允许合并和写终态。
- 不做新功能开发、不新建 PR。缺陷走“缺陷回流”。
- `requirement.yaml` 只在 main 分支工作区读写。

## 证据与回归边界

- 汇总每个 Issue 的 Proof Packet、AC/TC 覆盖、Review、PR CI 和残余风险。
- 相同 commit、要求环境和测试定义的成功 Unit/Integration/Contract Evidence 直接复用。
- 只执行 `executionStage: milestone` 的 TC、跨 Issue E2E、里程碑回归集合、失效 Required Gate 和老板 UAT。
- 不把“全量回归”解释为人工重跑每个 Issue 的全部单元测试。
- 旧需求没有 TC 时按里程碑 AC 进入 `legacy mode`，仍避免重复执行同一有效命令。

## 验收评论

评论按 `acceptance-guide.md` / `ownerVerification` 展开：前置配置、命令/服务、入口、顺序操作、精确数据、页面/图表状态、失败信号、证据和清理。禁止抽象结论。

## 流程（严格按顺序）

1. **前置**：读 main 工作区 `requirement.yaml`，确认 Milestone、`pending_acceptance`、所属需求/PRD、是否最后一个里程碑；定位 `task-runner` 已维护的集成分支 → main PR。
2. **Issue Evidence 审核**：枚举全部 Issue/sub-issue，核对当前集成 commit 上 Required TC、Gate 和 Review；普通 Issue 不要求已有 `accept-issue` 评论。缺失、失败或未批准风险阻塞验收。
3. **同步最新 main**：`git fetch` 后将最新远程 main rebase/merge 到集成分支。冲突必须逐处说明双方意图和影响并与用户确认；不得自行取舍。产生新 commit 时 push 更新原 PR，并使相关 Evidence 失效。
4. **当前 commit CI**：等待/读取 Required Checks；只接受与同步后 commit 一致的结果。失败时停止并回流。
5. **里程碑验证**：执行里程碑 TC、跨 Issue E2E、增量回归、失效 Gate 和 `gate_policy.manual_checks`；逐条记录环境、执行者、命令/步骤、结果和证据。
6. **老板 UAT**：按验收指南完成配置、启动、操作、数据和可视化检查；记录失败信号、证据、清理和残余风险。
7. **批准门禁**：汇报 TC/Gate/CI/UAT 与风险。用户已明确“通过并合并”时继续；否则等待明确批准、拒绝或条件性结论。
8. **合并 PR**：确认目标为 main、CI、冲突、必需审批和批准范围均满足；更新 PR 正文（Issue、AC/TC、回归/UAT Evidence、残余风险）后合并，本地 main 同步远程。
9. **状态与记录**：请 `vb-linear` 把全部 Issue/sub-issue 更新为团队最接近 Done 的状态，写可复现的 Milestone 验收评论和 Project Update；在 main 工作区把 Milestone 置 `accepted`。
10. **复盘与归档**：依次执行 `insights`、`vb-learn <milestone-id>`；最后一个 Milestone 时归档需求并做需求级复盘/学习，关联 PRD 仅在全部需求 accepted 后归档。
11. **发布验证**：若本流程包含部署，执行 `post_release` Smoke，并按风险检查日志、指标、告警与回滚；未部署则记录为发布交接项，不伪造 PASS。
12. **清理**：仅在 PR 已合入、分支无未推送 commit、worktree 干净时移除 worktree；否则保留并报告。

## 缺陷回流

失败必须关联 AC-ID/TC-ID、当前 commit、环境和证据。产品缺口回到定向需求评审；实现缺陷走 `bugger`/修复 Issue 并挂当前 Milestone；环境或 CI 故障标明阻塞源。只重跑失败 TC、直接依赖 TC 和失效 Gate。

## 红线

- 在同步最新 main 前完成最终回归并直接复用旧 commit 证据。
- 无条件重跑全部 Issue 的 Unit/Integration 测试。
- 普通 Issue 因未走 `accept-issue` 而被拒绝，即使技术 Evidence 完整有效。
- 用户只说“开始验收”就推断批准并合并。
- Required TC、CI、UAT 或审批未通过却合并。
- 自行解决有实质取舍的冲突；或在本 skill 新建 PR。
- 未部署却把发布 Smoke 标 PASS。

## 完成检查

- [ ] 前置状态、PR、全部 Issue Evidence 与当前 commit 已核对。
- [ ] 最新 main 已同步；相关 CI、里程碑 TC、E2E、增量回归和 UAT 通过。
- [ ] 用户明确批准后才合并并写终态。
- [ ] 验收评论可复现；全部 Issue/sub-issue、Project Update 和 requirement 状态已更新。
- [ ] 复盘、自学习、归档、发布交接和 worktree 清理均有结果。
- [ ] 人读内容使用 `output.language`。
