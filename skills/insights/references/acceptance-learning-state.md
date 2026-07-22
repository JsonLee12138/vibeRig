# Acceptance Learning State

Use this state contract to make post-acceptance retrospective, wiki persistence, promotion evaluation, and delivery reconciliation resumable without duplicate work. Human-facing prose follows `.vibeRig/project.yaml` `output.language`; keys, enums, IDs, and hashes remain unchanged.

## Canonical Identities

All content/packet digests below are SHA-256 over the specified bytes and use the full 64-character lowercase hex digest. Git commit/tree/blob OIDs instead use the repository's full algorithm-native lowercase object ID and are never abbreviated or assumed to be SHA-256. String normalization means Unicode NFC plus `CRLF` / `CR` converted to `LF`; do not trim or rewrite other whitespace. Array sorting is ascending raw UTF-8 byte order with exact duplicate removal, never locale-aware sorting.

`scope_identity` is never a free-form label:

- Linear-backed scope: `{ "kind": "linear_scope", "scope_type": <issue|milestone|requirement|prd>, "scope_id": <exact-stable-id> }`;
- project-scoped manual/non-Linear source: `{ "kind": "project", "linear_project_id": <exact-id-or-null>, "github_repo": <lowercase-owner/repo-or-null>, "repo_root_fingerprint": <full-sha256-or-null> }`, always including all three keys. Resolve them with the wiki project-identity procedure. Use the root fingerprint only when both external identities are null; otherwise it must be null. Require exactly that valid external-or-fallback identity;
- global manual source: `{ "kind": "global" }`, only when the user explicitly chose global scope.

Never choose one project identifier when both exist, infer global from missing project metadata, or use a mutable project display name/path. Missing project identity with no explicit global choice returns `blocked: scope_identity_missing` before event creation.

First compute `accepted_source_fingerprint`:

- code-backed scope: resolve `accepted_commit` with `git rev-parse --verify <accepted-ref>^{commit}` and use the full lowercase commit object ID; abbreviated hashes and mutable refs are invalid;
- immutable non-code record: normalize and hash the UTF-8 RFC 8785/JCS representation of `{ "v": 1, "source_kind": "non_code_record", "scope_identity": <stable-scope>, "immutable_record_id": <namespaced-id> }`;
- content-backed non-code record: hash the same canonical object with `source_kind: "non_code_content"` and `accepted_content: <exact-normalized-accepted-content>` instead of an ID;
- standalone manual note: hash `{ "v": 1, "source_kind": "manual_note", "scope_identity": <stable-project-identity-or-global>, "statement": <exact-normalized-statement>, "evidence_refs": <normalized-deduplicated-bytewise-sorted-array> }` using JCS.

Persist the canonical source payload or its immutable references with the event so a retry recomputes and verifies the same fingerprint. If an alleged record ID is mutable, use the content-backed form instead.

For a Linear-backed scope, search the exact host defined below for an event with the same scope and source fingerprint. For a standalone manual note, compute the canonical event ID first and search the local operation journal plus fixed-trailer history; it has no implicit Linear scope.

- Active, non-withdrawn event exists → reuse it and resume its first incomplete phase.
- No event exists → create `acceptance:<scope-id>:<accepted-source-fingerprint>:r1`.
- A prior event for the same source was explicitly withdrawn/superseded and the user accepts again → increment the revision: `...:r2`, `...:r3`, and so on.
- A retry, process restart, merge, or Milestone handoff never creates a new acceptance event by itself.

Derived operations have different identities and never impersonate human acceptance:

- requirement roll-up: require unique `aggregation_event.derived_from`, sort the exact child IDs by raw UTF-8 bytes, join them with one `LF` plus a final `LF`, and SHA-256 those UTF-8 bytes. Use the full digest in `aggregate:<requirement-id>:<digest>`. Recompute and reject an ID whose digest does not match the nested child list;
- merge write-ahead intent: normalize and SHA-256 the UTF-8 RFC 8785/JCS payload `{ "v": 1, "acceptance_event_id": <exact-id>, "scope_identity": <canonical-scope>, "accepted_source_fingerprint": <fingerprint>, "provider": <provider>, "repository": <lowercase-owner/repo>, "pull_request_number": <stable-number>, "base_ref": <exact-full-ref>, "expected_base_oid": <full-commit-oid>, "expected_head_oid": <full-commit-oid>, "merge_method": <merge|squash|rebase> }`; use `delivery-intent:<scope-id>:<full-lowercase-sha256>` as `delivery_intent.id`;
- delivery reconciliation: resolve the delivered commit to its full commit object ID and use `delivery:<scope-id>:<accepted-source-fingerprint>:<delivered-commit>`.

