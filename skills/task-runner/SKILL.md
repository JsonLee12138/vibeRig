---
name: task-runner
description: 执行 VibeRig 的 Linear 任务（里程碑或单个 issue）。仅在用户手动输入 `task-runner <里程碑id 或 issue-id>` 时触发；任何其他 skill 都不许在自己的流程里自动串联调用它。
---

# Task Runner（任务执行）

用本 skill 在当前会话中执行 Linear 任务。主 agent 负责编排：解析入参 → 判定分支拓扑 → 准备 worktree → 逐 issue 现场路由 subagent → 校验 → commit → PR → 状态流转。

## 契约

- **只允许用户手动触发**。任何 skill（`agent-sop`、`accept-issue`、`bugger` 等）都只能在报告里"告诉用户下一步该跑 task-runner"，不允许在自己的执行流程里自动调用 task-runner。
- 执行范围：一个里程碑（其全部 issue）或单个 issue。
- 不做需求发现（`intake`）、不做拆分（`split-milestones` / `split-issues`）、不做验收（`accept-issue` / `accept-milestone` / `merge-issue`）。
- worktree 粒度默认是**每次调用**，不是每个 issue：一次调用要处理的所有 issue 都在同一个 worktree 里依次完成，避免不必要地攒 worktree。只有被**并发**派发执行的 issue 才需要各自的一次性 worktree（详见"分支与 worktree 纪律"）。
- 每个 issue 完成都以提交 PR 收尾，不允许裸 push 了事。PR 走三条路径之一（见"分支与 worktree 纪律"）：
  1. 里程碑内并发派发执行的 issue → PR 目标是里程碑集成分支，由 task-runner 自己在内部循环里合并；
  2. 里程碑内顺序执行的 issue → 直接在共享 worktree 里 commit 到集成分支，持续更新同一个"集成分支 → main"的常驻 PR，只由 `accept-milestone` 合并；
  3. 不挂任何里程碑的独立 issue → PR 直接目标 main，不合并，等 `accept-issue` 验收通过后由 `merge-issue` 合并。
- `requirement.yaml` 的读写在 **main 分支工作区**进行，不在里程碑 worktree 里改（worktree 里的副本不是 main，改了也不生效）。
- subagent 不碰 Linear、不碰 PR、不做最终校验；主 agent 拥有校验、评论、状态流转、PR 维护。

## 参数解析

调用形式：`task-runner <id>`。先判定 id 类型再进入对应循环：

| id 类型 | 判定方式 | 进入 |
|---|---|---|
| 里程碑 id | 匹配 `requirement.yaml` 的 `milestones[].id` / `linear_id`，或 `get_milestone` 命中 | **里程碑循环**：按 `blocks` 拓扑序逐个执行该里程碑全部 issue |
| issue id/key | `get_issue` 命中 | **单 issue 循环**：只执行这一个 issue |

无法判定类型、或 id 同时匹配两者、或标题模糊匹配出多个候选 → 列出候选，停下询问用户。

**单 issue 循环额外要做一次里程碑归属判定**：读 main 分支工作区的 `requirement.yaml`（含 `archive/`）与 Linear 该 issue 的 Milestone 字段。命中某个里程碑 → 按"里程碑内顺序执行"路径处理（复用/新建该里程碑的集成分支）；查不到任何里程碑归属 → 按"独立 issue（standalone）"路径处理（直接面向 main）。判定不出来（数据缺失/矛盾）→ 停下问用户，不允许自行假定。

## 分支与 worktree 纪律

