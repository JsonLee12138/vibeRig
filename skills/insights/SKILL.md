---
name: insights
description: >-
  Create evidence-backed retrospectives immediately after explicit human
  acceptance, including accepted-but-unmerged Linear work, and write them to
  the scope's mapped Linear record host for vb-wiki; do not create skills.
---

# Insights

Compile the explicitly accepted outcome into a human-readable retrospective and a small set of evidence-backed signals. The mapped Linear record is the immediate handoff to `vb-wiki`; it is not itself the knowledge store and never authorizes a skill change.

## Contract

- Single responsibility: explain what was accepted, what evidence proves it, what friction mattered, and which signals may help future work.
- Explicit human acceptance is the only gate for a new retrospective. Run immediately after acceptance; do not wait for PR merge, the authoritative branch, or `accept-milestone`. Requirement aggregation may only replay completed child acceptance events and is never represented as a new human acceptance.
- For code-backed work, anchor every conclusion to the exact `accepted_commit`. Record merge state as provenance only. If content materially changes after acceptance, the changed result requires new acceptance and a new retrospective event.
- Write through `vb-linear`: Issue scopes use Issue comments; Milestone/requirement scopes use the registered Project's Project Updates. Do not invent Milestone comments or write `~/.vb-wiki`, `~/.vb-skills`, project skill files, user memory, or local proof packets.
- Do not generate `skill_update`, SkillOS curation proposals, skill names, or skill-creation questions. Tool-worthiness belongs exclusively to `vb-wiki` after its knowledge write succeeds.

## Input Contract

Acceptance-event mode requires:

- Accepted Issue, Milestone, requirement, PR, or explicit retrospective scope.
- An explicit human acceptance record plus validation/review evidence tied to the accepted outcome.
- A stable `acceptance_event.id` in the form `acceptance:<scope-id>:<accepted-source-fingerprint>:r<revision>`, resolved through [the acceptance learning state](references/acceptance-learning-state.md), so retries resume rather than duplicate.
- For code-backed work, the exact `accepted_commit`; for non-code work, the accepted final record.
- `delivery_state`: `accepted_unmerged`, `accepted_in_milestone`, `merged`, `authoritative_branch`, or `no_merge_required`.

Aggregation mode requires:

- `aggregate_only: true` and `event_kind: aggregation`;
- canonical `aggregation_event.id` computed from the exact nested child IDs by [the acceptance learning state](references/acceptance-learning-state.md);
- `aggregation_event.derived_from`: every completed child acceptance event; resolve each ID to its retrospective comment.

Aggregation has no `human_accepted` field and may not introduce a claim absent from its child events.

Optional:

- Requirement docs, Proof Packet comments, CI links, screenshots, logs, owner UAT notes, merge-result evidence, and residual-risk decisions.
- `prior_acceptance_events` for a Milestone retrospective; already processed Issue signals are cited, while only cross-Issue/integration/UAT delta enters the new signal list.

In acceptance-event mode, missing explicit acceptance returns `deferred: acceptance_missing` with no comment. In aggregation mode, any missing/incomplete child event returns `deferred: child_acceptance_incomplete`. `accepted_unmerged` is valid and must not be deferred.

## Evidence Sources

Prefer explicit evidence over conversation memory. For a Milestone, use all Issues/sub-issues at the accepted integration commit but emit only signals not already covered by `prior_acceptance_events`; for a requirement, aggregate completed accepted Milestone retrospectives without making new claims.

1. Linear descriptions, relations, statuses, comments, Proof Packets, acceptance comments, and optional merge-result comments.
2. `.vibeRig/requirements/{requirement-id}/requirement.yaml`, `intake.md`, `acceptance.json`, and other approved requirement contracts.
3. Accepted git diff/commit, PR description, CI, validation output, screenshots, logs, and review notes.

Never treat abandoned attempts, transient environment failures, unaccepted code, or unsupported conversation recollection as accepted evidence. An accepted but unmerged commit is valid evidence when the acceptance record identifies it exactly.

## Language Policy

Read `.vibeRig/project.yaml` and render the Linear record and user-facing report in `output.language`. Do not translate stable IDs, paths, commands, branch names, URLs, commit hashes, Linear keys, acceptance IDs, schema keys, or code symbols.

## Workflow

