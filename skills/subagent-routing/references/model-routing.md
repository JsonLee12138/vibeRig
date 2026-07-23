# Adaptive Model Routing

## Source Order

Resolve model choice from:

1. the current platform model catalog and actual dispatch support;
2. `.vibeRig/model-routing.yaml` when its catalog, policy, and observation fingerprints are current;
3. comparable accepted `routing_observations` already present in Task Context;
4. the bundled [model capability prior](../assets/model-capability-prior.json);
5. `inherit` when none of the above safely applies.

Never pass a Codex model slug to Claude Code or Cursor merely because it won a Codex benchmark. Keep evidence and rankings provider-, platform-, model-slug-, reasoning-, policy-, and task-family-specific.

## Capability Before Model

Choose the required capability and role first. Then choose a model for that bounded brief. A cheap model with the wrong capability is not a saving.

Do not reduce jagged performance to one global leaderboard. Maintain a Pareto view per task family:

- accepted-oracle quality and critical failure rate;
- rework rounds and blocking findings;
- latency;
- input, cached, output, and reasoning tokens;
- provider cost only when the provider supplies a real rate.

Quality and safety are constraints. Cost and latency are optimization objectives after the constraints pass.

## Exploit, Explore, Shadow

Use `exploit` by default.

An `explore` challenger is eligible only when all are true:

- risk is L0 or L1;
- work is reversible and has a deterministic Completion Oracle;
- the main agent can independently validate the result;
- the task does not own acceptance, security approval, merge, release, production writes, destructive changes, secrets, payment, or irreversible migration;
- the challenger has no known Critical failure for this family;
- expected savings or missing evidence justify the sample.

Cap exploration at 10% of eligible routes. Make selection reproducible: compute the canonical `routeId`, then explore only when the first 8 hex digits of its SHA-256 suffix modulo 10 equal 0. Do not keep resampling until a desired model wins.

Use `shadow` for high-risk comparison only when the extra read-only cost is justified. The incumbent remains authoritative; the shadow output cannot change acceptance or delivery without normal main-agent review.

## Promotion And Demotion

Treat fewer than 5 comparable accepted observations as `experimental`; 5–19 as `provisional`; 20 or more as eligible for `trusted`.

Promote a challenger only when:

- observations share task family, risk band, oracle fingerprint, evidence fidelity, and material context;
- it has at least 5 comparable observations;
- accepted-oracle quality is not lower than the incumbent;
- it introduces no Critical failure or authority/evidence-fidelity regression;
- median latency, provider cost, or non-cached token use improves by at least 15%.

One Critical safety, authority, destructive-action, or evidence-fidelity failure immediately demotes the route to `blocked_for_exploration` until reviewed. Three comparable contradictions invalidate a provisional prior. Never auto-promote a model for accept/delivery authority; require an explicit policy review.

## Credit Assignment

Do not conclude “model X is better” from one accepted task. Separate:

- model behavior;
- agent role prompt;
- supplied context and Skill versions;
- oracle/test quality;
- environment and tool failures;
- main-agent intervention and rework;
- cache, service tier, and provider availability.

When these differ, record them as confounders and keep the observation, but exclude it from direct A/B ranking.

## Route Identity

Create `routeId` as:

```text
route:<work-item-or-scope-id>:<sha256(JCS({
  phase,
  taskFamily,
  risk,
  capability,
  agent,
  platform,
  model,
  reasoningEffort,
  policyAction,
  profileVersion,
  oracleFingerprint
}))>
```

Record the decision and outcome with [route-observation.schema.json](../assets/route-observation.schema.json). Preserve raw metrics; do not invent price when the provider does not expose one.
