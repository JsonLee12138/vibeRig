# Project Team Composition

Use this policy when `update-team` is called by `vb-init` or when the project capability surface changes.

## 1. Materialize capabilities, not departments

Create the seven core agents on every project:

- `researcher`: bounded, source-grounded investigation; read-only.
- `implementation`: one approved Issue slice; write-enabled.
- `test_engineer`: approved automated tests and fixtures; write-enabled.
- `code_review`: independent correctness and maintainability review; read-only.
- `qa`: test design or test review, one mode per invocation; read-only.
- `security_auditor`: threat model or code security review, one mode per invocation; read-only.
- `integrator`: cross-Issue contract and evidence readiness; read-only.

Do not create CTO, product manager, white-team, final-QA, or self-learning agents. The main agent owns synthesis, authority, final acceptance, and delivery decisions. Learning uses accepted Evidence through `insights` and `vb-wiki`.

## 2. Activate conditional agents from positive evidence

Read `built-in-agents/agents.manifest.json`. Activate a conditional agent only when at least one collected source provides a concrete positive signal. Absence of a signal is not evidence to create the role.

| Agent | Positive signals | Do not activate merely because |
|---|---|---|
| `backend_architect` | API specs, handlers/controllers, services, RPC, backend requirement | the repository has a package manager |
| `backend_e2e_engineer` | approved backend E2E TC, real HTTP/RPC/event journey, public protocol → owned state contract | the repository merely has unit tests |
| `frontend_architect` | page/component/router code or a frontend requirement | the product may eventually need a UI |
| `data_architect` | schema, migration, ORM, SQL, owned persistence requirement | an external API returns JSON |
| `uiux_design` | user-visible UI, interaction, visual, accessibility requirement | a CLI prints text |
| `reliability_engineer` | deployment, runtime, SLO, observability, rollback, Runbook scope | a Dockerfile is only a dev fixture |
| `architecture_red_team` | L3; or L2 with irreversible migration, public-contract break, material security boundary, or data-loss risk | ordinary multi-file implementation |

Record every activation under `conditionalAgents.<agent>` as `{evidence[], reason}`. The name-keyed object prevents duplicate capability activations. If the evidence is ambiguous, keep the agent unmaterialized and report the ambiguity; runtime can still fall back to a core agent.

## 3. Keep definitions provider-neutral

Render selected bundled specs through `built-in-agents`; render truly project-specific roles through `agent-creator`. Keep the portable spec model at `inherit`, then apply provider-specific deployment defaults:

- Codex Agent TOML must contain the fixed model from `agents.manifest.json#platformModelDefaults.codex` so delegation does not depend on the parent guessing a runtime override.
- Claude Code and Cursor remain `inherit` unless an independently evidenced provider-specific policy exists.
- `.vibeRig/model-routing.yaml` still records escalation/fallback evidence, but the baseline Codex role model is executable directly from its Agent file.

Never delete a user-customized agent automatically. When a previously activated conditional capability no longer has evidence, report it as dormant; remove only after explicit user confirmation.

## 4. Fix the Codex baseline by role; route escalation by task risk

Use this stable Codex mapping:

| Codex Agent | Stored default | Escalation or fallback | Protected? |
|---|---|---|---|
| `researcher`、`implementation`、`test_engineer` | `gpt-5.6-luna` | route to a different specialized Agent instead of mutating the stored model | no for reversible L0/L1 |
| `code_review`、`qa`、`integrator` | `gpt-5.6-terra` | high-risk specialist review routes to Security/Red Team, not a silent model swap | yes when used as a Gate |
| `frontend_architect`、`backend_architect`、`data_architect`、`reliability_engineer`、`uiux_design` | `gpt-5.6-terra` | irreversible or adversarial focus routes to Red Team | read-only |
| `backend_e2e_engineer` | `gpt-5.6-sol` | explicit Terra fallback only when Sol is unavailable, recorded in route Evidence | protected after contract lock |
| `security_auditor`、`architecture_red_team` | `gpt-5.6-sol` | increase reasoning/context discipline without changing role authority | yes; exploit only |

The main coordinator remains Terra. `test_engineer` must refuse backend E2E authoring and hand it to `backend_e2e_engineer`; this split is what makes ordinary tests reliably Luna while backend E2E reliably Sol.

Use `low` for bounded tasks, `medium` for integration and architecture, and `high` only for security, irreversible data/reliability work, or adversarial red-team analysis. Never make `max` an init default.

Claude Code and Cursor remain `inherit` until comparable provider-specific accepted Evidence exists. Never transfer Codex rankings across providers.

## 5. Team profile output

Write `.vibeRig/team-profile.yaml` as a derived, byte-stable cache containing:

- manifest and policy fingerprints;
- collected evidence sources;
- all seven core agents;
- activated conditional agents with evidence and reason;
- dormant or customized agents that were preserved;
- rendered platforms and generation status.

Validate it with `assets/team-profile.schema.json`. The profile describes team composition; `.vibeRig/model-routing.yaml` remains the model-route cache.

Require the name-keyed conditional Agent object and reject unknown keys. Every model route must explicitly carry its bounded `risk` or risk band in addition to capability and mode/task family; the Agent name alone is never a valid route identity.