1. Read [the post-acceptance gate](references/post-acceptance-retrospective.md) and [the acceptance learning state](references/acceptance-learning-state.md). Select acceptance-event or aggregation mode; prove the corresponding gate and capture `delivery_state` without using it as a merge gate.
2. Read `.vibeRig/project.yaml`, resolve `output.language`, and gather the scope's authoritative Linear, requirement, accepted-commit, validation, and review evidence.
3. Build an evidence bundle conforming to [the insights schema](references/insights.schema.json). Acceptance mode names `acceptance_event`; aggregation mode stores child IDs only at `aggregation_event.derived_from` and verifies the canonical digest. Every code-backed acceptance bundle names `accepted_commit`; `merged_commit` is optional provenance.
4. Reconstruct the accepted outcome and material friction. Separate the accepted path from early or unaccepted paths that were replaced. For a Milestone, cite prior Issue events and compile only integration/UAT/cross-Issue delta.
5. Produce the minimum useful `retrospective_signals`. Each signal contains:
   - one evidence-backed statement;
   - confidence (`high` / `medium` / `low`);
   - exact evidence references;
   - applicability and scope hint (`project` / `global` / `unknown`);
   - invalidation signals, including post-acceptance content drift when relevant.
6. Put rejected material in `discarded_signals` with an explicit reason from [the retrospective-signal policy](references/learning-policy.md). Zero retrospective signals is a valid result; do not invent one.
7. Resolve the record host before writing: Issue → its comments; Milestone/requirement → registered Project Updates. Search that host for the exact typed report marker `<!-- VibeRig-Record: retrospective:<event-id> -->`, ignoring acceptance/phase records for the same event. Adopt exactly one complete matching retrospective; append exactly once only when none exists; fail closed on duplicate/malformed retrospective-kind matches. Render [the report template](references/report-template.md), ask `vb-linear` to append it to the same host, then persist/return the generic record reference for immediate `vb-wiki` use.

## Output Contract

Return:

- scope, event kind and event ID, acceptance/derived evidence, accepted source and `delivery_state` when applicable;
- Linear retrospective record reference (`comment_id` or `status_update_id`);
- retrospective-signal and discarded-signal counts;
- residual risks or the applicable deferred reason.

Do not claim completion unless the mapped record is written and every retrospective signal has evidence, applicability, and invalidation guidance.

## Red Flags

- A PR is explicitly accepted but unmerged → write the retrospective now with `delivery_state: accepted_unmerged`; never defer it for merge.
- A “learning candidate” names a skill or invokes `skillos-lite` / `skill-builder` → remove it; this skill only compiles retrospective signals.
- A signal has no source or no applicability boundary → discard it as insufficiently grounded.
- “Nothing reusable was learned” is treated as failure → correct it to a successful zero-signal retrospective.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| “The PR is not merged, so the retrospective must wait.” | The user's acceptance is the retrospective boundary; merge state is provenance. |
| “This looks reusable, so I should propose a skill.” | Reusability alone describes knowledge too. `vb-wiki` owns the later tool-promotion gate. |
| “A retrospective should preserve every detail.” | Linear and git preserve raw evidence; this output keeps only evidence needed to explain the accepted outcome and useful signals. |

## Validation

```bash
jq -e '.properties.acceptance_event and .properties.aggregation_event and .properties.delivery_state and .properties.retrospective_signals and .properties.discarded_signals and (.properties.durable_signals | not) and (.properties.learning_candidates | not)' \
  skills/insights/references/insights.schema.json
grep -q "Retrospective Signals" skills/insights/references/report-template.md
```

- [ ] Acceptance mode has explicit human acceptance; aggregation mode has only completed child events and no fabricated human gate.
- [ ] Code-backed evidence identifies `accepted_commit`; merge state did not gate the retrospective.
- [ ] Existing phase state was reused; Milestone output contains only delta beyond `prior_acceptance_events`.
- [ ] The exact operation marker resolved to zero or one structurally valid record in the mapped host; retry did not append a duplicate or search a nonexistent Milestone comment stream.
- [ ] Every retrospective signal has evidence, applicability, scope hint, confidence, and invalidation signals.
- [ ] No skill proposal, SkillOS action, wiki write, user-memory write, or project-skill edit occurred.
- [ ] Human-facing text uses `output.language`.
