# Proof Packet 评论模板

用 `.vibeRig/project.yaml` `output.language` 渲染人读内容；技术标识（key、路径、命令）保持原样。PR 由主 agent 维护，走三条路径之一：a）并发派发的里程碑内 issue，PR 目标是集成分支，本次已由 task-runner 在内部循环合并；b）顺序执行的里程碑内 issue，持续更新同一个"集成分支→main"常驻 PR，不合并，合并只发生在 `accept-milestone`；c）不挂里程碑的 standalone issue，PR 直接目标 main，不合并，合并等 `accept-issue` 验收通过后由 `merge-issue` 处理。

```markdown
## Proof Packet

**Issue**: <issue-key> — <任务目标>
**Workspace**: `<本次调用使用的 worktree 路径——路径 b/c 是调用级共享 worktree，本 issue 完成后不清理，留给同一次调用的下一个 issue；路径 a 是本 issue 专属的一次性 worktree，已清理>`

## 分支 / 提交 / PR

- 路径: <a 并发-集成分支 | b 顺序-常驻main PR | c standalone-main>
- 集成分支: `milestone/<req-id>-<n>`（路径 a/b 适用；路径 c 无）
- Commit: `<commit-hash>`
- 临时分支: <路径 a：`<branch-name>`，已合并进集成分支并清理 | 路径 b：无，直接 commit 到集成分支 | 路径 c：`issue/<issue-key>`，本次调用专用>
- PR: `<PR 链接>`（路径 a：已合并进集成分支；路径 b：发起或更新了常驻 PR，未合并；路径 c：已开向 main，未合并，待 accept-issue → merge-issue）

## 改动文件

- `<file-path>` — <改了什么>

## 验证

- `<command>` → <PASS | FAIL | SKIP: 原因>

## AC 覆盖

- 已覆盖: AC-...
- 未覆盖: AC-... — <原因>

## 待人工检查

- <检查项描述>

## Subagent

- 使用: <capability 名称>（执行时经 subagent-routing 现场选择）
- 交接备注: <subagent 的关键发现或残余风险>

## 残余风险

- <风险或未消除的不确定性>
```
