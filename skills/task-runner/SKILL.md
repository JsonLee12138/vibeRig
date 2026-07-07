---
name: task-runner
description: 执行 VibeRig 的 Linear 任务。当用户要执行、继续、恢复某个里程碑或 issue 时使用（task-runner <里程碑id 或 issue-id>）。先判定 id 是里程碑还是 issue 再进入对应循环；一个里程碑只有一个 worktree、一个集成分支；每个 issue 执行时才经 subagent-routing 现场选 subagent；issue 完成只 commit 不发 PR；里程碑内全部 issue 完成后把 requirement.yaml 该里程碑置为 pending_acceptance 等待 accept-milestone。
---

# Task Runner（任务执行）

用本 skill 在当前会话中执行 Linear 任务。主 agent 负责编排：解析入参 → 准备 worktree → 逐 issue 现场路由 subagent → 校验 → commit → 状态流转。

## 契约

- 执行范围：一个里程碑（其全部 issue）或单个 issue。
- 不做需求发现（`intake`）、不做拆分（`split-milestones` / `split-issues`）、不做验收（`accept-issue` / `accept-milestone`）、**不发 PR、不合 PR**——PR 只发生在 `accept-milestone`。
- subagent 不碰 Linear、不做最终校验；主 agent 拥有校验、评论、状态流转。

## 参数解析

调用形式：`task-runner <id>`。先判定 id 类型再进入对应循环：

| id 类型 | 判定方式 | 进入 |
|---|---|---|
| 里程碑 id | 匹配 `requirement.yaml` 的 `milestones[].id` / `linear_id`，或 `get_milestone` 命中 | **里程碑循环**：按 `blocks` 拓扑序逐个执行该里程碑全部 issue |
| issue id/key | `get_issue` 命中 | **单 issue 循环**：只执行这一个 issue |

无法判定类型、或 id 同时匹配两者、或标题模糊匹配出多个候选 → 列出候选，停下询问用户。

## 分支与 worktree 纪律（写给小学生的规则）

1. 一个里程碑只有**一个** worktree、**一个**集成分支（`milestone/<req-id>-<n>`）。进入循环后不准再创建新的 worktree 或长期分支。
2. 并发时只能开**临时分支**；临时分支在自循环内部验收通过后，**必须先合并回集成分支并删除**。
3. PR 只有一种：里程碑集成分支 → main（由 `accept-milestone` 发起）。issue 级不发 PR，issue 完成只 commit 到集成分支。

worktree 准备（循环开始前做一次，之后全程复用）：

```bash
git worktree list                                   # 已存在该里程碑的 worktree → 直接复用
git worktree add -b milestone/<req-id>-<n> .worktrees/milestone-<req-id>-<n> <base-ref>
git worktree list                                   # 确认路径已挂载
```

单 issue 循环复用其所属里程碑的 worktree/集成分支；不存在时先按上面的命令创建。worktree 创建失败不准静默退回主工作区——报告失败并停止，除非用户明确授权在主工作区改动。

## 执行流程（每个 issue 重复）

1. **执行时路由**：读取 issue 描述 + 组装好的 spec 后，经 `subagent-routing` **现场选择** subagent——不使用任何建单时的预设。没有合适的 subagent 或路由不可用 → 停止并报告缺口，不准主 agent 静默代做。
2. **Spec 组装**（读 `assets/task-brief-template.md` 填 Task Brief）：
   - issue 描述（目标 + AC-ids + 文档链接）；
   - `architecture.md` 中与本 issue 相关的接口契约（只截相关片段）；
   - `acceptance.json` 中对应 AC 条目（含 `verification`）。
   - agent 只读自己那片 spec，禁止把需求全量文档喂给 subagent。
3. Linear 状态流转到执行态（先 `list_issue_statuses` 解析，不发明状态名）；指派在此时进行。
4. **主 agent 校验**（subagent 的自述不算证据）：
   - 跑该 issue 映射 AC 的验证命令；
   - `gate_policy` 要求的 build/lint/test；
   - 读改动文件、`git diff` 检查无关改动。
   - `agent-sop` 的每任务 QA 保持不变；失败 → 给同一或更强 subagent 发有边界的返工 brief（附失败证据与期望修正）；同族问题反复失败 → 停下问用户。
5. **QA 通过 → commit 到集成分支**：只提交本 issue 范围的改动，提交信息引用 issue key；记录 commit hash。
6. `save_comment` 写 Proof Packet（用 `assets/proof-packet-template.md`：workspace、分支、commit、验证结果、AC 覆盖、残余风险；无 PR 字段——PR 在里程碑验收时才有）；`save_issue` 状态流转到最接近"待验收/In Review"的状态。
7. **防漂移**：每个 issue 开始前检查集成分支是否需要 rebase main（`git fetch` 后比较）；需要则先 rebase 再开工。

## 里程碑收尾

里程碑内全部 issue 完成后：

1. 把 `requirement.yaml` 中该里程碑 `status` 置为 `pending_acceptance`；
2. 告诉用户：全部 issue 已完成并 commit 到集成分支 `milestone/<req-id>-<n>`，等待 `accept-milestone` 做全量回归、PR 与合并。**不要在这里发 PR。**

## 红线

- 循环中途创建了第二个 worktree 或长期分支 → 违反纪律第 1 条，合并回去并删除。
- 临时分支没合回集成分支就往下走 → 违反纪律第 2 条。
- issue 完成后发了 PR → PR 属于 `accept-milestone`，撤销。
- 用了建单时预设的 subagent 而没有现场路由 → 执行时路由是硬规则。
- 把需求全量文档喂给 subagent → 只给 Task Brief + 相关 AC + 相关契约片段。
- subagent 说"通过"就写 Proof Packet → 主 agent 必须亲自跑命令、读输出。
- 从本 skill 把 issue 置为终态（Done/Accepted）→ 终态只属于验收 skill。
- worktree 创建失败静默退回主工作区 → 报告并停止。

## 检查清单

- [ ] id 类型判定正确；模糊时问过用户。
- [ ] 全程只有一个 worktree、一个集成分支；临时分支已全部合回并删除。
- [ ] 每个 issue 都经 `subagent-routing` 现场路由。
- [ ] 主 agent 独立跑了验证命令并读了输出。
- [ ] 每个 issue 的 commit 只含本 issue 范围改动，信息引用 issue key。
- [ ] Proof Packet 已写；状态未置终态；未发任何 PR。
- [ ] 里程碑收尾：requirement.yaml 已置 `pending_acceptance`。
- [ ] 人读内容使用 `output.language`。

## 最终报告

- 执行范围（里程碑/issue）与 worktree 路径、集成分支名
- 每个 issue：所选 subagent、改动文件、验证结果、commit hash
- 阻塞项（如有）及需要用户决定的事项
- 下一步：`accept-issue`（单点验收）或 `accept-milestone`（里程碑验收）