1. 一个里程碑只有**一个**持久的集成分支（`milestone/<req-id>-<n>`，`<n>` 取 `requirement.yaml` 中该里程碑在 `milestones[].id` 的编号，不是自增序号或时间戳）。集成分支是唯一的落地终点，可以推到远程长期存在。不挂里程碑的独立 issue 没有集成分支，直接以 main 为基准。
2. **worktree 粒度默认是每次调用，不是每个 issue**：本次 task-runner 调用一开始只新建**一个** worktree（基准见下），这次调用要处理的全部 issue（不管一个还是一整个里程碑的顺序循环）都直接在这同一个 worktree 里依次完成——不需要每处理一个 issue 就新建/删除一次。这个共享 worktree 在调用结束后**保留**，不清理（留给后续验收/返工复用）。
3. **只有并发路径例外**：被并发派发执行的 issue（多个 issue 同时开工，共享同一个工作目录会互相踩踏），每个各自新建一次性 worktree，跑完立即删除——这是唯一需要"每个 issue 一个 worktree"的情况。
4. worktree 创建失败不准静默退回主工作区——报告失败并停止，除非用户明确授权在主工作区改动。
5. **三条路径**（哪条适用，取决于"参数解析"里判定出的归属，以及这个 issue 是否被并发派发执行）：

   **a. 里程碑内、并发派发执行**（例外情况，多个 issue 同时开工，有互相踩踏风险）：
   - 每个 issue 各自新建一次性 worktree，建在集成分支当前 tip 上，checkout 一条专属临时分支；
   - issue 完成后 push 这条临时分支到远程，开一个目标为**集成分支**的 PR；
   - 由 task-runner 主 agent 在自己的内部循环里、确认这个 issue 的 QA 已通过后**立即合并**这个 PR 进集成分支——因为是同一个主 agent 在同一次调用里操作，冲突概率低，遇到单纯的、无歧义的合并（如互不重叠的新增文件）可以自行解决；遇到有实质取舍、不确定该保留谁的冲突，停下问用户，不自作主张；
   - 合并后 `git fetch` + 同步集成分支的本地与远程，确保一致，清理这个 issue 专属的临时 worktree/分支，再继续下一个并发 issue。

   **b. 里程碑内、顺序执行**（默认情况，一个 issue 处理完再处理下一个，没有并发整合风险）：
   - 本次调用共享的那一个 worktree 直接 checkout 集成分支本身（不再额外建临时分支这一层）；
   - 每个 issue 完成后**直接在这个 worktree 里 commit 到集成分支**、push；
   - 同时维护同一个"集成分支 → main"的常驻 PR：不存在则发起，已存在则更新正文——这个 PR 全程只有一个，累积所有 issue 的 commit，**不合并**，合并只属于 `accept-milestone`。

   **c. 不挂任何里程碑的独立 issue（standalone）**：
   - 本次调用（只有这一个 issue）的共享 worktree checkout 一条 `issue/<issue-key>` 分支，建在 main 当前 tip 上（没有集成分支这一层）；
   - issue 完成后 push 这条分支到远程，开一个目标直接是 **main** 的 PR；
   - **不合并**——等 `accept-issue` 验收通过后，交给 `merge-issue` 合并。

worktree 准备（**本次调用开始时只做一次**，路径 a 里每个并发 issue 各自再做一次；不检查是否已有旧的可复用；`<base>` 按路径取值：a/b 是该里程碑集成分支，不存在则先从 base-ref 建；c 是 main）：

```bash
git fetch origin
# 里程碑路径（a/b）：集成分支不存在则先建（不进 worktree）
git rev-parse --verify milestone/<req-id>-<n> 2>/dev/null \
  || git branch milestone/<req-id>-<n> <base-ref>
# b：调用级共享 worktree，直接 checkout 集成分支
git worktree add .worktrees/<req-id>-<n> milestone/<req-id>-<n>
# a：并发 issue 各自的一次性 worktree + 专属临时分支
git worktree add -b tmp/<req-id>-<n>-<issue-key-or-slug> .worktrees/<req-id>-<n>-<issue-key-or-slug> milestone/<req-id>-<n>
# c：standalone，调用级共享 worktree（本次调用只有这一个 issue），checkout 专属分支
git worktree add -b issue/<issue-key> .worktrees/<issue-key> main
```

