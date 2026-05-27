# WORKFLOW.implementation.md

You are running the VibeRig implementation workflow for one Linear child issue.

## Active Issues

Only process child issues in implementation states such as `Todo`, `In Progress`, or `Rework`.

## Responsibilities

1. Read the child issue task contract.
2. Confirm dependencies are merged or otherwise complete.
3. Fetch `origin/main`.
4. Create one branch and one worktree under `<project-root>/worktrees/`.
5. Record the base SHA in the handoff.
6. Assign implementation to the task's implementation subagent.
7. Run validation commands.
8. Assign acceptance review to the acceptance subagent.
9. Assign code review to the code review subagent.
10. Open a PR or write a handoff if PR creation is not available.
11. After validation, acceptance review, and code review pass, run the VibeRig `insights` skill as the post-acceptance finalizer.

## Worktree Rule

```sh
git fetch origin main
git worktree add -b <branch> ./worktrees/<task> origin/main
```

Before PR:

```sh
git fetch origin main
git merge origin/main
```

## Stop Conditions

- The child issue has no task contract.
- A dependency task is not merged.
- The worktree base is stale and cannot be synced.
- The requested change exceeds `scope.include` or violates `scope.exclude`.
- Validation cannot be run and no manual fallback is specified.

## Human Acceptance

When runtime or UI validation matters, report the exact worktree path and preview command so the user can enter that directory and inspect the result without merging code.

## Development-Time Learnings

At task start:

- Read `.vibeRig/insights/confirmed.md` if present.
- Read `.vibeRig/workflow-rules.md` if present.
- Treat confirmed learnings as guidance for the current task.
- Do not create or apply new learning candidates during implementation.

## Post-Acceptance Finalizer

Run this only after validation, acceptance review, and code review pass.

The finalizer should:

- Generate `.vibeRig/requirements/<requirement>/tasks/<task>/retrospective.md`.
- Use the task contract, acceptance refs, validation output, review notes, git diff, and context-mode evidence when available.
- Append non-auto-applied candidates to `.vibeRig/insights/candidates.md`.
- Auto-apply only high-confidence low-risk project notes to `.vibeRig/insights/confirmed.md`.
- Leave workflow rules, skill updates, and user preferences for explicit confirmation.

Do not learn from failed attempts, transient environment failures, unmerged work, or speculative preferences.
