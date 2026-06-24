---
name: vb-learn
description: Distil a completed Linear task (status must be Done/Accepted/Completed) into a reusable learned skill in the global ~/.vb-skills store. Pass a Linear key directly: "vb-learn VB-42", "学习 VB-42", "把 VB-42 沉淀成 skill". Also invoked by `accept` and `accept-bug` after they move the issue to Done. Reads all Linear content autonomously — no accept summary required. Do NOT invoke on in-progress, rejected, blocked, or partially-accepted issues.
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
- Issue was rejected or cancelled — nothing to learn.
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

Check the issue's current status against the team's terminal states (Done / Accepted / Completed).
**If status is not terminal → exit immediately with:**
```
ERROR: VB-42 is not in a terminal state (current: <status>).
vb-learn requires the issue to be Done/Accepted/Completed before learning.
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

Invoke `insights` with the full gathered content.
Ask for **one** concrete, generalizable rule stripped of task-specific detail.
The pattern from `insights` is the sole input to `skill-builder`.

### 3. Write the skill — invoke `skill-builder`

Invoke `skill-builder` with:
- **Target**: `~/.vb-skills/<skill-name>/` (new) or existing dir (refine).
- **Input**: pattern from `insights`.
- **Constraints**: trigger-first `description`; body < 200 lines; deterministic logic to `scripts/`; no task-specific references (no Linear keys, dates, names) in the SKILL.md body.

Skill name rule: `^[a-z0-9][a-z0-9-]*$` — derived from the lesson topic, never from the Linear key.

Decision:
- Semantically close skill already in lock → **refine** it.
- No close match → **create** new directory.

### 4. Update lock

```python
import hashlib, json, os

store      = os.path.expanduser("~/.vb-skills")
skill_name = "<skill-name>"          # determined in step 3
skill_dir  = os.path.join(store, skill_name)
lock_path  = os.path.join(store, "vb-skill-lock.json")

parts = []
for dp, _, fnames in os.walk(skill_dir):
    for fn in sorted(fnames):
        full = os.path.join(dp, fn)
        rel  = os.path.relpath(full, skill_dir)
        h    = hashlib.sha256(open(full, "rb").read()).hexdigest()
        parts.append(f"{rel}:{h}")
parts.sort()
computed = "sha256:" + hashlib.sha256("\n".join(parts).encode()).hexdigest()

with open(lock_path) as f:
    lock = json.load(f)
lock["skills"][skill_name] = {
    "skillPath": f"{skill_name}/SKILL.md",
    "computedHash": computed
}
with open(lock_path, "w") as f:
    json.dump(lock, f, indent=2, ensure_ascii=False)
    f.write("\n")
```

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
- [ ] `insights` invoked; returned one concrete generalizable pattern.
- [ ] `skill-builder` invoked with `~/.vb-skills/<name>/` as target.
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
