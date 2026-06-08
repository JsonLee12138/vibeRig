---
name: agent-sop
description: Use for implementation, bug fix, refactor, validation, or delivery tasks that benefit from staged Codex orchestration with MCP tools and capability-routed subagents. Triggers when Codex should analyze scope, decide whether tests are needed, delegate test authoring, QA-check tests, delegate development, run local verification, request final QA acceptance, and loop evidence-based rework without hard-coding subagent names.
---

# Agent SOP

## Contract

Use this skill as the main-agent execution protocol. Keep the main agent responsible for task analysis, routing, evidence gathering, validation, rework decisions, Linear updates, and final reporting.

Do not outsource the whole task and wait. Delegate bounded phases only. If subagent tooling is unavailable, or no suitable subagent exists for a phase, execute that phase directly and record the reason.

Do not require tests for every task. Always make an explicit test decision. Use current MCP and local tools for verification. The main agent may use context-mode-style tools for large outputs and return only conclusions plus key evidence.

Subagents must not use context-mode, mutate Linear status, mutate VibeRig task/run/acceptance status, or make final acceptance calls. Subagents only return phase evidence and a verdict. After the whole task chain completes, the main agent writes the proof packet and status update to Linear when the task is Linear-backed, using `_save_comment` for proof comments and `_save_issue` for issue status or metadata updates.

## Capability Routing

Before delegating, inspect the available subagents or known tool descriptions. Choose by capability, not by a fixed role name.

For VibeRig work, load and follow `subagent-routing` before delegation when available.

Prefer the most specific suitable capability for each phase, such as frontend, backend, UI, database, security, docs, test, QA, reviewer, worker, or default. Use a generic worker only when no closer match is available.

For each delegation, provide:

- task goal and phase
- relevant files, modules, or ownership boundary
- constraints, including not reverting unrelated user changes
- constraints that subagents do not use context-mode and do not update Linear
- expected artifact
- required evidence or return format

QA does not have to be named `qa`. Use the closest available acceptance, review, or validation capability.

## Workflow

Run the SOP in this order:

1. Analyze the task.
   - Identify goal, scope, risk, impacted files, acceptance criteria, unknowns, and verification options.
   - Ask only for blocking clarification. Otherwise proceed with stated assumptions.
2. Decide whether tests are needed.
   - Require tests for behavior changes, bug fixes with regression risk, shared logic, parsing, data handling, security, or high-risk flows.
   - Allow skipping tests for documentation-only changes, trivial copy/config changes, unavailable test infrastructure, or tasks where another verification path is more appropriate.
   - Record the decision and reason.
3. If tests are needed, delegate focused test authoring.
   - Prefer tests that capture expected behavior before development when feasible.
   - Keep test changes scoped to the task.
4. Delegate test QA.
   - Ask a QA/review capability to verify coverage, edge cases, regression value, and whether the tests can catch the intended failure.
   - If QA rejects the tests, loop back to test authoring with the rejection evidence.
5. Delegate development.
   - Route to the best implementation capability.
   - Include test expectations, ownership boundaries, and local patterns to follow.
6. Run main-agent verification.
   - Run relevant unit tests, targeted test commands, lint, build, smoke checks, or MCP-backed validation.
   - Summarize command names, pass/fail state, and key errors.
7. Delegate final QA acceptance.
   - Provide requirement summary, changes, skipped items, and verification evidence.
   - Require a PASS, REWORK, or BLOCKED verdict with reasons.
8. Deliver the final response.
   - Include completed work, verification results, skipped tests or checks with reasons, QA verdict, and residual risks.

## Rework Loop

Map failures to the phase that produced the failed artifact:

- Test QA failure: return to the test authoring subagent.
- Main-agent verification failure: return to the development subagent.
- Final QA failure: return to analysis, test authoring, or development based on the evidence.

Track loop count per issue family. Default to at most 3 rework rounds. Escalate after 2 rounds when the same deviation repeats, the direction is clearly wrong, the same evidence fails again, or additional work needs user decisions or permissions.

Continue beyond the default only when each round has clear convergence and state why continuing is justified.

Every rework prompt must include:

- failed evidence
- expected correction
- relevant files or commands
- what must not change
- required return evidence

When blocked, summarize failed evidence, attempted fixes, current hypothesis, and the exact decision or external change needed.

## Delegation Templates

Use compact prompts like these and adapt them to the available subagent capability.

Test authoring:

```text
Phase: test authoring
Task: write or update focused tests for <goal>.
Scope: <files/modules>.
Expected behavior: <acceptance criteria>.
Constraints: keep product-code changes out unless a fixture/helper is required; follow existing test patterns; do not revert unrelated changes.
Return: files changed, cases covered, suggested command, gaps or risks.
```

Test QA:

```text
Phase: test QA
Task: review the test changes for <goal>.
Check: coverage of acceptance criteria, meaningful assertions, edge cases, regression value, and maintainability.
Return: PASS or REWORK, with missing coverage and concrete evidence.
```

Development:

```text
Phase: development
Task: implement <goal>.
Scope: <files/modules>.
Tests: <test decision and test files/commands>.
Constraints: follow local patterns; keep changes scoped; do not revert unrelated changes.
Return: summary, files changed, verification performed or recommended, risks.
```

Final QA:

```text
Phase: final QA acceptance
Task: accept or reject the completed work for <goal>.
Inputs: requirement summary, diff summary, test decision, verification evidence, skipped checks.
Return: PASS, REWORK, or BLOCKED with reasons, missing evidence, and residual risk.
```

Rework:

```text
Phase: rework
Issue: <failed evidence>.
Expected correction: <specific outcome>.
Scope: <files/modules>.
Do not change: <protected areas>.
Return: fix summary, evidence, remaining risk.
```

## Final Reporting

Keep the final answer concise. Report what changed, what passed, what was skipped and why, the QA verdict, and any residual risk. Do not expose full logs; include only key command results and actionable failures.
