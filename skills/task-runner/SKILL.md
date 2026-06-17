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

## Input Contract

Required:

- Target Linear issue key/url or enough project context to locate the next actionable issue.
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

Before implementation, explicitly decide where the task will run. This workspace decision is separate from the branch decision.

Workspace modes:

- `worktree`: default. Create or reuse an isolated git worktree for the Linear issue.
- `current-workspace`: explicit exception. Use only when the user explicitly asks to work in the main/current workspace, or explicitly authorizes it after worktree creation fails.

For `worktree` mode:

- Worktree root: use `workspace.worktrees_root` from `.vibeRig/project.yaml`; default to the project `.worktrees/` directory.
- Worktree directory pattern: project `.worktrees/` plus issue key and short slug.
- Preferred branch naming: `codex/{issue-key}-{short-slug}` when a branch is needed.
- Create or reuse the task branch inside the selected worktree.
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
3. Resolve the target Linear issue:
   - use the issue named by the user when provided
   - otherwise find the next actionable issue in the registered Linear Project
   - if multiple plausible issues exist, ask the user to choose
   - use `_get_issue` for a named issue and `_list_issues` for project/team queues
4. Read the Linear issue description and comments for source doc paths, acceptance IDs, validation expectations, and recommended subagent:
   - use `_get_issue` for issue details
   - use `_list_comments` for proof packets, blockers, and prior handoff notes
5. Read only the referenced local docs needed for the task.
6. Decide the workspace using the Worktree Policy and prepare the worktree when selected.
7. Resolve branch and PR policy, including provider, base branch, draft setting, and whether PR submission is required.
8. Build a compact Task Brief for the subagent.

## Task Brief

Read `assets/task-brief-template.md` before delegation and fill it with the resolved Linear issue, source docs, acceptance IDs, validation expectations, workspace decision, and pull request policy.

## Workflow

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
8. When validation is sufficient, submit the PR:
   - inspect `git status` and `git diff` from the selected workspace
   - commit only task-scoped changes
   - push the task branch
   - create or update the PR
   - capture PR URL, branch, commit, base branch, and any CI/check URL
9. If PR submission is required and fails, write a Linear blocker/comment with `_save_comment`, move/update the Linear issue to the closest blocked/waiting state with `_save_issue`, and stop before requesting human acceptance.
10. When validation and required PR submission are sufficient, write a Linear proof packet comment and move/update the Linear issue to the closest `Human Acceptance`, waiting-for-review, or QA state:
   - use `_save_comment` for the Proof Packet comment
   - use `_save_issue` for issue status, labels, assignee, links, project, or relation updates
11. Tell the user that final acceptance requires explicitly invoking `human-acceptance` with the accepted/rejected AC ids or an "all accepted" decision. Tell the user that PR merge and worktree cleanup happen only in `human-acceptance` after full acceptance.

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

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The task is simple enough that I can skip the subagent" | Simplicity is not the criterion. Every Linear task execution must declare and use a subagent through `subagent-routing`. |
| "I'll work in the current workspace since worktree setup is slow" | Worktree isolation protects unrelated user changes. Silent fallback to the main workspace is the bug, not the optimization. |
| "I'll write the proof packet now and add the PR URL later" | The PR URL is proof that the work reached the right branch. A proof without it is incomplete evidence. |
| "Validation passed, so I can move the issue to Done" | Done is a terminal state that requires human acceptance. Move to the human-acceptance queue and stop here. |

## Validation

```bash
# Worktree is active (for worktree mode)
git worktree list | grep -q "<worktree-path>" && echo "ok" || echo "WORKTREE MISSING"

# PR was created
gh pr view --json url 2>/dev/null | grep -q "url" && echo "ok" || echo "NO PR"
```

- [ ] `subagent-routing` was used and a subagent was selected.
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
