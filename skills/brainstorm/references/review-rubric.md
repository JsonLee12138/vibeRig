# Review Rubric

Use this checklist before finishing. Fix issues directly in the generated documents.

## Result-Only Check

- No brainstorming transcript.
- No chronological research log.
- No internal reasoning.
- No "I considered..." process notes.
- Rejected options appear only as meaningful tradeoffs.
- Each generated document preserves the relevant `Why`, `What`, `Who`, and `How` information for its phase, even when the final document does not use those labels as headings.
- Human-facing summaries and numbered points are concise enough for a user to review as `1`, `2`, `3`.
- No TBD, TODO, 待定, 待确认, open questions, unresolved blockers, unknowns, empty placeholder sections, or unresolved template text.
- Non-blocking uncertainty is written only as an approved working decision with rationale and a review trigger.

## Requirement Check

- `requirement.md` has numbered goals, numbered requirement points, non-goals, boundary decisions, business rules, constraints, and confirmed decisions.
- Requirement IDs such as `R1`, `R2`, and `R3` are stable and concrete enough for acceptance mapping.
- Business rules have an explicit source, approved decision, or review trigger.
- Source links are retained when relevant.

## Research Check

- `research.md` is human-facing and starts with concise numbered conclusions.
- Research-first output clearly labels requirement assumptions instead of treating them as approved requirements.
- `research.md` separates facts, inferences, and approved working decisions.
- GitHub repository research uses DeepWiki MCP when available.
- Ordinary URL research uses Browser when available.
- Technical risks have validation tasks, mitigations, or review triggers.

## Acceptance Check

- Every major requirement has at least one acceptance point.
- Acceptance phase writes both `acceptance.md` and `acceptance-human.md`.
- `acceptance-human.md` uses the same IDs and numbered order as `acceptance.md`; every major item maps one-to-one across the two files.
- Manual acceptance is separated from automated acceptance.
- Automated and manual acceptance points use stable IDs that downstream task plans can reference.
- `acceptance.md` does not invent task IDs before task splitting.
- Manual acceptance points include why human judgment is required and concrete pass criteria.
- Boundary, risk, and regression scenarios are represented.
- Pass criteria are concrete.

## Roadmap Check

- `roadmap.md` starts with a concise numbered human-facing summary before detailed planning content.
- Phases are sequenced by dependency and risk.
- High-risk findings from `research.md` have mitigation or validation tasks when research exists.
- Tasks are reviewable and not overly granular.

## Spec Check

- `spec.md` starts with a concise numbered human-facing summary before detailed implementation design.
- Recommended implementation direction is consistent with `research.md` when it exists.
- Design covers relevant modules, interfaces, data, state/process flow, errors, compatibility, and tests.
- No design question that blocks implementation remains in the written file; blocking questions are asked before writing.

## Cross-Document Check

- Terms and names are consistent across files.
- `acceptance.md` covers `requirement.md`.
- `acceptance-human.md` maps one-to-one to `acceptance.md`.
- `roadmap.md` reflects `research.md` when present and `acceptance.md`.
- `spec.md` implements the recommended technical direction.
- Task-to-acceptance mapping is left for `write-plan` unless `plan.md` or `tasks.yaml` already exists.