收尾：
- 路径 b/c：共享 worktree **不清理**，调用结束后保留（留给后续验收/返工复用）；
- 路径 a：**每个并发 issue 各自完成、合并进集成分支后立即清理**它自己的临时 worktree/分支：
  ```bash
  git worktree remove .worktrees/<req-id>-<n>-<issue-key-or-slug>
  git branch -d tmp/<req-id>-<n>-<issue-key-or-slug>
  ```

## 执行流程（每个 issue 重复）

1. **vb-wiki 定向查询（读完 issue 后、路由前，恰好 1 次）**：读完 issue 描述后，用其标题/关键词对 `vb-wiki` qmd collection 做**恰好一次**定向查询——`npx -y @tobilu/qmd vsearch "<issue 标题/关键词>" -c vb-wiki`，或在支持 MCP 的会话里改用 `qmd` MCP 的 `query` 工具做等价的结构化查询，两者二选一，不强制固定用哪个。
   - **0 命中**（含 `~/.vb-wiki` 不存在、collection 未注册、查询报错等一切非命中情形，一律当 0 命中处理）：不注入任何内容、不向用户提及、不报错，直接进入下一步，就当这一步没发生过。
   - **≥1 命中**（超过合理相关度阈值）：把命中的页面路径和结论记下来，在本 issue 后续的输出/推理里**实际引用**它（点出路径和/或引用其结论），当它与本 issue 的方案相关时——不是只在内部默记一下。
   - 每个 issue 起手只查这一次，**不是**每轮/每次工具调用都查一次；查完就不再重复触发，无论后续该 issue 还要经过多少轮 subagent 往返。
   - qmd MCP 未配置/不可达，或 `~/.vb-wiki` 不存在 → 视为 0 命中的一种，本步骤是 no-op，绝不阻塞或中断本 skill 的执行流程。
2. **执行时路由**：读取 issue 描述 + 组装好的 spec 后，经 `subagent-routing` **现场选择** subagent——不使用任何建单时的预设。没有合适的 subagent 或路由不可用 → 停止并报告缺口，不准主 agent 静默代做。
3. **Spec 组装**（读 `assets/task-brief-template.md` 填 Task Brief）：
   - issue 描述（目标 + AC-ids + 文档链接）；
   - `architecture.md` 中与本 issue 相关的接口契约（只截相关片段）；
   - `acceptance.json` 中对应 AC 条目（含 `verification`）；
   - 若步骤 1 命中了 vb-wiki 旧沉淀，把命中页面的路径/结论也一并写进 Task Brief，供 subagent 参考。
   - agent 只读自己那片 spec，禁止把需求全量文档喂给 subagent。
4. Linear 状态流转到执行态（先 `list_issue_statuses` 解析，不发明状态名）；同时把 assignee 设为当前执行 task-runner 所用的 Linear 身份（运行所用的 API/Bot 账号）。取不到这个身份或未配置 → 跳过指派，在最终报告里说明，不允许臆造一个 assignee。
5. **主 agent 校验**（subagent 的自述不算证据）：
   - 跑该 issue 映射 AC 的验证命令；
   - `gate_policy` 要求的 build/lint/test；
   - 读改动文件、`git diff` 检查无关改动。
   - `agent-sop` 的每任务 QA 保持不变；失败 → 给同一或更强 subagent 发有边界的返工 brief（附失败证据与期望修正）；同族问题反复失败 → 停下问用户。
6. **QA 通过 → commit**：只提交本 issue 范围的改动，提交信息引用 issue key；记录 commit hash。
   - 路径 a：commit 到这个 issue 专属的临时分支（其独立 worktree 里）。
   - 路径 b/c：直接 commit 到本次调用共享 worktree 里检出的分支（b 是集成分支本身；c 是这个 standalone issue 的分支）。