## Linear Record Host

Use the `vb-linear` capability map consistently for the full event:

- Issue/sub-issue event → that Issue's comments.
- Milestone acceptance/delivery and requirement/PRD aggregation/finalization → the registered Linear Project's Project Updates.

Every record carries `<!-- VibeRig-Event: <event-id> -->` and `<!-- VibeRig-Record: <kind>:<event-id> -->`. Acceptance, retrospective, delivery-intent, and delivery each have exactly one canonical record per exact event/intent ID; only `phase` records are append-only overlays. The acceptance record seeds the initial phase state, then later `phase` records overlay it in host order; the newest structurally **and transition-valid** value for each field wins without dropping earlier references. A later overlay may advance but never regress `wiki: committed|zero_atoms` to `failed|writing`, replace a terminal zero-result digest, or move a terminal promotion state backward. A structurally valid but regressive/conflicting overlay returns `blocked: phase_transition_conflict` and is not applied. Delivery progress after its canonical `pending` record is likewise carried by phase overlays referencing the exact delivery ID. Search/adopt only the requested kind inside the mapped host, so a valid acceptance record never conflicts with a retrospective. “Milestone comment” is not a valid host. Persist its generic reference as `linear_record`, with `comment_id` or `status_update_id` as applicable.

A `failed` wiki overlay may replace its editor input/result hashes only at the next
`wiki_editor_revision`, with the same immutable event and accepted source, when the
operation journal proves a later committed wiki state changed an exact candidate blob or
route input. The overlay must preserve the prior attempt history. The same input with a
different result, a skipped revision, or an unproved input change returns `blocked:
phase_transition_conflict` and leaves the prior overlay authoritative.

## Persisted Phase State

Append or update a compact Linear finalization record keyed by the event ID:

```yaml
record_kind: phase
event_id: acceptance:VB-42:<fingerprint>:r1
accepted_source_fingerprint: <fingerprint>
acceptance: recorded | withdrawn
insights: pending | completed | failed | not_applicable
insights_record: <optional-comment-or-project-update-id>
insights_operation_marker: <exact-event-id>
wiki: pending | writing | commit_pending | committed | zero_atoms | failed
wiki_result_reason: <optional zero_knowledge | semantic_no_change | resolution_discarded>
wiki_decision_sha256: <optional full normalized zero-result packet digest>
wiki_editor_revision: <nonnegative integer; zero before the first editor attempt>
wiki_editor_input_sha256: <optional full canonical editor-input digest>
wiki_editor_result_sha256: <optional full canonical editor-result digest>
wiki_resume_from: <optional entity_resolution | resolution | seo_compile | writing | commit_pending>
wiki_error: <optional-last-error>
wiki_journal_key: <sha256-of-operation-id>
wiki_base_commit: <optional-full-oid>
wiki_event_paths: []
wiki_path_baselines: {}
wiki_staged_tree: <optional-full-tree-oid>
wiki_commit: <optional-sha>
wiki_pages: []
post_commit_worktree_conflict: []
delivery_target:
  kind: pull_request | milestone_handoff | no_merge_required
  provider: <pull-request-only-provider>
  repository: <pull-request-only-lowercase-owner/repo>
  number: <pull-request-only-stable-pr-number>
  url: <pull-request-only-canonical-pr-url>
  target_branch: <pull-request-only-exact-target>
  accepted_head: <pull-request-only-full-commit-oid>
  milestone_id: <milestone-handoff-only-stable-id>
promotion: not_started | wiki_only | proposal_pending | declined | approved | applying | failed | completed | not_applicable
promotion_decision_sha256: <optional full normalized wiki_only/candidate decision digest>
promotion_candidate:
  id: promotion:<source-event-fingerprint>:<action>:<target-skill>:<packet-sha256>:<wiki-commit>
  source_event: <acceptance-event-id>
  wiki_commit: <sha>
  action: create | refine
  target_skill: <exact-approved-skill-name>
  packet_sha256: <64-char-lowercase-sha256>
  evidence_pages:
    - {page_id: <exact-id>, path: <path>, blob_oid: <full-blob-oid>, content_fingerprint: <sha256:...>, status: current}
  packet_ref: <structured-candidate-ref>
proposal_outbox:
  status: queued | acknowledged
  candidate_id: <same-promotion-candidate-id>
  payload_ref: <immutable-render-payload-ref>
proposal_delivery_attempts: []
approval_record: <optional-current-conversation-record>
tool_base_commit: <optional-full-tool-store-oid>
tool_event_paths: []
tool_target_baseline: <optional-tree-oid-or-absent>
tool_lock_baseline: <optional-blob-oid>
tool_staged_tree: <optional-full-tree-oid>
tool_commit: <optional-candidate-tagged-tool-commit>
promotion_error: <optional-last-error>
delivery_intents:
  - id: delivery-intent:VB-42:<64-char-lowercase-sha256>
    state: prepared | merged_proven | failed | cancelled
    acceptance_event_id: <exact-acceptance-event-id>
    scope_identity: <canonical-scope-object>
    accepted_source_fingerprint: <fingerprint>
    provider: <provider>
    repository: <lowercase-owner/repo>
    pull_request_number: <stable-pr-number>
    base_ref: refs/heads/main
    expected_base_oid: <full-commit-oid>
    expected_head_oid: <full-commit-oid>
    merge_method: merge | squash | rebase
    merge_authorization_record: <exact-current-conversation-authority-ref>
    provider_merge_commit_oid: <optional-full-commit-oid>
    provider_proof_refs: []
delivery_events:
  - id: delivery:VB-42:<fingerprint>:<merged-commit>
    state: pending | reconciled | reaccept_required | failed
    intent_id: <optional-delivery-intent-id>
    merge_origin: viberig_intent | provider_observed
    provider_merge_commit_oid: <full-commit-oid>
aggregation_events:
  - id: aggregate:<requirement-id>:<64-char-lowercase-sha256>
    insights: pending | completed | failed
    wiki: pending | writing | commit_pending | committed | zero_atoms | failed
    wiki_result_reason: <optional zero_knowledge | semantic_no_change | resolution_discarded>
    wiki_decision_sha256: <optional full normalized zero-result packet digest>
```

