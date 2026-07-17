---
name: vb-learn
description: >-
  Distil a completed Linear task into a reusable skill in ~/.vb-skills.
  Trigger phrases: "vb-learn VB-42", "学习 VB-42", "把 VB-42 沉淀成 skill",
  "记录这个 pattern". Issue must be in a terminal state (Done / Accepted /
  Completed / Cancelled / Duplicate).
---

# VB Learn

Given a Linear key, read the task and all sub-tasks autonomously, distil one generalizable lesson, and persist it to `~/.vb-skills` — the global cross-project knowledge store.

Internal pipeline: **read Linear → verify terminal state → `insights` → `skill-builder` → lock update → `validate-skill-lock` → git commit**.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept-issue` | issue 验收通过、状态置终态、**insights 复盘评论已写入该 issue 评论区**之后——传 issue key |
| `accept-milestone` | 里程碑验收通过、**insights 复盘评论已写入**之后——传里程碑 id |
| User (manual) | "vb-learn VB-42", "学习 VB-42", "把 VB-42 的经验沉淀下来", "记录这个 pattern" |

**调用方必须先把 Linear 置为终态、并先跑 insights 复盘**——本 skill 的学习输入就是评论区（insights 复盘评论 + proof packet + 验收评论）。本 skill 自己会校验终态，拒绝从非终态学习。

与 `insights` 的分工：insights 负责复盘并把结论写入 Linear 评论区；本 skill 从评论区学习并沉淀 skill 到 `~/.vb-skills`。本 skill 不写复盘评论；insights 不直接写 `~/.vb-skills`。

### Do NOT invoke

- Issue is in a non-terminal state (In Progress, In Review, Blocked, To Do, etc.) — exit with error.
- `vb-init` has not been run (no `~/.vb-skills` repo or `~/.agents/skills/vb` symlink).
- The task is purely routine with nothing generalisable — state reason and return `skipped: <reason>`.

## Inputs

- **Linear key** (e.g. `VB-42`) — required. This is the only required input.

## Workflow

### 1. Read Linear and verify terminal state

Ask `vb-linear` to read the issue and resolve the team's workflow states.

Check the issue's current status against the team's terminal states (Done / Accepted / Completed / Cancelled / Duplicate).
**If status is not terminal → exit immediately with:**
```
ERROR: VB-42 is not in a terminal state (current: <status>).
vb-learn requires the issue to be Done/Accepted/Completed/Cancelled/Duplicate before learning.
Run `accept-milestone` or `accept-issue` first, or close the issue manually.
```

聚合粒度（里程碑原生工作流）：入参可以是**里程碑 id / 需求 id / issue key**。里程碑 → 聚合该里程碑下全部 issue（请 `vb-linear` 按 Milestone 过滤枚举 issue + 读 `requirement.yaml`）；需求 → 聚合其全部里程碑的复盘。Gather from all issues in scope:

- Title, description, acceptance criteria
- Root-cause analysis or key insight from comments
- Commit hash(es) and PR URL
- Validation notes and proof packet comments

Ask `vb-linear` to read comments for each issue in scope, repeating per sub-task.

### 2. Full content summary (no information loss)

Before any analysis, produce a **structured summary** of everything gathered. This step must not omit or compress anything — its purpose is to create a lossless intermediate representation.

Fill in [`assets/content-summary-template.md`](assets/content-summary-template.md) — six required fields. Do not skip any field, even if thin — write "none noted" rather than omitting.

### 3. Skill planning — decide what to learn

```bash
cat ~/.vb-skills/vb-skill-lock.json   # survey existing skills（格式见 assets/vb-skill-lock.schema.json）
ls ~/.vb-skills/
```

Read the content summary from Step 2. Then explicitly reason about how many reusable lessons are present:

1. **List all candidate skills** — each candidate is a distinct, independently triggerable lesson. One issue can yield zero, one, or several candidates.
2. For each candidate, briefly state:
   - Proposed skill name (`^[a-z0-9][a-z0-9-]*$`)
   - One-line **When** (the trigger condition)
   - Action: `create` (no semantically close skill in lock) or `refine` (close match exists → name the existing skill)
   - Confidence: `high` / `medium` / `low`
3. **Drop** any candidate where confidence is `low` or a clear **When** cannot be stated — record reason as `skipped: <reason>`.
4. Present the final plan as a numbered list before proceeding.

If zero candidates remain after filtering → return `skipped: no generalisable pattern found`.

### 4. Write each skill — invoke `skill-builder` per candidate

For **each** candidate from Step 3 (in order):

Invoke `insights` focused on that candidate's scope, asking for:

| Output | Why it matters |
|---|---|
| **When** — exact conditions / symptoms / code signals | Powers `description` frontmatter and `## When` block |
| **When NOT** — adjacent situations that look similar but belong elsewhere | Prevents false triggers |
| **What** — the one generalisable rule, stripped of task-specific detail | Feeds skill body |
| **How** — the solution approach, generalised | Feeds workflow section |
| **Verify** — commands or checks that confirm correct application | Feeds validation section |

