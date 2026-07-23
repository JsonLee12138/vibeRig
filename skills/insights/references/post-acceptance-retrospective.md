# Post-Acceptance Retrospective Gate

Use this flow immediately after explicit human acceptance. Render human-facing content in `.vibeRig/project.yaml` `output.language`; keep IDs, paths, commands, schema keys, code symbols, hashes, and URLs unchanged.

## Required Gate

For `event_kind: acceptance`, exactly one condition gates the write:

1. **Accepted** — required validation/review evidence passed and the human explicitly accepted the identified outcome.

Merge is not a gate. Record one of these values as provenance:

- `accepted_unmerged` — accepted PR/branch content is not yet merged;
- `accepted_in_milestone` — an accepted Issue remains inside a later Milestone delivery;
- `merged` — the accepted result is already merged;
- `authoritative_branch` — the accepted result already lives on the authoritative branch without a pending PR;
- `no_merge_required` — the accepted outcome is not code-backed.

If acceptance is missing, return `deferred: acceptance_missing` with zero writes. If the accepted result is unmerged, continue now; do not downgrade confidence solely because it is unmerged.

For `event_kind: aggregation`, do not create an acceptance gate. Require `aggregate_only: true`, a canonically verified `aggregation_event`, and a complete `aggregation_event.derived_from` list whose child events have `insights: completed` and wiki `committed` / `zero_atoms`. Missing children return `deferred: child_acceptance_incomplete`; aggregation may only restate, cross-link, or deduplicate child evidence.

## Evidence Bundle

```yaml
scope_id: VB-456
scope_type: issue
status: accepted
event_kind: acceptance
source_kind: code
acceptance_event:
  id: acceptance:VB-456:<accepted-source-fingerprint>:r1
  record: <acceptance-comment-url-or-id>
gate:
  validation_passed: true
  acceptance_passed: true
  human_accepted: true
  code_review_passed: true
delivery_state: accepted_unmerged
sources:
  acceptance_record: <issue-comment-or-project-update-id>
  proof_packet_record: <comment-url-or-id>
  issue_url: <url>
git:
  branch: <accepted-branch>
  accepted_commit: <sha>
  merged_commit: <optional-sha>
  changed_files: []
validation:
  commands: []
  result: passed
review:
  acceptance_notes: ""
  code_review_notes: ""
  handoff_notes: ""
routing_observations: []
routing_analysis:
  observation_count: 0
  comparable_count: 0
  excluded_route_ids: []
  comparison_groups: []
  default_changed: false
retrospective_signals: []
discarded_signals: []
residual_risks: []
```

## Finalizer Prompt

```text
Review only the explicitly accepted outcome identified by acceptance_event.

Produce a retrospective evidence package immediately, even when the accepted
commit is not merged. This is not a knowledge page and not a skill proposal.
Reconstruct the accepted path from Linear, requirement contracts,
accepted_commit or the accepted non-code record, validation, and review.
Treat delivery_state and an optional merged_commit as provenance, never as a
permission gate.

For each retrospective signal, state exactly one claim and include:
- confidence
- evidence references
- applicability
- project/global/unknown scope hint
- signals that would invalidate or require re-checking the claim

For accepted-but-unmerged code, include post-acceptance content drift,
conflict resolution, acceptance withdrawal, and later re-acceptance among the
invalidation signals when relevant. Do not lower confidence merely because
delivery_state is accepted_unmerged.

Discard abandoned or unaccepted paths, transient environment failures,
one-off narrative, speculative conclusions, unsupported preferences, and
sensitive material. Record the discard reason instead of mixing it into an
accepted signal.

Do not name, propose, create, update, or deprecate any skill. Do not invoke
skillos-lite or skill-builder. Tool promotion is evaluated later by vb-wiki,
after the immediate wiki write succeeds and under separate user authority.

Zero retrospective signals is a valid result. Still report the accepted
outcome, evidence, friction, discarded signals, delivery_state, and residual
risks; never invent a signal merely to avoid an empty section.

When the accepted Evidence Packet contains route observations, validate and
copy their raw facts, bind outcomes to the accepted source, and classify
confounders. Compare only equivalent task families, risk, oracle, fidelity,
provider/platform, and policy versions. A single observation never changes a
default. Keep routing notes even when the knowledge result is zero-atoms.
Never invent missing token, latency, price, model, reasoning, or Agent data.
Protected acceptance, security, merge, release, production, destructive, or
irreversible decisions are exploit-only; optional experiments are read-only
shadow observations.

Before writing, resolve the event host: Issue comments for Issue scope;
registered Project Updates for Milestone/requirement scope. Search only that
host for the exact fixed marker
<!-- VibeRig-Record: retrospective:<event-id> -->. Ignore acceptance/phase
records carrying only their own typed marker. With pending/failed, adopt exactly one
structurally complete retrospective record whose event kind, scope, accepted/derived
source, and required sections match. Zero matches permits one append. Multiple
or malformed retrospective-kind matches return retrospective_record_conflict with zero writes.
With completed, validate and return the referenced record; never append a
replacement merely because phase persistence was interrupted.

When prior_acceptance_events are supplied for a Milestone, cite their
outcomes but emit only integration, cross-Issue, Milestone TC/E2E/UAT, or
other genuinely uncovered signals. Do not copy Issue signals into the
Milestone event.
```

## Aggregation Prompt Delta

```text
This is event_kind: aggregation, not human acceptance. Verify every
acceptance event named by aggregation_event.derived_from has insights: completed and wiki:
committed/zero_atoms. Summarize and
cross-link only claims already present in those child retrospectives. Emit no
new claim, confidence upgrade, or tool candidate. Recompute the canonical
SHA-256 digest from aggregation_event.derived_from and require it to match
aggregation_event.id. Use aggregation_event.id
for idempotency and return child_acceptance_incomplete if any child is
missing or incomplete.
```
