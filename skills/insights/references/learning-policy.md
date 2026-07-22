# Retrospective Signal Policy

`insights` compiles accepted evidence for immediate `vb-wiki` use; it does not write knowledge or apply learnings itself.

## Keep As A Retrospective Signal

Keep a signal only when all are true:

- the source outcome is explicitly accepted and identified by `acceptance_event`;
- the statement is supported by an explicit source tied to `accepted_commit` or the accepted non-code record;
- it can help a future task beyond retelling the completed task;
- its applicability boundary can be stated;
- there is a meaningful way to recognize when it may be stale or invalid.

Examples include verified project conventions, stable commands, accepted architecture decisions, recurring failure causes, and validation entry points. An accepted-but-unmerged source is eligible immediately; merge status neither rejects the signal nor lowers its confidence by itself.

## Discard

Use an explicit reason:

- `abandoned_path` — an early approach replaced before acceptance;
- `not_accepted` — code, behavior, or a conclusion outside the accepted outcome;
- `transient_environment` — temporary credentials, outages, missing tools, or machine state;
- `one_off` — task narration with no future retrieval value;
- `speculative` — an inference not proven by accepted evidence;
- `insufficient_evidence` — no reliable source or applicability boundary;
- `sensitive` — credentials, secrets, personal data, or unsafe operational detail.

Do not use `unmerged` as a discard reason. When content changes after acceptance, the old signal remains traceable to its event but the changed content needs a new acceptance event before it can replace or extend knowledge.

## Authority Boundary

- Writing a retrospective Linear record does not itself write the wiki; the acceptance caller invokes `vb-wiki` immediately afterward.
- `insights` never proposes tools. Acceptance authorizes `vb-wiki` to evaluate and present at most one separate confirmation question after a knowledge commit, but it never authorizes creating or updating the skill.
- An `aggregation_event` derives only from completed child acceptance events; it is not human acceptance and cannot introduce or strengthen a signal.
- `insights` must not call `skillos-lite`, `skill-builder`, or `vb-learn`.
- During implementation, read existing confirmed knowledge when useful but do not write new retrospective signals.
