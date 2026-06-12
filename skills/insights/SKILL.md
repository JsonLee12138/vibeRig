---
name: insights
description: Generate VibeRig post-acceptance retrospectives and learning candidates from accepted Linear work. Use after validation, acceptance review, and code review pass; when asked to summarize accepted VibeRig work; or when applying confirmed learning candidates. Do not use during active implementation except to read confirmed project learnings. When applying any skill_update that creates or modifies skills/*/SKILL.md, invoke skill-builder and follow its validation contract.
---

# Insights

Use this skill to turn accepted VibeRig work into conservative learning candidates.

Linear comments and local Docs as Code are the primary evidence sources. VibeRig no longer relies on local task-engine evidence directories or local proof packet files.

## Contract

Use this skill to generate or apply conservative learning candidates from accepted VibeRig work.

Do not use this skill for active implementation, task execution, final acceptance, or unreviewed memory capture. Use `task-runner` for execution and `human-acceptance` for sign-off.

Stop before applying a learning when evidence is not tied to accepted work, the user has not confirmed the candidate, or the change would modify a skill without routing through `skill-builder`.

## Operating Boundary

- Do not learn from all conversations.
- Do not learn during active implementation.
- Do not learn from failed, abandoned, unmerged, or unaccepted work.
- Do not modify other skills or user memory unless the user explicitly confirms.
- For every confirmed `skill_update` that adds or changes a skill package, invoke `skill-builder` first and follow its contract for trigger wording, resource planning, file edits, and validation.
- When called from `human-acceptance`, use the explicit human acceptance comment as the acceptance boundary.
- During implementation, read confirmed project learnings when present, but do not write new learnings.

## Input Contract

Required:

- Accepted Linear issue, PR, commit, or explicit user request for retrospective/application.
- Evidence that the work was accepted or the user explicitly authorized retrospective generation.

Optional:

- Requirement docs, validation logs, CI links, screenshots, review notes, proof packet comments, or confirmed learning candidates.

If acceptance evidence is missing, produce no durable learning and ask for the missing acceptance boundary.

## Valid Triggers

Use this skill when one of these is true:

- A Linear issue or sub-issue has passed validation and review.
- A PR or handoff tied to a Linear issue was accepted.
- `human-acceptance` has recorded explicit acceptance for a Linear issue and requests post-acceptance insights.
- The user asks for a VibeRig retrospective, accepted-work insights, or learning candidates.
- The user asks to apply reviewed learning candidates.

## Evidence Sources

Prefer explicit evidence over conversation memory:

1. Linear issue description, status, comments, proof packet, and linked PR/commit.
2. `.vibeRig/requirements/{requirement-id}/brief.md`
3. `.vibeRig/requirements/{requirement-id}/contract.json`
4. `.vibeRig/requirements/{requirement-id}/architecture.md`
5. `.vibeRig/requirements/{requirement-id}/acceptance.json`
6. `.vibeRig/requirements/{requirement-id}/acceptance.md`
7. `.vibeRig/requirements/{requirement-id}/validation.md`
8. Git diff, commits, PR description, and changed files
9. Validation output, CI URLs, screenshots, logs, and manual review notes
10. context-mode evidence only from the main agent when available

## Language Policy

Read `.vibeRig/project.yaml` and use `output.language` for human-facing retrospectives and learning reports.

- Linear retrospective comments, user-facing summaries, Linear documents created by this workflow, and local learning reports should use `output.language`.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, candidate type names, or existing external labels/status names.

## Workflow

1. Confirm the work is accepted or explicitly authorized for retrospective generation. Read `references/post-acceptance-retrospective.md` and follow its gate and evidence-bundle flow.
2. Read `.vibeRig/project.yaml`, including `output.language`, and the referenced requirement docs.
3. Read Linear proof packet comments and linked implementation evidence:
   - use `_get_issue` for issue status, description, branch, links, and relations
   - use `_list_comments` for Proof Packet comments and reviewer handoff notes
4. Optionally use `subagent-routing` for independent review or domain-specific insight analysis.
5. Generate learning candidates:
   - project facts and commands
   - validation improvements
   - acceptance gaps
   - architecture or process risks
   - proposed skill/rule updates
6. Auto-apply only candidates that pass every rule in `references/learning-policy.md`. When in doubt, do not auto-apply.
7. Leave workflow rules, skill updates, and user preferences for explicit user confirmation.
8. When applying a confirmed `skill_update`, invoke `skill-builder` with these inputs:
   - **skill name or path**: the `target_skill` from the candidate (e.g., `task-runner` or `skills/task-runner/`)
   - **change request**: a natural-language description combining the `change_summary` and `evidence` so skill-builder can understand what to change and why
   - **target section hint**: the `section` field to help skill-builder locate the edit target
   Do not hand-edit skill files from `insights` without `skill-builder`. Let `skill-builder` perform the edit, validate frontmatter, confirm references, and report the result.

## Candidate Types

- `project_note`: accepted project facts, commands, paths, conventions, and validation entry points.
- `workflow_rule`: VibeRig process improvements proven by accepted work.
- `skill_update`: proposed changes to `skills/*/SKILL.md`. Must include:
  - `target_skill`: directory name under `skills/` (e.g., `task-runner`)
  - `change_summary`: one-line description of what should change and why
  - `evidence`: the accepted work evidence that motivated this change
  - `section`: the SKILL.md section to modify (e.g., `## Workflow`, `## Validation`, `## Common Mistakes`)
  - `confidence`: `high` | `medium` | `low`
- `user_preference`: durable user preference, always requiring explicit confirmation.

## Output Contract

Prefer a Linear comment or user-facing summary for retrospectives. Format retrospectives using `references/report-template.md`. Use `_save_comment` when writing a retrospective back to the Linear issue. Use `_save_document` only when the user explicitly wants a Linear document-level retrospective or project learning note. Only write local files when the project already has an approved local learning location or the user asks for one.

Do not write proof packets into `.vibeRig/`.

For skill changes, invoke `skill-builder` and report its result: changed file paths, the trigger intent captured in the updated description, any resources added or omitted, validation performed, and remaining gaps. If skill-builder reports validation failures, surface them to the user as pending follow-up.

## Validation

Before reporting completion, verify:

- Evidence is tied to accepted work or the user explicitly authorized retrospective generation.
- Each candidate has a type, evidence source, confidence, and risk.
- Durable project notes are high-confidence and low-risk.
- Workflow rules, skill updates, and user preferences were not applied without explicit user confirmation.
- Any skill file creation or modification was performed through `skill-builder`.
- Human-facing retrospectives, Linear comments, documents, and summaries use `output.language` when configured.
