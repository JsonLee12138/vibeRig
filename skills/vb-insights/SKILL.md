---
name: vb-insights
description: Distill accepted Pi project evidence into novel, conflicting, deferred, or zero-atom knowledge candidates for vb-wiki. Use after human acceptance, for explicit retrospectives, repeated defects, milestone synthesis, or model-routing observations. Never writes the knowledge store.
---

# VB Insights

Analyze only accepted evidence. Plane owns work tracking, while the git-backed `vb-wiki` owns
long-term knowledge.

## Workflow

1. Prove the human acceptance record and exact accepted revision.
2. Reconstruct the accepted path; exclude abandoned attempts and unaccepted code.
3. Compare candidate conclusions with retrieved canonical knowledge when available.
4. Keep only conclusions that change a future design, diagnosis, verification, security, or
   operational decision.
5. Separate model, role prompt, context, skill, environment, and tool effects when recording route
   observations. A single successful run never changes the default model.
6. Return one of:
   - `zero-atoms`: no reusable knowledge;
   - `novel`: new durable knowledge;
   - `conflict`: accepted evidence contradicts current canonical knowledge;
   - `deferred`: evidence or acceptance is incomplete.
7. For `novel` or `conflict`, return a bounded candidate ledger to the parent delivery lead.

## Candidate Contract

Include the acceptance ID, accepted revision, statement, evidence references, confidence,
applicability, exclusions, invalidation signals, supersession candidates, and likely canonical
pages. Record discarded candidates and reasons.

Do not write `~/.vb-wiki`, Plane Pages, Plane comments, project source, or agent memory. Only the
parent invokes `vb-wiki`.