The record may be represented as a new append-only Issue comment or Project Update when an existing record cannot be edited. The newest record for the exact event ID in its mapped host is authoritative, but it must preserve references from earlier phases. Git transaction fields are also stored in [the wiki operation journal](../../vb-wiki/references/operation-journal.md); the journal proves filesystem/git ownership while Linear proves acceptance and orchestration authority.

For code-backed work with a direct PR delivery, persist `delivery_target.kind: pull_request` in the acceptance record before any merge attempt. Its PR identity, target branch, and full accepted head are immutable recovery evidence. An Issue whose delivery is owned by a Milestone records `milestone_handoff` plus the stable Milestone ID rather than inventing a direct-to-main PR; non-code/already-authoritative work records `no_merge_required`. A retry may enrich a missing legacy PR field only from one uniquely identified PR whose provider record and accepted source agree; ambiguity fails closed and never guesses from a title, branch display name, or newest PR.

## Entry Recovery Order

Every acceptance caller performs durable recovery discovery **before** checking a mutable workflow status or asking for a new human acceptance decision:

1. Resolve the exact scope and mapped Linear host, then search typed records for non-withdrawn acceptance events and their phase/delivery/aggregation overlays. Validate structure, recompute the accepted source fingerprint from the persisted canonical source, and require the accepted commit/record to remain resolvable. Multiple plausible active events, malformed overlays, or a fingerprint mismatch fail closed.
2. If the user explicitly asked to continue/retry, or the caller carries `learning_resume_required` for the exact event, one uniquely proven recorded event enters `recovery_only`. Resume its first incomplete requested phase; do not rerun completed Evidence/UAT, create a new event/revision, rewrite the acceptance record, or ask the user to accept the same source again.
3. A mutable Issue/Milestone status such as `pending_acceptance` gates only creation of a **new** acceptance event. It must not reject `recovery_only`: an already-`accepted` Milestone may still need wiki, delivery reconciliation, aggregation, queued-proposal replay, or its final report.
4. If the request is ambiguous between reviewing a new source and recovering an old event, report the exact event ID and ask which intent applies. Never interpret a generic “验收” request as permission to silently reuse a prior conclusion, and never interpret a recovery request as a new acceptance.
5. A current PR head that moved after acceptance does not mutate the accepted source or prevent finishing its retrospective/wiki phases. Record the delivery drift and require reacceptance before delivery; all recovery reads remain pinned to the stored accepted source.

