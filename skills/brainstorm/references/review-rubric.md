# Review Rubric

Use this checklist before finishing. Fix issues directly in the generated documents.

## Result-Only Check

- No brainstorming transcript.
- No chronological research log.
- No internal reasoning.
- No "I considered..." process notes.
- Rejected options appear only as meaningful tradeoffs.
- Each generated document preserves the relevant `Why`, `What`, `Who`, and `How` information for its phase, even when the final document does not use those labels as headings.

## Requirement Check

- `requirement.md` has goals, non-goals, candidate requirements, assumptions, constraints, and open questions.
- Business rules are labeled as assumptions unless explicitly sourced.
- Source links are retained when relevant.

## Research Check

- `research.md` separates facts, inferences, assumptions, and open questions.
- GitHub repository research uses DeepWiki MCP when available.
- Ordinary URL research uses Browser when available.
- Technical risks have validation tasks, mitigations, or open questions.

## Acceptance Check

- Every major requirement has at least one acceptance point.
- Manual acceptance is separated from automated acceptance.
- Automated and manual acceptance points use stable IDs that downstream task plans can reference.
- `acceptance.md` does not invent task IDs before task splitting.
- Manual acceptance points include why human judgment is required and concrete pass criteria.
- Boundary, risk, and regression scenarios are represented.
- Pass criteria are concrete.

## Roadmap Check

- Phases are sequenced by dependency and risk.
- High-risk findings from `research.md` have mitigation or validation tasks.
- Tasks are reviewable and not overly granular.

## Spec Check

- Recommended implementation direction is consistent with `research.md`.
- Design covers relevant modules, interfaces, data, state/process flow, errors, compatibility, and tests.
- Open questions that block implementation are explicit.

## Cross-Document Check

- Terms and names are consistent across files.
- `acceptance.md` covers `requirement.md`.
- `roadmap.md` reflects `research.md` and `acceptance.md`.
- `spec.md` implements the recommended technical direction.
- Task-to-acceptance mapping is left for `write-plan` unless `plan.md` or `tasks.yaml` already exists.
