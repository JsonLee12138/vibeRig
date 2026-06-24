---
name: vb-learn
description: Distil a completed Linear task into a reusable skill in ~/.vb-skills. Trigger phrases: "vb-learn VB-42", "学习 VB-42", "把 VB-42 沉淀成 skill", "记录这个 pattern". Issue must be in a terminal state (Done / Accepted / Completed / Cancelled / Duplicate).
---

# VB Learn

Given a Linear key, read the task and all sub-tasks autonomously, distil one generalizable lesson, and persist it to `~/.vb-skills` — the global cross-project knowledge store.

Internal pipeline: **read Linear → verify terminal state → `insights` → `skill-builder` → lock update → `validate-skill-lock` → git commit**.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept` | After Linear status is moved to Done — pass the issue key |
| `accept-bug` | After Linear status is moved to Done AND fix reveals a non-obvious, recurring failure mode — pass the issue key |
| User (manual) | "vb-learn VB-42", "学习 VB-42", "把 VB-42 的经验沉淀下来", "记录这个 pattern" |

**`accept` and `accept-bug` must update Linear to a terminal state before calling this skill.**
This skill verifies the state itself and refuses to learn from non-terminal issues.

### Do NOT invoke

- Issue is in a non-terminal state (In Progress, In Review, Blocked, To Do, etc.) — exit with error.
- `vb-init` has not been run (no `~/.vb-skills` repo or `~/.agents/skills/vb` symlink).
- The task is purely routine with nothing generalisable — state reason and return `skipped: <reason>`.

## Inputs

- **Linear key** (e.g. `VB-42`) — required. This is the only required input.
- `<project-root>`: inferred from current git root; used to locate `scripts/validate-skill-lock`.

## Workflow

### 1. Read Linear and verify terminal state

```
_get_issue(id: <LINEAR-KEY>)
_list_issue_statuses(teamId: <team>)
```

Check the issue's current status against the team's terminal states (Done / Accepted / Completed / Cancelled / Duplicate).
**If status is not terminal → exit immediately with:**
```
ERROR: VB-42 is not in a terminal state (current: <status>).
vb-learn requires the issue to be Done/Accepted/Completed/Cancelled/Duplicate before learning.
Run `accept` or `accept-bug` first, or close the issue manually.
```

If the issue is a **parent (requirement)**: use `_list_issues(filter: {parent: {id: {eq: <id>}}})` to load all sub-tasks. Gather from parent + all sub-tasks:

- Title, description, acceptance criteria
- Root-cause analysis or key insight from comments
- Commit hash(es) and PR URL
- Validation notes and proof packet comments

```
_list_comments(issueId: <id>)   # repeat for each sub-task
```

### 2. Surface the pattern — invoke `insights`

```bash
cat ~/.vb-skills/vb-skill-lock.json   # survey existing skills
ls ~/.vb-skills/
```

Invoke `insights` with the full gathered content and ask for ALL of the following — **When is the most important**:

| Output from insights | Why it matters |
|---|---|
| **When** — exact conditions / symptoms / code signals that mean "use this skill now" | Powers the `description` frontmatter and the `## When` block; this is how AI discovers the skill |
| **When NOT** — adjacent situations that look similar but belong elsewhere | Prevents false triggers; feeds should-NOT-trigger examples |
| **What** — the one generalizable rule, stripped of task-specific detail | Feeds the skill body |
| **How** — the solution approach, generalized | Feeds the workflow section |
| **Verify** — commands or checks that confirm correct application | Feeds the validation section |

If `insights` cannot produce a clear **When**, stop and return `skipped: trigger conditions too vague to write a discoverable skill`.

### 3. Write the skill — invoke `skill-builder`

Skill name rule: `^[a-z0-9][a-z0-9-]*$` — derived from the lesson topic, never from the Linear key.

Decision:
- Semantically close skill already in lock → **refine** it (pass existing dir as target).
- No close match → **create** new directory.

Fill in [`assets/skill-builder-prompt.md`](assets/skill-builder-prompt.md) with all fields from `insights` output, then pass the entire block to `skill-builder`.

**Trigger Quality Gate** — after `skill-builder` produces the SKILL.md, verify before accepting:

1. Mentally run each should-trigger example against the `description` — all must match.
2. Mentally run each should-NOT-trigger example against the `description` — none must match.
3. Confirm `## When` section exists and states both "invoke when" and "do not invoke when".

If any check fails → ask `skill-builder` to revise the `description` and `## When` section before proceeding to step 4.

### 4. Update lock

```bash
python3 <project-root>/scripts/update-skill-lock <skill-name>
```

See [`scripts/update-skill-lock`](../../../../scripts/update-skill-lock) — computes SHA-256 of the skill directory and writes the entry to `vb-skill-lock.json`.

### 5. Validate and commit

```bash
# Hard stop — do not commit on failure
python3 <project-root>/scripts/validate-skill-lock

git -C ~/.vb-skills add -A
git -C ~/.vb-skills commit -m "vb-learn: capture <skill-name> (<LINEAR-KEY>)"
```

Commit format: `vb-learn: capture <skill-name> (<LINEAR-KEY>)` — git history is the traceability record.

### 6. Return report

```
Learned skill : <skill-name>
Action        : created | refined
Path          : ~/.vb-skills/<skill-name>/SKILL.md
insights      : <one-line pattern summary>
skill-builder : <what changed>
Lock validated: ok
Commit        : <short-sha>
```

If skipped: `skipped: <reason>`.

## Validation

```bash
ls ~/.vb-skills/<skill-name>/SKILL.md
python3 <project-root>/scripts/validate-skill-lock
git -C ~/.vb-skills log --oneline -1
```

- [ ] Linear issue status confirmed terminal before any learning began.
- [ ] All sub-tasks loaded (if parent issue).
- [ ] `insights` invoked; returned When / When NOT / What / How / Verify — not just the rule.
- [ ] `skill-builder` invoked with `~/.vb-skills/<name>/` as target and full When context.
- [ ] Trigger Quality Gate passed: all should-trigger hit, all should-NOT-trigger miss.
- [ ] Learned SKILL.md has a `## When` section as first section after intro.
- [ ] Exactly one SKILL.md written or updated in `~/.vb-skills/`.
- [ ] `vb-skill-lock.json` updated with correct `skillPath` and `computedHash`.
- [ ] `validate-skill-lock` exits 0.
- [ ] Commit message: `vb-learn: capture <name> (<key>)`.
- [ ] Zero writes outside `~/.vb-skills/`.

## Hard Rules

- Write target is `~/.vb-skills/` only — any other path is a bug.
- Verify terminal state first — never learn from a non-terminal issue.
- Do not commit when `validate-skill-lock` exits non-zero.
- Do not create more than one skill per invocation.
- Do not put Linear key, dates, or task-specific text inside the learned SKILL.md body.
