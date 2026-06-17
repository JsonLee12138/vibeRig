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

- Evidence research: researcher, gemini_research, domain expert, security, compliance.
- Architecture: architect, backend, frontend, data, DevOps.
- Acceptance and QA: qa, test_engineer, reviewer, adversarial reviewer.
- Code review: code_review (5-dimension: correctness/readability/architecture/security/performance).
- Security audit: security_auditor (vulnerability/auth/data/infra/3rd-party, Critical→Info).
- Test coverage: test_engineer (Unit/Integration/E2E, Prove-It Pattern for bug fixes).
- Implementation: the most specific implementation capability available.
- Integration: integrator, release, DevOps, code_review.

Fallback chain: specific capability → closest domain capability → generic worker. Record the fallback reason when using a less specific capability.

If no suitable subagent exists for a non-task phase, the main agent may proceed directly and must report the missing capability as a routing risk. If no suitable subagent exists for Linear task execution, stop and report the missing capability before implementation.

## Parallel Fan-Out Pattern

Use parallel fan-out when multiple independent reviews or analyses can run on the same artifact simultaneously. Issue all subagent briefs in a single turn so they execute concurrently. Collect all results before synthesizing.

**When to use:**
- Pre-acceptance quality gate: code review + security audit + test coverage analysis
- Architecture review + compliance check + performance analysis
- Competing implementation proposals that need independent evaluation

**Rules:**
- Each subagent in a fan-out must receive an independent brief with its own bounded objective.
- Subagents in a fan-out must not depend on each other's output.
- The main agent synthesizes all results after every parallel subagent returns.
- Conflicting findings must be adjudicated by the main agent, not delegated back.

**Pre-acceptance parallel review brief template:**

```markdown
Fan-out phase: parallel quality review

Subagent A — code_review agent:
Objective: review the diff at <branch/PR> across five dimensions: correctness, readability, architecture, security, performance.
Return: APPROVE / REQUEST CHANGES verdict; findings with severity (Critical / Important / Suggestion); no fixes applied.

Subagent B — security_auditor agent:
Objective: scan the same diff for vulnerabilities, injection risks, auth gaps, and sensitive data exposure.
Return: findings with severity (Critical / High / Medium / Low / Info); proof-of-concept for Critical issues; no fixes applied.

Subagent C — test_engineer agent:
Objective: assess whether the changed behavior has adequate test coverage; follow Prove-It Pattern for bug fixes.
Return: coverage gaps with severity; no production code changes.

Main agent: after all three return, synthesize into a unified quality report. Block delivery on any Critical finding. Fix all Critical issues and re-run affected checks before proceeding.
```

## Adversarial Routing

Use adversarial routing when a decision, design, or artifact needs to be stress-tested rather than validated. An adversarial subagent has a single mandate: find what's wrong. It must not validate; it must attack.

**When to use:**
- `architecture.md` after initial draft (mandatory in brainstorm Stage 4)
- Security-sensitive contract or data-flow decisions
- Implementation approaches for high-stakes or irreversible operations
- Acceptance criteria that might be untestable or ambiguous

**Adversarial brief template:**

```markdown
Phase: adversarial review
Mandate: Find every flaw, hidden assumption, missing failure mode, scalability cliff, security hole, and integration gap in the attached artifact.
Do NOT validate or confirm what works. Your ONLY job is to disprove.
Artifact: <file path or inline content>
Return:
- Issue list with severity: blocking / notable / minor
- For each issue: what breaks, under what condition, and why it was not caught
```

The main agent classifies each finding: valid-incorporate, valid-tradeoff-accepted, or noise-rejected-with-reason. Incorporate valid findings before proceeding to the next stage.

## Red Flags

- A subagent was given broad "figure it out" context instead of a single bounded objective → the brief must have one objective, explicit boundaries, and a defined output format.
- The subagent result was used directly without main-agent review → the main agent must inspect evidence before acting on it.
- A subagent updated Linear or changed issue status → only the main agent may write to Linear.
- A VibeRig Linear task was executed directly by the main agent without declaring a subagent → stop and route through `subagent-routing` before implementation.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The task is straightforward, I can skip subagent routing for this Linear task" | Every Linear task execution must use a subagent. Straightforward tasks still benefit from the bounded-context separation — the main agent reviews, not implements. |
| "The subagent returned results, so I'll use them directly" | Subagent results are evidence, not decisions. The main agent must inspect changed files or recommendations before acting on them. |
| "I'll use a generic worker since the specific capability name doesn't matter" | Capability matching matters for quality. Use the most specific available capability — `frontend`, `security`, `QA` — and fall back to generic only when nothing closer is available. |

## Verification Checklist

```bash
# Verify no Linear writes happened inside the subagent (post-run check)
# Confirm the subagent output contains the required fields: summary, files, validation, risks
```

- [ ] The brief had one bounded objective and explicit boundaries.
- [ ] The subagent did not update Linear or make final acceptance decisions.
- [ ] The returned evidence covers the requested output fields (summary, files, validation, risks, blockers).
- [ ] The main agent inspected changed files or recommendations before acting on them.
- [ ] Any missing capability or validation gap is reported explicitly.
- [ ] For parallel fan-out: all subagent results were collected before synthesis; no subagent depended on another.
- [ ] For adversarial routing: findings were classified (incorporate / tradeoff-accepted / noise); all valid issues incorporated before proceeding.
