---
name: task-runner
description: Execute or continue a VibeRig task from Linear in the current Codex session. Use when the user asks to run, execute, continue, resume, fix, validate, or complete a VibeRig Linear issue or requirement. The main agent selects an appropriate subagent, validates the result, submits a PR, and updates Linear with a proof packet.
---

# Task Runner

Use this skill as the Linear-native execution protocol for VibeRig.

Codex is already running inside the Codex plugin environment. Do not launch another Codex process and do not use a backend runner. The current main agent orchestrates the work, delegates bounded execution to the appropriate subagent, validates the result, and writes status/proof back to Linear.

## Contract

Use this skill to execute or continue one VibeRig Linear issue or execution task in the current Codex session.

Do not use this skill for requirement discovery, Linear plan synthesis, final human acceptance, PR merge, worktree cleanup after acceptance, or post-acceptance learning. Use `brainstorm`, `write-plan`, `human-acceptance`, and `insights` for those phases.

Stop and report when the Linear issue, source docs, subagent capability, workspace safety, required credentials, or PR path cannot be resolved.

## Default Parameter

The skill requires exactly one of the following as its entry point:

| Parameter form | Example |
|---|---|
| Task ID | `VB-42` |
| Task title (partial match) | `"implement login flow"` |
| Requirement ID | `REQ-007` |
| Requirement title (partial match) | `"user authentication"` |

When the argument resolves to a **requirement** (parent issue), the skill runs **all its subtasks** in sequence before finishing. When it resolves to a single **task**, only that task is executed.

If the argument is ambiguous (multiple matches), list candidates and ask the user to choose before starting work.

## Input Contract

Required:

- **Entry point**: task ID, task title, requirement ID, or requirement title (see Default Parameter above).
- `.vibeRig/project.yaml` or equivalent project registration.
- Referenced requirement docs and acceptance IDs.
- Validation expectations from docs, Linear, or project gate policy.

Optional:

- Existing branch, PR, worktree path, prior proof packet, CI/log URL, or blocker comment.

If multiple issues match or the source docs are missing, ask before implementation.

## Output Contract

Produce:

- Worktree/main-workspace decision and path.
- Selected subagent capability and Task Brief summary.
- Task-scoped code/doc changes.
- Validation evidence and AC coverage.
- Commit/branch/PR URL when required.
- Linear Proof Packet comment and status update.
- Final handoff stating that `human-acceptance` is required for sign-off, merge, and cleanup.

Do not claim a task is ready for human acceptance unless validation is sufficient and any required PR was created or updated.

## Sources Of Truth

- Linear issue/sub-issue: task status, assignment, discussion, acceptance conclusion, and proof packet.
- Local `.vibeRig/requirements/{requirement-id}/`: requirement contract, architecture, acceptance matrix, validation policy, and diagrams.
- `.vibeRig/project.yaml`: Linear registration, docs root, output language, worktrees root, pull request policy, gate policy, and default subagent routing.
- Current git workspace: implementation changes, branch/commit/PR, and validation evidence.

## Hard Rules

- Every Linear task execution must declare and use a suitable subagent through `subagent-routing`.
- Default to an isolated git worktree for all task execution work. Direct development in the current main workspace is allowed only when the user explicitly asks to modify the main/current workspace.
- A branch is not an execution workspace. Creating or switching to a task branch in the main checkout does not satisfy worktree mode.
- Subagents must not update Linear, project status, acceptance status, or final proof.
- The main agent owns final validation, acceptance mapping, Linear comments, and status updates.
- Do not call `codex-cli-mcp`, `codex mcp-server`, shell-launched Codex, or local backend automatic execution.
- Do not call VibeRig dashboard/task-engine MCP tools or HTTP routes.
- Do not create or rely on `tasks.yaml`.
- Do not write a local long-term proof packet directory. Proof packets are Linear comments referencing durable logs, CI URLs, commits, branches, changed files, and local docs.
- Do not mark a Linear issue complete or done from this skill. Move validated work to a human-acceptance/review state and require the `human-acceptance` skill for final human sign-off.
- When `pull_request.required` is true or absent, do not finish a successful implementation without creating or updating a PR and recording its URL.
- Do not merge the PR or remove the task worktree from this skill. Merge and cleanup belong to `human-acceptance` after explicit user acceptance.

## Workspace And Worktree Policy

