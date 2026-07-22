---
name: skillos-lite
description: Curate insert/update/deprecate/noop proposals for the VibeRig skill library only when the user explicitly requests a skill-library audit or SkillOS-style curation. Do not run from acceptance, insights, or default self-learning, and never apply changes directly.
---

# SkillOS Lite

Use this skill to convert an explicit user request plus accepted-work evidence into conservative skill-library curation proposals.

This is a proposal generator only. It must not directly edit `skills/*/SKILL.md`, `AGENTS.md`, user memory, or workflow rules.

## Contract

Use this skill to propose `insert`, `update`, `deprecate`, or `noop` operations for VibeRig skills when the user explicitly asks to curate the skill library.

Do not use this skill for implementation, validation, final human acceptance, default self-learning, automatic post-acceptance finalization, speculative memory capture, direct skill edits, or learning from failed/unmerged/unaccepted work. `insights` and `vb-wiki` must not invoke it automatically; creation of one user-approved global tool skill belongs to `vb-learn`.

Stop with `noop` when accepted evidence is missing, the affected skill cannot be identified, the proposed change would rely on abandoned attempts, or the risk cannot be bounded from the evidence.

## Input Contract

Required:

- Explicit current-conversation request to audit or curate the VibeRig skill library.
- Accepted Linear issue, PR, commit, or explicit user authorization tied to accepted work.
- Human acceptance evidence or terminal accepted/done status.
- Proof packet, validation result, review note, or equivalent evidence.

Optional:

- Requirement docs under `.vibeRig/requirements/{requirement-id}/`.
- Linear comments, proof packet comments, review comments, git diff, changed files, CI links, screenshots, and logs.
- Related skill paths under `skills/`.

If explicit curation authority or required evidence is missing, return a `noop` proposal explaining the missing boundary.

## Output Contract

Return structured curation proposals. Each proposal must include:

- `id`: stable local proposal id.
- `operation`: `insert`, `update`, `deprecate`, or `noop`.
- `target_skill`: existing skill directory name, proposed new skill directory name, or empty for `noop`.
- `change_summary`: one-line description of the proposed change.
- `evidence`: accepted-work evidence references.
- `confidence`: `high`, `medium`, or `low`.
- `risk`: `low`, `medium`, or `high`.
- `validation_plan`: how `skill-builder` or a reviewer should validate the change.
- `requires_confirmation`: always `true` except `noop`.

Do not report a curation proposal as applied. Confirmed `insert`, `update`, and `deprecate` proposals must be handed to `skill-builder`.

## Operation Rules

- `insert`: propose a new skill only when the accepted work demonstrates a reusable workflow that does not fit an existing skill.
- `update`: propose changing an existing skill when accepted evidence shows a missing rule, validation step, trigger wording, or workflow guard.
- `deprecate`: propose marking a skill as deprecated only after repeated accepted evidence shows it is duplicated, misleading, stale, or risky. Prefer deprecation over deletion.
- `noop`: use when no durable skill change is justified.

Never propose physical deletion from a single accepted task.

## Workflow

1. Confirm the user explicitly requested skill-library curation. A request to “learn”, “record experience”, or accept delivered work is not sufficient; redirect those cases to `vb-wiki`.
2. Read `.vibeRig/project.yaml` and use `output.language` for human-facing summaries.
3. Confirm the accepted-work boundary from Linear, proof packet, PR merge, or explicit user authorization.
4. Build a compact evidence bundle:
   - accepted AC ids and residual risk decision
   - validation commands and results
   - PR, commit, and changed files
   - Linear review comments and proof packet findings
   - relevant requirement docs
5. Identify related skills by matching evidence against `skills/*/SKILL.md` names, descriptions, contracts, and validation sections.
6. Classify the curation need as `insert`, `update`, `deprecate`, or `noop`.
7. Score confidence and risk:
   - `high` confidence requires direct accepted evidence and a narrow target.
   - `medium` confidence fits plausible but incomplete evidence.
   - `low` confidence is only a prompt for human review.
   - `high` risk changes future workflow gates, acceptance policy, security boundaries, or broad routing behavior.
8. Emit proposals using `references/proposal-schema.md`.
9. If a proposal is confirmed by the user, invoke `skill-builder` with the target skill, change summary, evidence, and validation plan. Do not edit the skill directly.

## Context Loading

Read only when needed:

- `references/proposal-schema.md`: read before emitting structured proposals.

Avoid reading unrelated skill packages. Inspect only skills that plausibly match the accepted evidence.

## Red Flags

- A non-`noop` proposal was generated without accepted-work evidence → all non-`noop` operations require evidence tied to accepted, merged, or user-authorized work.
- This skill was called automatically from `insights`, `vb-wiki`, or an acceptance workflow → stop; default learning writes wiki knowledge and never performs library curation.
- `confidence: high` was assigned to a proposal based on a single task → high confidence requires direct and narrow evidence; one task is usually medium.
- A proposal directly edits a skill file instead of returning a structured proposal → `skillos-lite` is proposal-only; hand confirmed proposals to `skill-builder`.
- An `insert` proposal duplicates a capability that already exists in an existing skill → inspect `skills/*/SKILL.md` names, descriptions, and contracts before proposing a new skill.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The accepted task is clear evidence for a broad workflow change" | Broad workflow changes require repeated accepted evidence across multiple tasks, not a single success. Narrow the scope or lower the confidence. |
| "The skill edit is small, I'll apply it directly and skip skill-builder" | Any skill edit — small or large — must go through `skill-builder` for frontmatter validation, reference checks, and trigger quality validation. Direct edits bypass all of those. |
| "I'll propose a new skill since the pattern was useful in this task" | Ask: does this fit an existing skill? Check contracts and descriptions first. A new skill that duplicates existing guidance fragments the trigger space. |

## Validation

Before reporting proposals, verify:

```bash
# Confirm related skill directories exist for update/deprecate proposals
ls skills/<target_skill>/SKILL.md 2>/dev/null && echo "ok" || echo "SKILL NOT FOUND"
```

- [ ] Every non-`noop` proposal is tied to accepted work.
- [ ] The current conversation explicitly requested skill-library curation.
- [ ] Every non-`noop` proposal has evidence, target, confidence, risk, and validation plan.
- [ ] `requires_confirmation` is `true` for `insert`, `update`, and `deprecate`.
- [ ] No proposal directly applies a skill update.
- [ ] Human-facing prose follows `.vibeRig/project.yaml` `output.language` when configured.
