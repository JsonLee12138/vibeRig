# Brainstorm Review Rubric

Use this after each stage and before handing off to `write-plan`.

## Brief

- Goals and non-goals are explicit and stable.
- Success signals are observable.
- Constraints, risks, and decisions have sources or approved assumptions.

## Research

- Facts, inferences, and hypotheses are separated.
- Sources are linked when external facts influence implementation or acceptance.
- Recommendation states confidence and tradeoffs.

## Contract

- `contract.json` has stable IDs.
- Goals, rules, workflows, constraints, risks, and decisions map back to the brief.
- JSON schema validation passed or the skipped validation is reported.

## Architecture

- Affected modules and integration boundaries are clear.
- Data/state flow and failure modes are covered.
- Mermaid diagrams are present when they clarify state, sequence, or flow.

## Acceptance

- Every acceptance item has ID, source, precondition, action, expected result, evidence, mode, and risk.
- `acceptance.md` and `acceptance.json` use the same IDs.
- Criteria are testable or explicitly marked manual.

## Validation

- Required commands and manual checks are tied to acceptance IDs.
- CI is recorded as project-specific policy, not a universal requirement.
- Proof packet expectations point to Linear comments.