Before implementation, explicitly decide where the task will run. This workspace decision is separate from the branch decision. **The worktree is created once before the per-task loop and shared by all subtasks in the queue — do not create a new worktree per subtask.**

Workspace modes:

- `worktree`: default. Create or reuse a single isolated git worktree for the entire execution run.
- `current-workspace`: explicit exception. Use only when the user explicitly asks to work in the main/current workspace, or explicitly authorizes it after worktree creation fails.

**Shared worktree rule:** When the entry point is a requirement (parent issue), name the worktree and branch after the **parent issue key**. All subtasks in the queue execute in this one worktree and commit to the same branch sequentially. When the entry point is a single task, name the worktree and branch after that task's issue key.

For `worktree` mode:

- Worktree root: use `workspace.worktrees_root` from `.vibeRig/project.yaml`; default to the project `.worktrees/` directory.
- Worktree directory pattern: project `.worktrees/` plus issue key and short slug (parent issue key for requirement runs).
- Preferred branch naming: `codex/{issue-key}-{short-slug}` when a branch is needed.
- Create or reuse the branch inside the selected worktree.
- Verify the selected path appears in `git worktree list` before implementation.

Use these command templates for worktree setup:

```bash
git worktree list
git worktree add -b codex/<issue-key>-<short-slug> <worktree-path> <base-ref>
git worktree list
```

If the task branch already exists and is not checked out by another worktree, use:

```bash
git worktree add <worktree-path> codex/<issue-key>-<short-slug>
git worktree list
```

For `current-workspace` mode:

- Use the current project checkout path.
- Inspect dirty files first and protect unrelated user changes.
- Creating or switching to a task branch in the current checkout is allowed only as a branch decision; it does not make the workspace a worktree.

For all modes:

- Record the worktree/main-workspace decision and reason in the Proof Packet.
- Pass the selected workspace path to the subagent in the Task Brief.

If worktree creation fails, do not silently fall back to the current workspace. State the failure and stop before implementation unless the user explicitly authorizes main/current workspace changes. Include the failure and next required decision in the proof or blocker comment.

The default configured path pattern is:

```text
<project-root>/.worktrees/<issue-key>-<short-slug>
```

## Pull Request Policy

Read `pull_request` from `.vibeRig/project.yaml`; if the section is absent, use:

```yaml
pull_request:
  required: "true"
  provider: "auto"
  base_branch: ""
  draft: "false"
```

For implementation tasks, the default end state is a submitted PR:

- Create or reuse the issue branch before implementation when practical.
- After validation passes, inspect the diff, protect unrelated changes, and commit only the task changes.
- Push the branch and create or update a PR against `pull_request.base_branch`, or the repository default branch when the base branch is empty.
- Use the target project's PR provider. For GitHub projects, use the GitHub plugin or `gh` CLI when authenticated.
- Include the Linear issue key, source docs, AC coverage, validation evidence, and residual risks in the PR body.
- Link the PR back to Linear through the Proof Packet comment and issue links/status fields when available.

If PR creation is required but cannot be completed because the repo has no remote, provider/auth is missing, pushes fail, or checks block PR submission, do not present the task as ready for human acceptance. Move or comment the Linear issue as blocked/waiting with the exact missing condition and ask the user for the needed action.

## Linear Status Policy

Use `_list_issue_statuses` to map VibeRig lifecycle intent to the team's actual Linear workflow states. Do not invent states that are not available in the team.

Recommended semantic lifecycle:

- `Backlog` / `Triage`: issue exists but is not ready for execution.
- `Ready`: source docs, AC refs, validation expectations, and subagent recommendation are present.
- `In Progress`: implementation work has started in a worktree or the current workspace.
- `In Review` / `QA`: implementation is complete and validation or review is underway.
- `Human Acceptance`: proof packet is posted and the issue is waiting for explicit user acceptance.
- `Done` / `Accepted` / `Completed`: only set by the `human-acceptance` skill after explicit human sign-off.
- `Blocked`: execution cannot proceed without user input, credentials, external state, or product decisions.

If the team has no `Human Acceptance` status, use the closest review/waiting state and write a comment that the intended state is human acceptance.

## Language Policy

Read `.vibeRig/project.yaml` and use `output.language` for human-facing execution records.

- Linear blocker comments, Proof Packet comments, status notes, PR bodies created by this workflow, and final user handoff summaries should use `output.language`.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing external labels/status names.
- Subagent briefs may keep technical source wording, but the main agent must normalize any human-facing Linear or PR text to `output.language` before writing it.