7. **PR 维护（只能主 agent 做，subagent 不得触碰）**：
   - 路径 a（并发）：push 临时分支，开一个目标为集成分支的 PR，QA 通过后立即合并进集成分支，合并后同步本地/远程，清理这个 issue 专属的 worktree/分支；
   - 路径 b（顺序）：push 集成分支（已经直接 commit 在上面）；检查该里程碑"集成分支 → main"的常驻 PR 是否已存在，不存在则 `gh pr create` 发起（正文含里程碑标题、已完成 issue 清单、各自 commit hash、AC 覆盖情况），已存在则更新正文把本次 issue 信息并入，不新开第二个 PR，不合并；共享 worktree 留着给下一个 issue 继续用，不清理；
   - 路径 c（standalone）：push 这条 issue 分支，`gh pr create` 开一个目标直接是 main 的 PR（正文含该 issue 的目标、commit hash、AC 覆盖情况），不合并。
8. `save_comment` 写 Proof Packet（用 `assets/proof-packet-template.md`：workspace、分支、commit、验证结果、AC 覆盖、残余风险、PR 链接及本次走的路径 a/b/c）；`save_issue` 状态流转到最接近"待验收/In Review"的状态。

task-runner 只管每次调用的工作区创建、每个 issue 的 commit、push、PR 发起/更新（含路径 a 的集成分支内合并）——集成分支和 main 之间的漂移、冲突处理、最终合并，一律留给 `accept-milestone`（里程碑路径）或 `merge-issue`（standalone 路径）；本 skill 不主动把集成分支 rebase/merge 到 main，也不合并任何面向 main 的 PR。

## 里程碑收尾

里程碑内全部 issue 完成后（此时"集成分支 → main"的常驻 PR 已经在最后一个 issue 完成时的"PR 维护"步骤里更新到最新）：

1. 在 **main 分支工作区**（不是里程碑 worktree）把 `requirement.yaml` 中该里程碑 `status` 置为 `pending_acceptance`；
2. 确认该 PR 正文已反映全部 issue（标题、issue 清单及各自 commit hash、AC 覆盖情况）；全量回归证据与残余风险由 `accept-milestone` 在验收时补充/更新，本步骤不需要；
3. 告诉用户：全部 issue 已完成并落地到集成分支 `milestone/<req-id>-<n>`，PR 已是最新（附 PR 链接），等待 `accept-milestone` 做全量回归并合并。**不要在这里合并 PR。**

## 单 issue（不挂里程碑）收尾

standalone issue 完成、PR 已开向 main 后：共享 worktree 保留不清理；告诉用户 PR 已就绪（附链接），下一步先走 `accept-issue` 验收，验收通过后再用 `merge-issue` 合并这个 PR。**不要在这里合并 PR。**

## 红线

