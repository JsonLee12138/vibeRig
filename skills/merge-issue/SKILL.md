---
name: merge-issue
description: 合并一个不挂在任何里程碑下的独立 issue 自己的 PR 到 main。当某个 issue 没有里程碑归属、由 task-runner 直接开出面向 main 的 PR、且 accept-issue 已经验收通过后使用。挂在里程碑下的 issue 不适用——那些 PR 只能在 accept-milestone 里合并。
---

# Merge Issue（单 issue PR 合并）

用本 skill 专门处理"没有里程碑、只有单个 issue 自己面向 main 的 PR"这一种情况的合并动作。存在这个 skill 的唯一目的：把"这个 issue 现在能不能合"这个判断收敛到一个专门、狭窄的地方，不让 `task-runner` / `accept-issue` 里掺杂这层判断逻辑——避免归属判断错了导致提前合并或漏合并。

## 契约

- 范围：一个 issue 自己的、直接面向 main 的 PR。
- 前置：`accept-issue` 已经对这个 issue 验收通过。
- **强制前置检查（红线级）**：这个 issue 不属于任何里程碑。检查 main 分支工作区的 `requirement.yaml` 里所有 `milestones[].issues`（或 Linear 上该 issue 的 Milestone 字段）——只要命中任何一个里程碑，立即拒绝执行，告诉用户改走 `accept-milestone`。判断不出归属（比如既查不到 requirement.yaml 也查不到 Linear milestone 字段）时，同样拒绝并停下问用户，不允许自行判定为"没有里程碑"。
- 不重跑 AC/TC、不改验收结论、不新建 PR——这些由 `accept-issue` 的证据审核和人工结论负责。
- 只做：归属检查 → 可合并性检查 → 合并 → 本地/远程同步 → 记录。

## 流程

1. 解析入参（issue id/key）。
2. **归属检查**：读 main 分支工作区的 `requirement.yaml`（含 `archive/`）与 Linear 该 issue 的 Milestone 字段，确认它不挂在任何里程碑下。
   - 命中里程碑 → 停止，告诉用户这个 issue 属于里程碑 `<milestone-id>`，改走 `accept-milestone`。
   - 无法判定（数据缺失/矛盾）→ 停止并报告，问用户确认归属，不自行假定。
3. **验收检查**：读该 issue 的 Linear 评论，确认 `accept-issue` 已经给出验收通过的记录。没有 → 停止，告诉用户先走 `accept-issue`。
4. **PR 与证据检查**：定位该 issue 自己的、面向 main 的 PR；确认验收记录、Proof Packet 和 Required CI 都对应 PR 当前 commit；`git fetch origin` 拉最新 main，检查该 PR 是否 mergeable：
   - 有冲突 → 和用户逐处确认取舍（这处冲突涉及哪些改动、双方各自想干什么、取舍影响什么）后再处理，不自作主张解决。
   - CI 未过、必需审批未齐全 → 停止并报告，不合并。
5. 合并该 PR 到 main。
6. **同步**：合并后把本地 main 分支与远程 main 同步一致（`git fetch` + `git pull` 或等效操作），确认本地内容和远程一致。
7. 请 `vb-linear` 在该 issue 下记录合并结果（PR 链接、合并 commit hash）。
8. 报告：PR 链接、合并 commit hash、是否遇到冲突及如何解决、本地/远程同步结果。

## 红线

- 该 issue 挂在某个里程碑下却在本 skill 合并了 → 里程碑内的 issue 只能在 `accept-milestone` 合并，本 skill 必须先拒绝。
- 归属判断不出来却自行当作"没有里程碑"处理 → 必须停下问用户，不允许猜测。
- `accept-issue` 还没验收通过就合并 → 验收通过是合并的前提，没有就停止。
- 有冲突时自作主张解决，没有和用户逐处确认取舍 → 必须先确认。
- 在本 skill 里重新做了 AC 验证或改了验收结论 → 那是 `accept-issue` 的职责，不要重复。
- Proof Packet、验收记录或 CI 对应旧 commit 却仍合并 → 证据必须与 PR 当前 commit 一致。
- 合并后没有把本地 main 和远程同步 → 必须同步，避免后续操作基于过期的本地状态。

## 检查清单

- [ ] 已确认该 issue 不属于任何里程碑（检查过 requirement.yaml 与 Linear milestone 字段）。
- [ ] 已确认 `accept-issue` 验收通过记录存在。
- [ ] Proof Packet、验收记录和 Required CI 均对应 PR 当前 commit。
- [ ] 已 `git fetch` 拉最新 main，确认无冲突（或冲突已与用户确认取舍后解决）、CI 通过、审批齐全。
- [ ] PR 已合并；本地 main 与远程已同步一致。
- [ ] 合并结果（PR 链接、commit hash）已写入 Linear 评论。
