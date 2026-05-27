---
name: insights
description: Generate VibeRig post-acceptance retrospectives and learning candidates. Use after Symphony validation, acceptance review, and code review pass; when asked to summarize accepted VibeRig work; when checking context-mode evidence; or when applying confirmed learning candidates. Do not use during active implementation except to read confirmed project learnings.
---

# Insights

Use this skill to turn accepted VibeRig work into auditable retrospectives and conservative learning candidates.

## Operating Boundary

- Do not learn from all conversations.
- Do not learn during active implementation.
- Do not learn from failed, abandoned, unmerged, or unaccepted work.
- Do not modify other skills or user memory unless the user explicitly confirms.
- During implementation, read `.vibeRig/insights/confirmed.md` and `.vibeRig/workflow-rules.md` when present, but do not write new learnings.

## Valid Triggers

Use this skill when one of these is true:

- Symphony planning review passed and child issues were created.
- Symphony implementation validation, acceptance review, and code review passed.
- A PR or handoff was accepted for a VibeRig child task.
- The user asks for a VibeRig retrospective, accepted-work insights, or learning candidates.
- The user asks to apply reviewed learning candidates.

## Evidence Sources

Prefer explicit evidence over conversation memory:

1. `.vibeRig/requirements/<REQ>/tasks.yaml`
2. `.vibeRig/requirements/<REQ>/acceptance.md`
3. `.vibeRig/requirements/<REQ>/spec.md`
4. `.vibeRig/requirements/<REQ>/plan.md`
5. Git diff, commits, PR description, and changed files
6. Validation output
7. Acceptance and code review notes
8. context-mode evidence if available

If context-mode tools are available, use them as supporting evidence. If not, continue with VibeRig artifacts and git evidence.

## Workflow

1. Confirm the work is accepted or explicitly authorized for retrospective generation.
2. Read confirmed learnings only as background context:
   - `.vibeRig/insights/confirmed.md`
   - `.vibeRig/workflow-rules.md`
3. Gather the task or requirement evidence.
4. Optionally query context-mode for relevant session evidence using `ctx_search`, `ctx_stats`, or `ctx_insight` when available.
5. Generate:
   - `.vibeRig/requirements/<REQ>/tasks/<TASK-ID>/retrospective.md` for task-level work
   - `.vibeRig/requirements/<REQ>/insights.md` for requirement-level aggregation
   - `.vibeRig/insights/candidates.md` updates for non-auto-applied candidates
6. Auto-apply only high-confidence low-risk `project_note` candidates to `.vibeRig/insights/confirmed.md`.
7. Leave `workflow_rule`, `skill_update`, and `user_preference` candidates for user confirmation.

## Candidate Types

- `project_note`: Accepted project facts, commands, paths, conventions, and validation entry points.
- `workflow_rule`: VibeRig or Symphony process improvements proven by accepted work.
- `skill_update`: Proposed changes to `skills/*/SKILL.md`.
- `user_preference`: Durable user preference, always requiring explicit confirmation.

## Policy

Follow `references/learning-policy.md`.

When generating reports, follow `references/report-template.md`.

When called by Symphony after an accepted gate, follow `references/post-acceptance-retrospective.md`.