- 从其他 skill 里自动调用了本 skill，没有等用户手动触发 → 违反"只允许人为调用"。
- 集成分支之外又建了第二条持久/长期分支 → 一个里程碑只允许一条集成分支持久存在。
- 顺序执行（路径 b/c）里每处理一个 issue 就新建/删除一次 worktree → worktree 粒度默认是每次调用，不是每个 issue，这样只会不必要地攒 worktree；只有并发路径（a）才需要每个 issue 一个。
- 并发路径（a）的临时 worktree/分支用完没有立即清理 → 并发场景必须"跑完即删"，避免堆积。
- 调用级共享 worktree（b/c）在收尾时被清理掉了 → 共享 worktree 要保留，只有并发路径（a）的临时 worktree 才清理。
- 处理 issue 前没有做里程碑归属判定就套用了错误的 PR 路径（比如把 standalone issue 的 PR 开去了集成分支，或把里程碑内 issue 的 PR 直接开去了 main 且当作常驻 PR 之外的东西处理）→ 先判定归属再选路径。
- 并发派发的 issue，commit 直接裸 push 覆盖集成分支而没有走 PR → 并发路径必须经过 PR 这一层，避免互相踩踏。
- 顺序执行的里程碑内 issue，每次完成都开了一个新 PR，而不是复用/更新同一个"集成分支 → main"PR → 一个里程碑全程只允许一个常驻 PR。
- 由 subagent 发起、更新或评论了 PR → PR 维护只能由主 agent 做。
- standalone issue 的 PR 在本 skill 里被合并了 → standalone 的合并只属于 `merge-issue`，且必须等 `accept-issue` 先验收通过。
- 里程碑集成分支 → main 的 PR 在本 skill 里被合并了 → 合并只属于 `accept-milestone`。
- 在本 skill 里主动把集成分支/main 之间做 rebase/merge → main 侧的漂移与冲突处理属于 `accept-milestone`，不在这里做（路径 a 里、并发 issue 合并进集成分支这一步除外，那是同一次调用内部的整合，不涉及 main）。
- 在里程碑 worktree 里改了 `requirement.yaml` → 必须在 main 分支工作区改。
- 用了建单时预设的 subagent 而没有现场路由 → 执行时路由是硬规则。
- 把需求全量文档喂给 subagent → 只给 Task Brief + 相关 AC + 相关契约片段。
- subagent 说"通过"就写 Proof Packet → 主 agent 必须亲自跑命令、读输出。
- 从本 skill 把 issue 置为终态（Done/Accepted）→ 终态只属于验收 skill。
- worktree 创建失败静默退回主工作区 → 报告并停止。
- 一个 issue 起手做了不止一次 vb-wiki 定向查询（比如每个 subagent 往返都查一次）→ 每个 issue 起手恰好 1 次，不做每轮自动注入。
- vb-wiki 查询 0 命中却仍在输出里提到"wiki"或编造了参考内容 → 0 命中必须是纯 no-op，不留痕迹。
- vb-wiki 查询命中了相关旧沉淀，却没有在后续输出/Task Brief 里实际引用其路径或结论 → 命中了就要用，不能只在内部默记。

## 检查清单

- [ ] 本次调用是用户直接触发的，没有被其他 skill 自动串联。
- [ ] id 类型判定正确；单 issue 循环已做过里程碑归属判定（挂里程碑 / standalone）；模糊时问过用户。
- [ ] 每个 issue 起手在读完 issue 后恰好执行了 1 次 vb-wiki 定向查询；0 命中无痕迹跳过，≥1 命中在后续输出中引用了路径/结论。
- [ ] 顺序执行（b/c）全程只用了一个调用级共享 worktree，没有逐 issue 建删；并发（a）的每个临时 worktree/分支都已跑完即删。
- [ ] 全程只有一条集成分支（如适用）。
- [ ] 每个 issue 都经 `subagent-routing` 现场路由。
- [ ] 主 agent 独立跑了验证命令并读了输出。
- [ ] 每个 issue 的 commit 只含本 issue 范围改动，信息引用 issue key。
- [ ] 指派已设为执行身份，或已在报告中说明为何跳过。
- [ ] 每个 issue 完成都走了正确的 PR 路径（a/b/c），未合并不该合并的 PR，subagent 未触碰 PR。
- [ ] Proof Packet 已写（含 PR 链接与路径标注）；状态未置终态。
- [ ] 里程碑路径：收尾时 requirement.yaml 已置 `pending_acceptance`，常驻 PR 已是最新（未合并），共享 worktree 保留未删。Standalone 路径：共享 worktree 保留未删，已告知用户走 `accept-issue` → `merge-issue`。
- [ ] 人读内容使用 `output.language`。

## 最终报告

- 执行范围（里程碑/issue）、每个 issue 走的 PR 路径（a/b/c）、worktree 路径、集成分支名（如适用）、PR 链接
- 每个 issue：所选 subagent、改动文件、验证结果、commit hash
- 阻塞项（如有）及需要用户决定的事项
- 下一步：挂里程碑的 issue → `accept-issue`（单点验收）或 `accept-milestone`（里程碑验收）；standalone issue → `accept-issue` 然后 `merge-issue`
