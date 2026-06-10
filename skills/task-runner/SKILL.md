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
- `.vibeRig/project.yaml`: Linear registration, docs root, worktrees root, pull request policy, gate policy, and default subagent routing.
- Current git workspace: implementation changes, branch/commit/PR, and validation evidence.

## Hard Rules

- Every Linear task execution must declare and use a suitable subagent through `subagent-routing`.
- Default to an isolated git worktree for all task execution work. Direct development in the current main workspace is allowed only when the user explicitly asks to modify the main/current workspace.
- Subagents must not use context-mode.
- Subagents must not update Linear, project status, acceptance status, or final proof.
- The main agent owns context-mode, final validation, acceptance mapping, Linear comments, and status updates.
- Do not call `codex-cli-mcp`, `codex mcp-server`, shell-launched Codex, or local backend automatic execution.
- Do not call VibeRig dashboard/task-engine MCP tools or HTTP routes.
- Do not create or rely on `tasks.yaml`.
- Do not write a local long-term proof packet directory. Proof packets are Linear comments referencing durable logs, CI URLs, commits, branches, changed files, and local docs.
- Do not mark a Linear issue complete or done from this skill. Move validated work to a human-acceptance/review state and require the `human-acceptance` skill for final human sign-off.
- When `pull_request.required` is true or absent, do not finish a successful implementation without creating or updating a PR and recording its URL.
- Do not merge the PR or remove the task worktree from this skill. Merge and cleanup belong to `human-acceptance` after explicit user acceptance.

## Worktree Policy

Before implementation, explicitly decide where the task will run:

- Default: create or reuse an isolated git worktree for the Linear issue.
- Worktree root: use `workspace.worktrees_root` from `.vibeRig/project.yaml`; default to the project `.worktrees/` directory.
- Worktree directory pattern: project `.worktrees/` plus issue key and short slug.
- Preferred branch naming: `codex/{issue-key}-{short-slug}` when a branch is needed.
- Use the current main workspace only when the user explicitly asks to work in the main/current workspace.
- When using the current workspace, inspect dirty files first and protect unrelated user changes.
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

## Preflight

1. Locate the project root and read `.vibeRig/project.yaml`, including `workspace.worktrees_root` and `pull_request` when present.
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
6. Main agent may use context-mode to summarize prior context, docs, and code search results.
7. Decide the workspace using the Worktree Policy and prepare the worktree when selected.
8. Resolve branch and PR policy, including provider, base branch, draft setting, and whether PR submission is required.
9. Build a compact Task Brief for the subagent.

## Task Brief

```markdown
## Goal
<task goal from Linear>

## Source Docs
- .vibeRig/requirements/<requirement-id>/brief.md#...
- .vibeRig/requirements/<requirement-id>/architecture.md#...
- .vibeRig/requirements/<requirement-id>/acceptance.md#...

## Acceptance
- AC-...: <expected result>

## Constraints
- <scope boundaries>
- do not revert unrelated user changes
- no context-mode inside subagent
- no Linear updates inside subagent

## Validation
- <commands/manual checks>

## Workspace
- mode: <worktree | current-workspace>
- path: <absolute path>
- reason: <why this mode was selected>

## Pull Request
- required: <true | false>
- provider: <auto | github | other>
- branch: <codex/<issue-key>-<short-slug>>
- base: <base branch or repository default>
- draft: <true | false>

## Output Contract
- changed files
- validation attempted
- acceptance coverage
- residual risks
- handoff notes
```

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

Post one concise Linear comment containing:

- issue key and task goal
- workspace mode and path
- branch/commit/PR URL
- PR provider, base branch, draft/ready state, and CI/check URL when available
- changed files summary
- validation commands and results
- CI/log links when available
- acceptance IDs covered
- acceptance IDs not covered and why
- manual checks needed
- subagent used and subagent handoff notes
- residual risks

Do not duplicate the proof packet into `.vibeRig/`.

## Human Acceptance Boundary

`task-runner` can prove that implementation and automated validation are complete. It cannot perform final human acceptance.

After proof is posted and the required PR exists, leave the Linear issue in the closest available human-acceptance/review state. The user must explicitly call `human-acceptance` to record accepted/rejected AC ids, merge the PR on full acceptance, move the issue to a terminal status, trigger post-acceptance insights and approved skill updates through `skill-builder`, archive accepted requirement docs, and then clean up the task worktree when safe.

## Validation

Before final reporting, verify:

- The task used `subagent-routing` and a suitable subagent, or stopped before implementation when none was available.
- The selected workspace was inspected for dirty state and unrelated user changes were protected.
- Validation commands/manual checks map to acceptance IDs and project gate policy.
- The diff was inspected before commit/PR.
- Required PR creation/update succeeded before requesting human acceptance.
- The Linear Proof Packet includes workspace, branch/commit/PR, validation, AC coverage, subagent evidence, and residual risks.

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
