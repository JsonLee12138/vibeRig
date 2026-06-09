---
name: blocker-resume
description: Use when a VibeRig Linear issue is blocked and the main agent should inspect the blocker, referenced local docs, proof comments, validation logs, and current git state, then either resume through task-runner or ask for the missing decision/input.
---

# Blocker Resume

Use this workflow when a Linear-backed VibeRig task is blocked and the user wants AI-assisted recovery.

VibeRig no longer resumes backend runs or command-mode Codex sessions. Recovery happens in the current Codex main-agent session using Linear issue context, local Docs as Code, and `task-runner`.

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

The main agent may use context-mode to summarize large histories or logs. Subagents must not use context-mode.

## Workflow

1. Resolve the blocked Linear issue and matching local requirement docs:
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

## Validation

Before reporting recovery, verify:

- The target issue and requirement docs were resolved.
- The blocker classification is backed by Linear comments, local docs, git state, validation output, or CI evidence.
- Any resumed implementation went through `task-runner`.
- Any Linear status change used an existing team status.
- Remaining user decisions, credentials, or external blockers are stated explicitly.

## Guardrails

- Do not call VibeRig backend run, resume, rerun, task, or dashboard tools.
- Do not edit SQLite files, local runtime state, or generated dashboard data.
- Do not create a local proof packet directory.
- Do not mark an issue unblocked or done unless the blocker evidence is resolved.
- Do not let subagents update Linear or use context-mode.
