# Proof Packet 评论模板

用 `.vibeRig/project.yaml` `output.language` 渲染人读内容；技术标识（key、路径、命令）保持原样。issue 级不含 PR 字段——PR 只发生在 `accept-milestone`。

```markdown
## Proof Packet

**Issue**: <issue-key> — <任务目标>
**Workspace**: `<worktree 路径>`（里程碑共享 worktree）

## 分支 / 提交

- 集成分支: `milestone/<req-id>-<n>`
- Commit: `<commit-hash>`
- 临时分支: <无 | 已合回集成分支并删除：<branch-name>>

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
