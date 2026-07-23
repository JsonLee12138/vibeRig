---
name: subagent-routing
description: 在 execute 或 pre-development 已判定需要独立专业能力时，选择 VibeRig research、planning、implementation、QA、review 或 integration Subagent，并按任务族、风险、accepted Evidence、成本和当前模型目录选择 model/reasoning。仅作为内部能力与成本路由使用；不因任务来自 Linear 就自动触发，不让用户手动挑 Skill、Agent 或模型。
---

# Subagent Routing

Use this skill after a VibeRig workflow has evidence that specialized judgment, independent review, isolation, or safe parallelism will increase expected information gain.

Subagents are optional capabilities inside `execute` and `pre-development`. They can be used during tech research, architecture review, QA adversarial review, code review, integration planning, and implementation when their independent value justifies the cost.

## Contract

Use this skill to decide whether VibeRig work should be delegated, choose capability before model, and prepare a bounded subagent brief plus an auditable route observation.

Do not use this skill to outsource final decisions, update Linear, perform human acceptance, or hide main-agent responsibility. Subagents advise or execute bounded work; the main agent owns validation and final reporting.

Stop and report when the requested delegation would require credentials, destructive operations, broad authority, or context the main agent cannot safely provide.

## Input Contract

Required:

- VibeRig phase or task goal.
- Available subagent capabilities or tool descriptions when delegation is possible.
- Relevant Linear issue, local docs, code scope, or validation expectations.
- Current platform, available model catalog, and supported runtime model/reasoning overrides.
- Completion Oracle fingerprint and risk level.

Optional:

- Preferred subagent recommendation from `.vibeRig/project.yaml` or requirement docs.
- `.vibeRig/model-routing.yaml` and accepted `routing_observations` already present in Task Context.

**执行时路由**：Linear Issue 建单时不写固定 subagent、不指派。`execute` 每轮根据 Goal Contract、当前风险和最小 Task Context 现场选择；即使旧 Issue 残留推荐字段，也以当前路由结果为准。

If no suitable subagent exists, the main agent may proceed directly when risk and authority allow, and must record the routing decision. Missing a named capability is not by itself a blocker.

## Output Contract

Return:

- Delegation decision and rationale.
- Selected capability, or the reason no suitable subagent exists.
- Selected platform/model/reasoning and `exploit`、`explore`、`shadow`、`fallback` 或 `inherit` decision.
- A compact Subagent Brief when delegating.
- A schema-valid `route_observation` with prediction and a pending outcome.
- Main-agent validation responsibility and residual routing risk.

Do not treat a subagent result as final until the main agent reviews it.

## Workflow

1. Identify the VibeRig phase, task family, goal, risk, Completion Oracle fingerprint, expected output, reversibility, and authority.
2. Inspect available subagent capabilities or configured defaults; select capability before considering models.
3. Compare expected information gain and isolation value against token, latency, coordination, and context cost; decide whether delegation is required, optional, wasteful, or unsafe.
4. Read [adaptive model routing](./references/model-routing.md). Resolve the current model catalog, `.vibeRig/model-routing.yaml`, comparable accepted observations, then bundled provider-specific prior.
5. Choose model/reasoning and policy action. Use the lowest evidenced setting that meets the quality floor. Apply deterministic exploration only when eligible; otherwise exploit or inherit.
6. Create the canonical `routeId` and pending observation using [route-observation.schema.json](./assets/route-observation.schema.json).
7. Build a compact Subagent Brief containing the runtime route, escalation signals, and one bounded capability objective.
8. Dispatch with the platform's runtime model/reasoning override when supported. If the requested model is unavailable, record `fallback`; never silently substitute.
9. Review returned evidence, diff, commands, and oracle coverage before use. Update the observation with actual outcome, rework, latency, token/cost facts, failure classes, and confounders.
10. Attach observations to the Evidence Packet so accepted work can be analyzed by `insights`.

## Main-Agent Responsibility

The main agent must:

- decide whether subagent delegation is warranted for non-task phases
- choose the best available subagent by capability, not by a fixed name
- choose model by provider-specific task-family evidence, not a global leaderboard
- preserve quality/safety floors before optimizing token, price, or latency
- prepare a compact Subagent Brief
- provide only the required docs, code paths, constraints, and expected output
- review the subagent result before using it
- make final decisions, write local docs, update Linear, and report to the user

## When To Use A Subagent

Use a subagent when one or more of these are true and the expected benefit exceeds coordination cost:

- the work needs specialized domain judgment, such as security, frontend, backend, data, DevOps, QA, or research
- an independent review would reduce risk
- multiple options need adversarial comparison
- the Linear issue or local docs identify a risk that matches a subagent capability
- implementation isolation materially protects the main context or enables safe parallelism
- validation, QA, or code review should be separated from implementation

