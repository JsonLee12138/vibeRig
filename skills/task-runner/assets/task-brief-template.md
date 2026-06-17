# Task Brief Template

Use this Markdown template when delegating execution from `task-runner` to a selected subagent. Replace placeholders with resolved task details before sending the brief.

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
