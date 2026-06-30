---
name: blocker-resume
description: Use when a VibeRig Linear issue is blocked and the main agent should inspect the blocker, referenced local docs, proof comments, validation logs, and current git state, then either resume through task-runner or ask for the missing decision/input.
---

# Blocker Resume

Use this workflow when a Linear-backed VibeRig task is blocked and the user wants AI-assisted recovery.

Recovery happens in the current Cursor main-agent session using Linear issue context, local Docs as Code, and `task-runner`.

## Contract

Use this skill to inspect a blocked VibeRig Linear issue, classify the blocker, and either resume safely through `task-runner` or ask for the exact missing input.

Do not use this skill for normal task execution, final acceptance, or retrospective learning. Use `task-runner` for executable work, `human-acceptance` for sign-off, and `insights` after accepted work.

Stop and report when the blocker depends on a product decision, credentials, missing external system state, or ambiguous ownership that cannot be resolved from Linear and local docs.

## Input Contract

The user may provide:

- Linear issue key or URL
- requirement id
- local docs path under `.vibeRig/requirements/`
- branch, PR, commit, validation log, or CI URL
- plain-language blocker summary

If no Linear issue is provided, search the registered Linear Project from `.vibeRig/project.yaml` when Linear tools are available. Use `_list_projects` or `_search` to confirm the project and `_list_issues` to find blocked issues. If multiple blocked issues match, ask the user to choose.

## Output Contract

Return or write:

- Blocked Linear issue key/url and matching requirement docs.
- Blocker classification and evidence.
- Next action: ask user, resume through `task-runner`, update docs with approval, or keep blocked.
- Linear comment/status updates made, or the reason they were skipped.
- Validation evidence and remaining blocker.

Do not claim an issue is unblocked unless the blocking evidence is resolved and Linear has been updated or the user was told why it could not be updated.

## Evidence To Gather

- Linear issue title, description, status, labels, assignee, comments, and proof packet comments.
- Referenced local docs:
  - `brief.md`
  - `contract.json`
  - `architecture.md`
  - `acceptance.json`
  - `acceptance.md`
  - `validation.md`
- Current git status, branch, changed files, commit/PR links when available.
- Validation logs or CI URLs referenced from Linear comments.
- Prior subagent handoff notes.

Read Linear comments, blocker comments, proof packet comments, and linked validation or CI evidence before classifying whether the blocker is resolved.

## Language Policy

Read `.vibeRig/project.yaml` and use `output.language` for human-facing blocker records.

- Blocker classification comments, resume comments, remaining-risk notes, user-decision requests, and final summaries should use `output.language`.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, log excerpts, or existing external labels/status names.

## Workflow

1. Resolve the blocked Linear issue, project output language, and matching local requirement docs:
   - use `_get_issue` for a named issue
   - use `_list_issues` for blocked issue queues
   - use `_list_comments` for blocker comments and prior proof packets
2. Confirm the issue is actually blocked or has an unresolved blocker comment.
3. Classify the blocker:
   - missing product decision
   - missing credentials or external service
   - validation failure
   - architecture/acceptance contradiction
   - implementation defect
   - stale branch or merge conflict
   - unclear task scope
4. Decide the next action:
   - Ask the user when the blocker requires a product decision, credentials, or external state.
   - Update local docs only when the blocker proves the contract is wrong and the user approves the doc change.
   - Use `task-runner` when implementation or validation can continue now.
   - Use `subagent-routing` for specialized investigation, QA, security, architecture, or implementation rework.
5. If work resumes, build a concise Task Brief that includes the blocker evidence and expected correction.
6. After validation, post a Linear comment with `_save_comment`:
   - blocker classification
   - action taken
   - validation commands/results
   - acceptance IDs affected
   - remaining risks or user decisions
7. Move/update Linear status with `_save_issue` according to the team's workflow only after evidence supports it.

## Red Flags

- The blocker was classified without reading Linear comments or local docs → classification must be evidence-based, not assumed.
- Resumed implementation happened directly in `blocker-resume` instead of going through `task-runner` → any implementation work must route through `task-runner`.
- Linear status was changed to unblocked before evidence was resolved → issue stays blocked until the blocking condition is removed.
- A subagent updated Linear during investigation → subagents must return findings only; the main agent owns all Linear writes.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The blocker is obvious from the description, I don't need to read Linear comments" | Prior analysis comments, proof packet comments, and review notes are the exact place where the blocker details and prior attempts are recorded. Reading them takes 30 seconds. Missing them causes wrong classifications. |
| "I'll resume implementation directly here to save time" | `blocker-resume` classifies and unblocks; `task-runner` executes. Mixing execution into `blocker-resume` bypasses the worktree policy, subagent routing, and proof packet requirements. |

## Validation

```bash
# Confirm the Linear issue key resolves (placeholder — replace with actual key)
# Use _get_issue in the Linear plugin to verify the issue exists and read its current status
```

- [ ] The target issue and requirement docs were resolved.
- [ ] The blocker classification is backed by Linear comments, local docs, git state, validation output, or CI evidence.
- [ ] Any resumed implementation went through `task-runner`.
- [ ] Any Linear status change used an existing team status, not an invented one.
- [ ] Human-facing Linear comments and summaries use `output.language` when configured.
- [ ] Remaining user decisions, credentials, or external blockers are stated explicitly.

## Guardrails

- Do not call VibeRig backend run, resume, rerun, task, or dashboard tools.
- Do not edit SQLite files, local runtime state, or generated dashboard data.
- Do not create a local proof packet directory.
- Do not mark an issue unblocked or done unless the blocker evidence is resolved.
- Do not let subagents update Linear.