An event is recoverable while any requested state is nonterminal, including `insights: pending|failed`, wiki `pending|writing|commit_pending|failed`, promotion `not_started|approved|applying|failed`, a queued `proposal_pending` outbox that still needs replay/acknowledgment, or delivery/aggregation/final-report work that has not been durably recorded. A queued proposal does not rerun its gate; it only replays the same candidate.

Workflow status gates only creation of a new acceptance event; it never gates recovery. A Milestone in `status: accepted` is recovery-only. `acceptance: recorded` is durable authority across retries and conversations, so recovery of the same event/source never requests acceptance again. Only missing, withdrawn, or superseded authority for a new source may require a new explicit acceptance.

## Write-Ahead Delivery Intent And Already-Merged Adoption

A provider merge is an external side effect and may succeed before VibeRig persists `delivery_event`. Therefore, after every dynamic merge gate passes but **before** calling the provider merge API, compute `delivery_intent.id` and persist exactly one complete typed record `<!-- VibeRig-Record: delivery-intent:<intent-id> -->` in the mapped Linear host. It binds the exact accepted event/source, immutable PR identity, full `expected_base_oid` / `expected_head_oid`, merge method, and `merge_authorization_record`. Zero matches permits one append; one structurally complete match is adopted; multiple, malformed, or conflicting matches fail closed. A later explicit revocation recorded against the intent takes precedence.

On every delivery entry, rebuild `delivery_intent` and `delivery_event` before checking provider state:

- `open` with a matching `prepared` intent → revalidate CI, approval, mergeability, exact base/head bindings, and absence of revocation. Invoke merge only with an atomic `expected_head_oid` precondition when the provider supports it; otherwise re-read immediately before the call and fail closed on any mismatch. Do not mint a replacement intent merely because the base/head moved;
- `closed` but not merged → stop; never manufacture delivery;
- `merged` with the matching prepared intent → enter adoption mode without another merge call. The provider's immutable repository/PR/base/head fields must equal the intent, and provider metadata must supply one unique full `provider_merge_commit_oid`; set `merge_origin: viberig_intent`;
- `merged` without a matching pre-merge intent → strict post-hoc adoption is allowed only as delivery provenance. Require immutable repository/PR identity, exact base ref, final provider head equal to `delivery_target.accepted_head` (or a pre-existing structured equivalence proof bound to both full OIDs), and one unique full `provider_merge_commit_oid`; set `merge_origin: provider_observed`. Never synthesize an intent after the fact, claim VibeRig had merge authorization, identify an actor, or reuse this observation to call a merge API.

Fetch the exact authoritative target ref and require `provider_merge_commit_oid` to resolve as a commit and pass `git merge-base --is-ancestor <provider_merge_commit_oid> <remote/base-ref>`. Never use the target branch's current `HEAD` as the merged commit: it may have advanced and would produce a drifting delivery ID. Missing/non-unique provider OID or failed reachability returns `blocked: delivery_commit_unproven`.

After proof, atomically append/overlay a matching intent as `merged_proven` when one exists; otherwise retain `provider_observed` with no fabricated intent. Derive `delivery:<scope-id>:<accepted-source-fingerprint>:<provider_merge_commit_oid>` and persist its `pending` delivery record **before** reconciliation. Zero exact typed delivery matches permits one append; one structurally complete match is adopted; multiple or malformed matches, or one PR/source mapping to different merge OIDs/events, returns `blocked: delivery_event_conflict`. A unique `pending` / `failed` event resumes only sync/Linear state updates/`reconcile_only`; `reconciled` returns immediately. No recovery path repeats acceptance, retrospective, wiki atomization, promotion evaluation, merge authorization, or the merge API.

## Transition Rules

