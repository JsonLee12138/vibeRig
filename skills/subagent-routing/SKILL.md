---
name: subagent-routing
description: Choose and brief specialized Codex subagents for VibeRig research, planning, implementation, QA, review, integration, and task execution. Use whenever VibeRig work may benefit from a specialized subagent, not only during task-runner execution.
---

# Subagent Routing

Use this skill whenever a VibeRig workflow needs specialized judgment or bounded execution.

Subagents are not only for `task-runner`. They can be used during brainstorm research, requirement review, architecture review, QA adversarial review, code review, integration planning, and implementation.

## Contract

Use this skill to decide whether VibeRig work should be delegated and to prepare a bounded subagent brief.

Do not use this skill to outsource final decisions, update Linear, perform human acceptance, or hide main-agent responsibility. Subagents advise or execute bounded work; the main agent owns validation and final reporting.

Stop and report when the requested delegation would require credentials, destructive operations, broad authority, or context the main agent cannot safely provide.

## Input Contract

Required:

- VibeRig phase or task goal.
- Available subagent capabilities or tool descriptions when delegation is possible.
- Relevant Linear issue, local docs, code scope, or validation expectations.

Optional:

- Preferred subagent recommendation from `.vibeRig/project.yaml`, Linear issue text, or requirement docs.

If no suitable subagent exists for a non-task phase, the main agent may proceed directly and report the routing risk. If no suitable subagent exists for Linear task execution, stop before implementation.

## Output Contract

Return:

- Delegation decision and rationale.
- Selected capability, or the reason no suitable subagent exists.
- A compact Subagent Brief when delegating.
- Main-agent validation responsibility and residual routing risk.

Do not treat a subagent result as final until the main agent reviews it.

## Workflow

1. Identify the VibeRig phase, task goal, risk, and expected output.
2. Inspect available subagent capabilities or configured defaults.
3. Decide whether delegation is required, optional, or unsafe.
4. Build a compact Subagent Brief for the selected capability.
5. Send only the bounded context needed for the assignment.
6. Review the returned evidence before using it in docs, code, Linear updates, or final reporting.
7. Report the delegation decision, validation evidence, and any missing capability risk.

## Main-Agent Responsibility

The main agent must:

- decide whether subagent delegation is warranted for non-task phases
- choose the best available subagent by capability, not by a fixed name
- prepare a compact Subagent Brief
- provide only the required docs, code paths, constraints, and expected output
- keep context-mode usage in the main-agent boundary
- review the subagent result before using it
- make final decisions, write local docs, update Linear, and report to the user

## When To Use A Subagent

Use a subagent when any of these are true:

- the work needs specialized domain judgment, such as security, frontend, backend, data, DevOps, QA, or research
- an independent review would reduce risk
- multiple options need adversarial comparison
- the Linear issue or local docs recommend a subagent capability
- the task is implementation work beyond a trivial edit
- validation, QA, or code review should be separated from implementation

Every Linear task execution must use a subagent. The main agent may work directly only for trivial status checks, formatting-only edits, simple file reads, or direct answers that do not execute a Linear task and do not need specialized review.

## Subagent Boundaries

Subagents must:

- use only the Subagent Brief, referenced local docs, and provided code context
- must not use context-mode tools
- must not update Linear or project status
- must not make final acceptance decisions
- must not do broad refactors unless explicitly in scope
- must not modify `.vibeRig/project.yaml` or requirement docs unless the brief explicitly asks for docs work
- return evidence instead of claiming completion without validation

## Subagent Brief

```markdown
## Objective
<one bounded objective>

## Inputs
- Linear issue: <key/url if relevant>
- Local docs: <paths and section/AC ids>
- Code scope: <files/modules>
- Validation: <commands/manual checks>

## Boundaries
- no context-mode
- no Linear/status updates
- do not revert unrelated user changes
- keep changes within scope

## Required Output
- summary
- files changed or reviewed
- validation run or recommended
- acceptance/risk coverage
- blockers
- handoff notes
```

## Recommended Capability Map

- Requirement intake: analyst, product, planner.
- Evidence research: researcher, domain expert, security, compliance.
- Architecture: architect, backend, frontend, data, DevOps.
- Acceptance and QA: QA, test, reviewer, adversarial reviewer.
- Implementation: the most specific implementation capability available.
- Integration: integrator, release, DevOps, code review.

If no suitable subagent exists for a non-task phase, the main agent may proceed directly and must report the missing capability as a routing risk. If no suitable subagent exists for Linear task execution, stop and report the missing capability before implementation.

## Validation

Before using a subagent result, verify:

- The brief had one bounded objective and explicit boundaries.
- The subagent did not use context-mode, update Linear, or make final acceptance decisions.
- The returned evidence covers the requested output.
- The main agent inspected changed files or recommendations before acting on them.
- Any missing capability or validation gap is reported.