Fill in [`assets/skill-builder-prompt.md`](assets/skill-builder-prompt.md) with all fields from `insights` output, then pass the entire block to `skill-builder`.

**Trigger Quality Gate** — after `skill-builder` produces the SKILL.md, verify before accepting:

1. Mentally run each should-trigger example against the `description` — all must match.
2. Mentally run each should-NOT-trigger example against the `description` — none must match.
3. Confirm `## When` section exists and states both "invoke when" and "do not invoke when".

If any check fails → ask `skill-builder` to revise before moving on.

Then immediately update the lock for this skill:

```bash
npx vibe-rig skill-lock update <skill-name>
```

Repeat for the next candidate.

### 5. Validate and commit

```bash
# Hard stop — do not commit on failure
npx vibe-rig skill-lock validate

git -C ~/.vb-skills add -A
git -C ~/.vb-skills commit -m "vb-learn: capture <skill-names> (<LINEAR-KEY>)"
```

Commit format when multiple skills: list all names comma-separated — `vb-learn: capture foo, bar (<LINEAR-KEY>)`.

### 6. Return report

```
Content summary : done (Step 2)
Skill plan      : <N> candidates identified, <M> skipped
─────────────────────────────────────────────────────
Skill 1 : <skill-name>
  Action        : created | refined
  Path          : ~/.vb-skills/<skill-name>/SKILL.md
  Pattern       : <one-line summary>

Skill 2 : <skill-name>
  ...

Skipped         : <name> — <reason> (if any)
─────────────────────────────────────────────────────
Lock validated  : ok
Commit          : <short-sha>
```

If all skipped: `skipped: <reason>`.

## Validation

```bash
ls ~/.vb-skills/           # confirm written skills exist
npx vibe-rig skill-lock validate
git -C ~/.vb-skills log --oneline -1
```

- [ ] Linear issue status confirmed terminal before any learning began.
- [ ] All sub-tasks loaded (if parent issue).
- [ ] Step 2 content summary produced — all six fields present, nothing omitted.
- [ ] Step 3 skill plan listed explicitly before any `skill-builder` call.
- [ ] `insights` invoked per candidate; returned When / When NOT / What / How / Verify.
- [ ] `skill-builder` invoked per candidate with `~/.vb-skills/<name>/` as target and full When context.
- [ ] Trigger Quality Gate passed for every skill: all should-trigger hit, all should-NOT-trigger miss.
- [ ] Every learned SKILL.md has a `## When` section as first section after intro.
- [ ] `vb-skill-lock.json` updated for each written skill (correct `skillPath` and `computedHash`).
- [ ] `validate-skill-lock` exits 0.
- [ ] Commit message lists all skill names and the Linear key.
- [ ] Zero writes outside `~/.vb-skills/`.

## Hard Rules

- Write target is `~/.vb-skills/` only — any other path is a bug.
- Verify terminal state first — never learn from a non-terminal issue.
- Do not commit when `validate-skill-lock` exits non-zero.
- Always produce the Step 2 content summary before any skill planning — never jump straight from raw data to skill-builder.
- Always produce the Step 3 skill plan (explicit list) before invoking skill-builder — never skip the planning phase.
- Do not put Linear key, dates, or task-specific text inside the learned SKILL.md body.
