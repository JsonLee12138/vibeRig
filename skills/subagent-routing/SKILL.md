---
name: subagent-routing
description: Choose and brief specialized subagents for VibeRig research, planning, implementation, QA, review, integration, and task execution. Use whenever VibeRig work may benefit from a specialized subagent, not only during task-runner execution.
---

# Subagent Routing

Use this skill whenever a VibeRig workflow needs specialized judgment or bounded execution.

Subagents are not only for `task-runner`. They can be used during tech-research, requirement review, architecture review, QA adversarial review, code review, integration planning, and implementation.

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

- Preferred subagent recommendation from `.vibeRig/project.yaml` or requirement docs.

**执行时路由（里程碑原生工作流）**：Linear issue 建单时不写推荐 subagent、不指派（`split-issues` / `record-issue` 只建单）。task-runner 执行到某个 issue 时才调用本 skill，基于 issue 描述 + 组装好的 spec 现场选择——即使 issue 描述中残留旧的推荐 subagent 字段，也以现场路由结果为准。

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

`.vibeRig/project.yaml` `subagents` only pins four recurring roles — do not expect or require more fixed keys:

- Evidence research: `subagents.default_research` (e.g. `researcher`).
- Acceptance and QA: `subagents.default_qa` (e.g. `qa`).
- Security audit: `subagents.default_security_audit` (e.g. `security_auditor`).
- Code review: `subagents.default_review` (e.g. `code_review`, 5-dimension: correctness/readability/architecture/security/performance).

Any other need (implementation, test authoring, integration, domain-specific review, architecture, etc.) has no fixed config key — resolve it ad hoc at the point of need: pick the closest matching capability from what's actually available (`.codex/agents/`, `.claude/agents/`, `.cursor/agents/`, or the platform's built-in agent types), and fall back to a generic worker only when nothing closer exists. Record the fallback reason when using a less specific capability.

VibeRig 基线能力优先匹配：实现 → `implementation`；批准的自动化 TC 编写 → `test_engineer`；前端/后端/数据架构调研 → `frontend_architect` / `backend_architect` / `data_architect`；SRE、性能、发布和回滚 → `reliability_engineer`；UI/UX → `uiux_design`；架构攻击 → `architecture_red_team`；跨 Issue 集成就绪 → `integrator`。

`qa` uses `test_design` or `test_review`; `security_auditor` uses `design_threat_model` or `code_security_review`; `uiux_design` uses `report_only` inside pre-development and `artifact_write` only for explicitly authorized artifacts. Put the mode in the Brief so one Agent invocation has one job.

Codex, Claude Code, and Cursor each already provide a native subagent/dispatch mechanism (see [Claude Code subagents](https://code.claude.com/docs/en/agent-view), [Codex subagents](https://developers.openai.com/codex/subagents), [Cursor subagents](https://cursor.com/cn/docs/subagents)) — this skill decides *whether* and *which*, not how the underlying platform dispatches. Use that platform's own mechanism to actually invoke the chosen capability.

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

**Pre-acceptance parallel review example:** dispatch `subagents.default_review` (diff across five dimensions, APPROVE/REQUEST CHANGES with Critical/Important/Suggestion findings) and `subagents.default_security_audit` (vulnerabilities/auth/data exposure, Critical→Info severity) in the same turn; add a test-coverage capability ad hoc if the change needs it. Each brief follows the Subagent Brief format above with its own objective and required output. After all return, synthesize into one quality report and block delivery on any Critical finding.

## Adversarial Routing

Use adversarial routing when a decision, design, or artifact needs to be stress-tested rather than validated. An adversarial subagent has a single mandate: find what's wrong. It must not validate; it must attack.

**When to use:**
- `architecture.md` after initial draft (architecture-design 的对抗性校验为强制)
- Security-sensitive contract or data-flow decisions
- Implementation approaches for high-stakes or irreversible operations
- Acceptance criteria that might be untestable or ambiguous

**Adversarial brief:** use the Subagent Brief format above with the objective set to a single mandate — find every flaw, hidden assumption, missing failure mode, security hole, and integration gap in the attached artifact; do not validate or confirm what works. Required output: an issue list with severity (blocking / notable / minor), and for each issue what breaks, under what condition, and why it was not caught.

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