## Preflight

1. Locate the project root and read `.vibeRig/project.yaml`, including `output.language`, `workspace.worktrees_root`, and `pull_request` when present.
2. Resolve Linear project/team ids from YAML or Linear search:
   - use `_list_projects` or `_search` when `.vibeRig/project.yaml` is missing project identifiers or the recorded project cannot be trusted
   - use `_list_issue_statuses` to understand the team's workflow states before moving issues
3. Resolve the entry point (task ID/title or requirement ID/title):
   - use `_get_issue` for a named ID; use `_search` or `_list_issues` for title-based lookup
   - if multiple plausible issues match, list them and ask the user to choose before proceeding
   - if the resolved issue is a **requirement/parent issue**, use `_list_issues` (filtered by `parent`) to enumerate all sub-tasks; these form the execution queue
   - if the resolved issue is a single **task** (no children), the queue contains only that one issue
4. For each issue in the queue, read its description and comments for source doc paths, acceptance IDs, validation expectations, and recommended subagent:
   - use `_get_issue` for issue details
   - use `_list_comments` for proof packets, blockers, and prior handoff notes
5. Read only the referenced local docs needed for the current task.
6. Decide the workspace once for the entire execution queue using the Worktree Policy. For requirement-level entry points, use the parent issue key to name the worktree and branch. Prepare the worktree before the per-task loop starts — do not re-create or re-decide per subtask.
7. Resolve branch and PR policy, including provider, base branch, draft setting, and whether PR submission is required.
8. Build a compact Task Brief for the subagent.

## Task Brief

Read `assets/task-brief-template.md` before delegation and fill it with the resolved Linear issue, source docs, acceptance IDs, validation expectations, workspace decision, and pull request policy.

## Workflow

The workflow runs once per task in the execution queue. When the entry point is a requirement, repeat steps 1–10 for each subtask in order using the **shared worktree** prepared in Preflight. Each subtask commits its changes to the shared branch when done. Push and PR creation happen once after all subtasks complete.

**Per-task loop** (repeat for each task in the queue):

1. Select the appropriate subagent capability using `subagent-routing`.
   - If no suitable subagent exists or subagent tooling is unavailable, stop before implementation and report the missing capability instead of silently executing the Linear task directly.
2. Move the Linear issue to the closest `In Progress` state with `_save_issue` when work starts, unless it is already in an equivalent active state.
3. Delegate the Task Brief to that subagent.
4. Inspect the returned work, changed files, and stated evidence.
5. Run main-agent validation:
   - targeted tests
   - build/lint/typecheck when required by `.vibeRig/project.yaml`
   - manual checks when automation is impossible
   - acceptance coverage review against AC ids
6. If validation fails, send a bounded rework brief to the same or better subagent. Include failed evidence and expected correction.
7. Stop and ask the user when the same issue family fails repeatedly, external credentials are missing, scope conflicts with docs, or product decisions are required.
8. When validation is sufficient, commit the task-scoped changes to the shared branch:
   - inspect `git status` and `git diff` from the selected workspace
   - commit only task-scoped changes with a descriptive message referencing the Linear issue key
   - capture the commit hash for the Proof Packet
   - **do not push or create a PR here for requirement-level runs** — push and PR creation happen after all subtasks complete (see post-loop step 11)
   - for single-task runs: push the branch and create or update the PR immediately; capture PR URL, branch, commit, base branch, and any CI/check URL
9. (Single-task runs only) If PR submission is required and fails, write a Linear blocker/comment with `_save_comment`, move/update the Linear issue to the closest blocked/waiting state with `_save_issue`, and stop before reporting completion.
10. Write a Linear Proof Packet comment with `_save_comment` and move the Linear issue to the closest `In Review` or `QA` state with `_save_issue`:
    - include workspace, branch, commit hash, validation results, AC coverage, and residual risks
    - for requirement-level runs: PR URL is not yet available; it will be added after all subtasks complete in post-loop step 11
    - for single-task runs: include the PR URL
    - do not move requirement-level subtasks to `Human Acceptance` here — that state is set on the parent issue after the PR is created

**After all tasks in the queue are complete:**

11. For requirement-level runs: push the shared branch and create ONE PR covering all subtask changes:
    - include all Linear sub-issue keys, combined AC coverage, and validation evidence in the PR body
    - capture the PR URL; add it to each subtask's existing Proof Packet comment via `_save_comment`
    - if push or PR creation fails, write a blocker comment on the parent issue with `_save_comment` and stop before reporting completion
