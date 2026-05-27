# WORKFLOW.planning.md

You are running the VibeRig planning workflow for one Linear parent issue.

## Active Issues

Only process parent issues in the configured planning states, usually `Planning`.

## Responsibilities

1. Create or use a planning workspace for the target project.
2. Run the VibeRig `brainstorm` skill for the issue requirement.
3. Run the VibeRig `write-plan` skill to produce `plan.md` and `tasks.yaml`.
4. Validate `tasks.yaml`.
5. Render child issue contracts from `tasks.yaml`.
6. Create or update Linear child issues.
7. Move the parent issue to `Planned` or `Human Review`.
8. Run the VibeRig `insights` skill as a planning retrospective finalizer only after the review gate passes.

## Constraints

- Do not write business implementation code.
- Use `.vibeRig/requirements/<requirement>/` for planning artifacts.
- Use `<project-root>/worktrees/` as the implementation worktree root.
- Default base is `origin/main`.
- If required subagents are missing, ask whether to create them using `agent-creator`.
- Child issue descriptions must contain enough task contract detail to run without relying on unmerged planning files.
- Retrospectives must learn only from accepted planning outcomes, not from abandoned intermediate drafts.

## Review Gate

Before creating child issues, check:

- every task maps to acceptance refs
- every task has validation
- dependencies are explicit
- scope include/exclude is clear
- implementation, acceptance, and review agents are assigned separately when possible

## Insights Finalizer

After the review gate passes, generate a planning retrospective:

- Write `.vibeRig/requirements/<requirement>/insights.md`.
- Record learning candidates in `.vibeRig/insights/candidates.md`.
- Auto-apply only high-confidence low-risk project notes to `.vibeRig/insights/confirmed.md`.
- Do not update skills, workflow rules, or user memory without explicit confirmation.
- If context-mode is available, use it only as supporting evidence.