Do not route by task source. L0 work defaults to the main agent; L1 may use one implementation or review capability; L2/L3 separate implementation and relevant review. Linear-backed work follows the same risk model.

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

## Runtime Route
- route id: <canonical route id>
- platform/agent/capability: <values>
- model/reasoning: <explicit values or inherit>
- policy action: <exploit|explore|shadow|fallback|inherit>
- escalation signals: <signals that return control to the main agent>

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

## Initial Codex Model Prior

Bundled evidence lives in [model-capability-prior.json](./assets/model-capability-prior.json). It is a starting prior, not a permanent ranking:

- coordinator and accept/delivery → `gpt-5.6-terra/low`;
- bounded intake → `gpt-5.6-luna/low`;
- confirmed deterministic execute → `gpt-5.4-mini/low`, escalating to Luna/Terra on ambiguity, cross-module scope, repeated failure, or risk;
- open-ended/high-value escalation → `gpt-5.6-sol`, starting low and increasing reasoning only when evidence justifies it.

Use these only when the exact model is available on Codex and no fresher comparable project evidence invalidates the prior. Other platforms remain `inherit` until they have provider-specific observations.

`qa` uses `test_design` or `test_review`; `security_auditor` uses `design_threat_model` or `code_security_review`; `uiux_design` uses `report_only` inside pre-development and `artifact_write` only for explicitly authorized artifacts. Put the mode in the Brief so one Agent invocation has one job.

Codex, Claude Code, and Cursor each already provide a native subagent/dispatch mechanism (see [Claude Code subagents](https://code.claude.com/docs/en/agent-view), [Codex subagents](https://developers.openai.com/codex/subagents), [Cursor subagents](https://cursor.com/cn/docs/subagents)) — this skill decides *whether* and *which*, not how the underlying platform dispatches. Use that platform's own mechanism to actually invoke the chosen capability.

If no suitable subagent exists, continue with the main agent when risk, authority, and available validation make that safe. Stop only when independent capability is itself a required Gate.

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

**High-risk pre-acceptance example:** when code and security risks are both independently material, dispatch `subagents.default_review` and `subagents.default_security_audit` in the same turn; add test coverage only when its expected findings are not already covered. Do not use this fan-out as the default for L0/L1 work.

## Adversarial Routing

Use adversarial routing when a decision, design, or artifact needs to be stress-tested rather than validated. An adversarial subagent has a single mandate: find what's wrong. It must not validate; it must attack.

**When to use:**
- L3 `architecture.md` after initial draft，或 L2 出现不可逆、安全、数据或公共契约升级信号
- Security-sensitive contract or data-flow decisions
- Implementation approaches for high-stakes or irreversible operations
- Acceptance criteria that might be untestable or ambiguous

**Adversarial brief:** use the Subagent Brief format above with the objective set to a single mandate — find every flaw, hidden assumption, missing failure mode, security hole, and integration gap in the attached artifact; do not validate or confirm what works. Required output: an issue list with severity (blocking / notable / minor), and for each issue what breaks, under what condition, and why it was not caught.

The main agent classifies each finding: valid-incorporate, valid-tradeoff-accepted, or noise-rejected-with-reason. Incorporate valid findings before proceeding to the next stage.

## Red Flags

- A subagent was given broad "figure it out" context instead of a single bounded objective → the brief must have one objective, explicit boundaries, and a defined output format.
- The subagent result was used directly without main-agent review → the main agent must inspect evidence before acting on it.
- A subagent updated Linear or changed issue status → only the main agent may write to Linear.
- A low-risk task launched multiple agents without explaining their independent value → reduce to the minimum sufficient route.
- A model was selected before the required capability → redo capability matching first.
- One successful task changed the default model → keep it as an observation; it is not enough evidence.
- A cheaper challenger entered acceptance, security authority, destructive, merge, release, or production-write decision paths → remove it from the decision path; optional comparison must be read-only shadow.
- Missing provider price was replaced by a guessed dollar estimate → record price as unknown and compare real token/latency only.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The task came from Linear, so it must use a subagent" | Tracking location does not determine risk. Use the same L0–L3 decision as local work. |
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
- [ ] Model/provider/reasoning and policy action were explicit; unavailable-model fallback was not silent.
- [ ] The route observation records prediction, outcome, raw metrics, rework, failure classes, and confounders.
- [ ] Exploration was deterministic, at most 10% of eligible L0/L1 work, and never owned a protected Gate.
- [ ] For parallel fan-out: all subagent results were collected before synthesis; no subagent depended on another.
- [ ] For adversarial routing: findings were classified (incorporate / tradeoff-accepted / noise); all valid issues incorporated before proceeding.
