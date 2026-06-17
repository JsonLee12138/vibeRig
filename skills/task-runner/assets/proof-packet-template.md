# Proof Packet Comment Template

Render in `.vibeRig/project.yaml` `output.language`. Technical identifiers (keys, paths, commands) stay unchanged.

```markdown
## Proof Packet

**Issue**: <issue-key> — <task goal>
**Workspace**: <worktree | current-workspace> — `<path>`

## Branch / PR

- Branch: `<branch-name>`
- Commit: `<commit-hash>`
- PR: <PR URL or "not yet created">
- Provider: <github | other>
- Base: `<base-branch>`
- Draft: <true | false>
- CI/Checks: <URL or "not available">

## Changed Files

- `<file-path>` — <what changed>

## Validation

- `<command>` → <PASS | FAIL | SKIP: reason>

## Acceptance Coverage

- Covered: AC-...
- Not covered: AC-... — <reason>

## Manual Checks Required

- <check description>

## Subagent

- Used: <capability name>
- Handoff notes: <key findings or residual risks from subagent>

## Residual Risks

- <risk or remaining uncertainty>
```