12. Update the parent issue status to the closest `Human Acceptance` or waiting-for-review state to reflect that all subtasks have been submitted.
13. Tell the user which tasks were completed, which (if any) are blocked, and that final acceptance for each task (and the parent requirement) requires explicitly invoking `accept` or `accept-bug` with the accepted/rejected AC ids. Tell the user that PR merge and worktree cleanup happen only in `accept` after full acceptance.

## Proof Packet Comment

Fill [proof-packet-template.md](./assets/proof-packet-template.md) and post it as a single Linear comment via `_save_comment`.

Render human-readable headings and prose in `.vibeRig/project.yaml` `output.language`; keep technical identifiers unchanged.

Do not duplicate the proof packet into `.vibeRig/`.

## Human Acceptance Boundary

`task-runner` can prove that implementation and automated validation are complete. It cannot perform final human acceptance.

After proof is posted and the required PR exists, leave the Linear issue in the closest available human-acceptance/review state. The user must explicitly call `human-acceptance` to record accepted/rejected AC ids, merge the PR on full acceptance, move the issue to a terminal status, trigger post-acceptance insights and approved skill updates through `skill-builder`, archive accepted requirement docs, and then clean up the task worktree when safe.

## Red Flags

- A subagent was not used for a Linear task execution → stop; only trivial reads can bypass `subagent-routing`.
- Implementation started in the current main workspace without explicit user authorization → move to a worktree or ask the user.
- Proof Packet was written before PR creation succeeded → reverse the order; PR URL must be in the proof.
- Linear issue was moved to `Done`/`Accepted` from this skill → only `human-acceptance` may set terminal success states.
- The subagent received the full requirement doc instead of a compact Task Brief → the brief must be bounded; feeding full docs to a subagent inflates context and hides the actual objective.
- Changed files were not inspected by the main agent before the Proof Packet was written → the main agent must read changed files and run validation independently; subagent claims are not evidence.
- Rework was sent to the same subagent with the same brief after a repeated failure → repeated failures require changing the approach or escalating; re-sending the same brief does not converge.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The task is simple enough that I can skip the subagent" | Simplicity is not the criterion. Every Linear task execution must declare and use a subagent through `subagent-routing`. |
| "I'll work in the current workspace since worktree setup is slow" | Worktree isolation protects unrelated user changes. Silent fallback to the main workspace is the bug, not the optimization. |
| "Each subtask needs its own worktree for isolation" | Subtasks within a requirement have dependencies — they must build on each other's commits. One shared worktree per run, named after the parent issue key. Per-subtask worktrees break the dependency chain and create multiple PRs where one suffices. |
| "I'll write the proof packet now and add the PR URL later" | The PR URL is proof that the work reached the right branch. A proof without it is incomplete evidence. |
| "Validation passed, so I can move the issue to Done" | Done is a terminal state that requires human acceptance. Move to the human-acceptance queue and stop here. |
| "The subagent said it passed, so I'll trust the result" | Subagent claims are not verified evidence. The main agent must run the commands and read the output independently before writing the Proof Packet. |
| "I'll send the whole requirement doc to the subagent for full context" | Full-doc context inflates tokens and obscures the task goal. Provide only the Task Brief, relevant AC ids, and needed file paths. |

## Verification Checklist

```bash
# Worktree is active (for worktree mode)
git worktree list | grep -q "<worktree-path>" && echo "ok" || echo "WORKTREE MISSING"

# PR was created
gh pr view --json url 2>/dev/null | grep -q "url" && echo "ok" || echo "NO PR"
```

- [ ] `subagent-routing` was used and a subagent was selected with a bounded Task Brief.
- [ ] Main agent independently ran validation commands and read the output — did not rely solely on subagent claims.
- [ ] Diff was inspected before commit; no unrelated changes included.
- [ ] Validation commands map to AC ids from the source docs.
- [ ] Proof Packet includes workspace, branch/commit/PR, validation, AC coverage, and residual risks.
- [ ] Linear issue is in human-acceptance/review state, not a terminal done state.
- [ ] Human-facing Linear comments use `output.language`.

## Final Response

Report:

- Linear issue key/url
- workspace mode and path
- subagent used
- files changed
- validation result
- branch/commit/PR URL
- proof packet status
- human acceptance status and unresolved risk