1. Write the acceptance record once, with `insights: pending`, `wiki: pending`, `promotion: not_started`, and immutable `delivery_target` when a PR is expected.
2. Every retrospective record contains the event marker plus exactly one typed marker `<!-- VibeRig-Record: retrospective:<event-id> -->`. Before appending in `pending` / `failed`, search the mapped Issue-comment or Project-Update host by that typed marker: one structurally complete record whose scope, event kind, accepted/derived source, and required sections match is adopted as `insights_record` and marked `completed`; zero matches permits one append; multiple or malformed retrospective-kind matches return `blocked: retrospective_record_conflict` with no new record. Records of other kinds are ignored, not treated as malformed. A recorded `completed` phase whose referenced retrospective is missing/invalid also fails closed rather than re-appending.
3. Linear distillation begins only after `insights: completed`. An explicitly requested manual note uses `insights: not_applicable`; no other mode may skip the retrospective.
4. Follow [the wiki operation journal](../../vb-wiki/references/operation-journal.md). Persist base commit, exact paths/baselines, and later the staged tree before the corresponding edit/commit boundary. A unique fixed-trailer commit is adopted only after parent/tree, current-branch reachability, and durable log checks pass. Current dirty paths after a proven commit are recorded as `post_commit_worktree_conflict`; they do not erase history and are never recommitted. An unverifiable draft or mismatch fails closed. Zero admitted knowledge records `wiki: zero_atoms` plus `wiki_result_reason: zero_knowledge`; a fully deduplicated resolution uses `semantic_no_change`; an all-discarded resolution uses `resolution_discarded`. All carry `wiki_decision_sha256` and create no commit. For Linear-backed events, the exact zero-result phase record in the mapped host is the durable commit point; recovery adopts it without rerunning the editor and then repairs the local mirror. Errors record `failed` plus the first incomplete subphase.
5. Never infer promotion state from a page, log entry, or wiki commit:
   - `wiki: committed` + `promotion: not_started` → resume the promotion gate only;
   - `wiki: zero_atoms` + `promotion: not_started` → resume only the state write to `promotion: not_applicable`; never atomize or evaluate promotion again;
   - creating `proposal_pending` atomically persists the complete immutable candidate in `proposal_outbox.status: queued` before any final response;
   - while no bound yes/no exists, every eligible final report may replay the same queued candidate ID. Delivery attempts are diagnostic only and never suppress replay; at-least-once display is safer than silently losing a proposal at a process boundary;
   - a bound explicit yes/no sets outbox `acknowledged` together with `approved` / `declined`; only then does replay stop;
   - `approved` requires an `approval_record` tied to the same candidate ID, source event, and wiki commit; acceptance of the delivered work is not that record;
   - before replay/approval/application, a candidate whose bound evidence page is no longer byte-identical `current` knowledge atomically acknowledges the outbox and transitions to terminal `wiki_only` with `candidate_stale`; an uncommitted tool draft blocks this transition and is never committed;
   - terminal promotion states are `wiki_only`, `declined`, `completed`, and `not_applicable`. `approved`, `applying`, or `failed` must resume the same `vb-learn` application until its commit is proven.
6. `already_processed` is valid only when every phase requested by the caller is terminal. Otherwise return `resumed_from: <phase>` and execute only incomplete phases.
7. A partial failure never rolls back acceptance or completed phases. The acceptance caller or a later explicit retry may resume the same event without a second human acceptance. A merge-only skill must send recovery back to the acceptance caller rather than performing normal learning itself.
8. A merge-capable caller persists `delivery_intent` with the exact authorization and base/head binding before any merge API call. Retry adopts the intent; it never reconstructs authorization after the external side effect.
9. Reconciliation starts only when `wiki` is `committed` or `zero_atoms` and the delivery intent/provider commit proof is valid. Persist the exact `delivery_event.id` as `pending` before reconciliation; `reconciled` returns immediately, while `failed` resumes only reconciliation. Material drift records `reaccept_required` and performs no knowledge mutation.
10. Aggregation checks `aggregation_event.id` independently from every child event. Resume its insights/wiki subphase without altering child acceptance or promotion state.

## Milestone Delta Rule

When a Milestone includes Issue-level acceptance events, pass them as `prior_acceptance_events`. The Milestone retrospective:

- cites their accepted outcomes and wiki pages;
- emits new `retrospective_signals` only for cross-Issue integration, Milestone TC/E2E/UAT, or evidence not already covered;
- never copies an Issue signal into the Milestone event merely to update a page or re-run promotion.

## Aggregation Rule

An `aggregation_event` is derived only when every child has `insights: completed` and `wiki: committed` / `zero_atoms`. It has no `human_accepted` gate and introduces no new claims. It may summarize, cross-link, and deduplicate child results; `vb-wiki` always treats it as `aggregate_only` and skips promotion.
