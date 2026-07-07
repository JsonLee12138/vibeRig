---
name: agent-sop
description: Use for implementation, bug fix, refactor, validation, or delivery tasks that benefit from staged subagent orchestration with MCP tools and capability-routed subagents. Triggers when the main agent should analyze scope, decide whether tests are needed, delegate test authoring, QA-check tests, delegate development, run local verification, request final QA acceptance, and loop evidence-based rework without hard-coding subagent names.
---

# Agent SOP

## Contract

Use this skill as the main-agent execution protocol. Keep the main agent responsible for task analysis, routing, evidence gathering, validation, rework decisions, Linear updates, and final reporting.

Do not outsource the whole task and wait. Delegate bounded phases only. If subagent tooling is unavailable, or no suitable subagent exists for a phase, execute that phase directly and record the reason.

Do not require tests for every task. Always make an explicit test decision. Use current MCP and local tools for verification.

Subagents must not mutate Linear status, mutate VibeRig task/run/acceptance status, or make final acceptance calls. Subagents only return phase evidence and a verdict. After the whole task chain completes, the main agent writes the proof packet and status update to Linear when the task is Linear-backed, using `_save_comment` for proof comments and `_save_issue` for issue status or metadata updates.

## Core Behaviors

These apply at all times, to the main agent and any subagent brief. They are non-negotiable.

**1. Surface assumptions explicitly.** Before any non-trivial implementation, write down assumptions:
```
ASSUMPTIONS I'M MAKING:
1. [assumption about scope]
2. [assumption about architecture]
→ Correct me now or I'll proceed with these.
```
Do not silently fill in ambiguous requirements. Surface uncertainty early — it's cheaper than rework.

**2. Manage confusion actively.** When encountering inconsistencies, conflicting requirements, or unclear specs:
- STOP. Do not proceed with a guess.
- Name the specific confusion.
- Present the tradeoff or ask the clarifying question.
- Wait for resolution before continuing.

**3. Push back when warranted.** When an approach has clear problems: point out the issue directly, explain the concrete downside (quantify when possible — "this adds ~200ms latency"), propose an alternative, then accept the human's decision if they override with full information. Sycophancy ("Of course!") followed by implementing a bad idea helps no one.

**4. Enforce simplicity.** Before finishing any implementation, ask: Can this be done in fewer lines? Are these abstractions earning their complexity? Would a staff engineer say "why didn't you just..."? Prefer the boring, obvious solution. Three similar lines is better than a premature abstraction.

**5. Maintain scope discipline.** Touch only what the task requires. Do NOT remove comments you don't understand, "clean up" code orthogonal to the task, refactor adjacent systems, delete seemingly unused code without approval, or add features not in the spec. Surgical precision, not unsolicited renovation.

**6. Verify, don't assume.** A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data).

## Input Contract

Required:

- A concrete implementation, bug fix, refactor, validation, or delivery goal.
- The working repository or workspace.
- Known acceptance criteria, issue link, failing behavior, or requested outcome.

Optional:

- Linear issue, PR, logs, screenshots, test commands, validation policy, or preferred subagent capabilities.

If acceptance criteria are missing, infer narrow criteria from the request and local code. Ask only when the missing criteria would change the implementation path or risk.

## Output Contract

Return:

- Scope decision and test decision.
- Subagent phases used or the reason direct execution was necessary.
- Files changed or reviewed.
- Verification commands, pass/fail state, and key errors.
- QA verdict, skipped checks, and residual risks.

Do not report success unless the main agent has inspected the result and made an explicit verification decision.

## Capability Routing

Before delegating, inspect the available subagents or known tool descriptions. Choose by capability, not by a fixed role name.

For VibeRig work, load and follow `subagent-routing` before delegation when available.

Prefer the most specific suitable capability for each phase, such as frontend, backend, UI, database, security, docs, test, QA, reviewer, worker, or default. Use a generic worker only when no closer match is available.

For each delegation, provide:

- task goal and phase
- relevant files, modules, or ownership boundary
- constraints, including not reverting unrelated user changes
- constraints that subagents do not update Linear
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
8. Run parallel quality review (when the task involves non-trivial code changes).
   - Read `.vibeRig/project.yaml` `subagents` to resolve the three review roles:
     - **Code reviewer**: use `subagents.default_review`; if unset, use `subagent-routing` to find the closest code-review capability.
     - **Security auditor**: use `subagents.default_security_audit`; if unset, use `subagent-routing` to find the closest security capability.
     - **Test engineer**: no fixed config key — use `subagent-routing` to find the closest test/coverage capability ad hoc.
   - Issue all three subagent briefs in a single turn so they run concurrently. For each role, brief the resolved agent with its expected output:
     - Code reviewer: review the diff across five dimensions (correctness, readability, architecture, security, performance). Return an APPROVE / REQUEST CHANGES verdict with Critical / Important / Suggestion findings; no fixes applied.
     - Security auditor: scan the same diff for vulnerabilities, injection risks, auth gaps, and data exposure. Return findings with Critical / High / Medium / Low / Info severity and proof-of-concept descriptions for Critical issues; no fixes applied.
     - Test engineer: assess whether the changed behavior has adequate test coverage. Follow the Prove-It Pattern for bug fixes. Return coverage gaps with severity; no production code changes.
   - After all three return, synthesize findings into a single quality report.
   - Block delivery on any Critical finding from any reviewer. Fix all Critical issues and re-run affected checks before proceeding.
   - Include Important / High findings and residual risks in the final response even when not blocking.
   - If a role is not configured and no capable agent exists, execute that review phase directly as main agent and record the missing capability.
   - Skip this step for documentation-only changes, trivial config edits, or when the task explicitly scopes out code changes.
9. Deliver the final response.
   - Include completed work, verification results, skipped tests or checks with reasons, QA verdict, parallel review summary, and residual risks.

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

## Red Flags

- A subagent was given the entire task ("implement everything") instead of one bounded phase → each delegation must be one phase with a specific expected artifact.
- The main agent accepted a subagent result without running any verification → main-agent verification (step 6) is not optional.
- The rework loop ran more than 3 rounds on the same issue family without escalating → escalate after 2 repetitions of the same failure; more loops do not fix direction errors.
- A subagent updated Linear, changed issue status, or wrote proof packets → subagents return phase evidence only; all Linear writes belong to the main agent.
- The parallel quality review (step 8) was skipped for a non-trivial code change → Critical findings from code review, security, or test coverage that reach `accept-milestone` or `accept-issue` are more expensive to fix than catching them here.
- A Critical finding from the parallel review was noted but delivery proceeded anyway → Critical findings must be fixed before the final response is delivered.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The task is clear, I can skip the explicit test decision" | Skipping the test decision means tests either get added by default (unnecessary cost) or skipped silently (missed safety net). Make the decision explicitly and record the reason. |
| "The subagent said it passed, so I'll trust the result" | Subagent claims are not verified evidence. The main agent runs the commands, reads the output, and makes the verification decision independently. |
| "Three rework rounds failed — I'll try one more" | Repeating the same rework without changing the approach does not converge. After 2 identical failures, escalate with the failed evidence and what external decision or context is needed. |

## Validation

```bash
# Run the relevant test/lint command and capture pass/fail
# Example: npm test -- --testPathPattern=<scope> 2>&1 | tail -5
# Example: python -m pytest <test-file> -v 2>&1 | tail -10
```

Minimum validation is a main-agent decision covering:

- [ ] Whether tests are required and why (explicit decision recorded).
- [ ] Which targeted tests, build, lint, typecheck, smoke, manual, or MCP-backed checks ran and their pass/fail.
- [ ] Whether a QA/review capability returned PASS, REWORK, or BLOCKED when one was available.
- [ ] For non-trivial code changes: parallel quality review ran (roles resolved from `.vibeRig/project.yaml` subagents or `subagent-routing` fallback) and all Critical findings were resolved.
- [ ] Parallel review summary (notable findings, residual risks) is included in the final response.
- [ ] Which checks were skipped and what risk remains.

If validation fails, run the Rework Loop before final reporting unless the failure requires user input, credentials, or external state.

## Final Reporting

Keep the final answer concise. Report what changed, what passed, what was skipped and why, the QA verdict, and any residual risk. Do not expose full logs; include only key command results and actionable failures.
