# Wiki Operation Journal

Use this journal for every write-capable `vb-wiki` mode. It supplies machine transaction identity and crash recovery; it never grants acceptance, proves a knowledge claim, routes retrieval, replaces the human `log.md`, or grants tool-installation authority. Read-only query and lint modes create no journal.

## Storage And Authority

- Store one atomic JSON record at `~/.vb-wiki/.git/viberig/operations/<key>.json`, where `<key>` is the full lowercase SHA-256 hex digest of the UTF-8 operation ID. The JSON body repeats the exact operation ID and uses `schema_version: 1`.
- Write updates through a temporary file in the same directory followed by an atomic rename. Never truncate the last valid record in place.
- Linear acceptance, aggregation, and delivery events also keep their human/audit phase state in the mapped Linear finalization host (Issue comments or registered Project Updates). The local journal is authoritative for git/tool transaction identity and atomic writer/promotion-decision ownership; Linear remains authoritative for acceptance, human approval, and orchestration state and mirrors the proven local result.
- Manual notes, skill-to-note, consolidation, and their promotion decisions have no mandatory Linear scope, so this journal stores their complete phase and approval state.
- On a Linear/journal mismatch, never regress or guess. Verify the journal against git, then append/repair the Linear phase record from proven state. An unproven journal never upgrades Linear to `committed`.

The `.git/viberig/` directory is local transaction metadata. Never stage it, expose sensitive conversation content in it, index it for retrieval, or treat its presence as a knowledge commit.

A write-capable distillation may atomically store each critic-approved,
safety-filtered resolution ledger/page plan as an immutable revision envelope at
`.git/viberig/drafts/<operation-key>/r<editor_revision>.json`, where the revision is a
positive base-10 integer without leading zeros. Create the owner-only directory and file
through a unique sibling temporary file, fsync file and directory, then atomically rename
with no replacement; an existing revision is adopted only when its complete JCS bytes
match. The envelope contains the revision, `editor_input_sha256`,
`editor_result_sha256`, and payload. Store no raw conversation, private reasoning,
discarded sensitive material, or secret. Canonicalize the payload with JCS, record its
full SHA-256 as `editor_result_sha256`, and bind `editor_payload_ref` to that exact
revision path plus accepted source, schema version, and literal
`editor_contract_version: 1`. This is recovery data only: never stage, index, cite, or
use it for retrieval. After a terminal commit or zero result is durable in every required
state store, delete all revision envelopes for the operation; journaled hashes remain the
audit identity and any historical payload refs are intentionally no longer
dereferenceable.

## Operation IDs

- Linear/manual distillation: exact `acceptance_event.id`.
- Repository bootstrap: `bootstrap:v1`.
- Requirement aggregation: exact `aggregation_event.id`.
- Delivery reconciliation: exact `delivery_event.id`.
- Skill-to-note: `skill-note:<skill-name>:<committed-source-tree-oid>`. Refuse an uncommitted source skill.
- Consolidation: `consolidate:<uuid-v4>`. Before planning, scan journals for nonterminal consolidation operations. Exactly one is resumed; more than one returns `blocked: consolidation_state_ambiguous`; none creates and atomically persists a new UUID record before any page scan or edit. A later request after a terminal run receives a new UUID.

## Required Record

```json
{
  "schema_version": 1,
  "operation_id": "acceptance:VB-42:<fingerprint>:r1",
  "mode": "distill",
  "phase": "planned",
  "base_commit": "<full-wiki-head-oid-or-unborn>",
  "event_paths": ["index.md", "log.md", "projects/example/go/example.md"],
  "path_baselines": {
    "index.md": "<blob-oid>",
    "log.md": "<blob-oid>",
    "projects/example/go/example.md": "absent"
  },
  "staged_tree": null,
  "wiki_commit": null,
  "result_reason": null,
  "decision_sha256": null,
  "editor_revision": 0,
  "editor_input_sha256": null,
  "editor_result_sha256": null,
  "editor_payload_ref": null,
  "editor_attempts": [],
  "operation_result": {
    "state": "pending",
    "reason": null,
    "promotion_result": "not_started"
  },
  "post_commit_worktree_conflict": [],
  "semantic_state": {
    "accepted_source_fingerprint": "<canonical-fingerprint>",
    "acceptance": "recorded",
    "revision": 1,
    "insights": "not_applicable",
    "wiki": "pending",
    "wiki_result_reason": null,
    "wiki_decision_sha256": null,
    "promotion": "not_started",
    "promotion_decision_sha256": null,
    "promotion_candidate": null,
    "proposal_outbox": null,
    "proposal_delivery_attempts": [],
    "approval_record": null,
    "tool_transaction": null
  },
  "last_error": null
}
```

Paths are repository-relative, unique, and sorted by raw UTF-8 bytes. A baseline is the exact `HEAD:<path>` blob OID or `absent`. Never put `~/.vb-wiki/.git/**` in `event_paths`.

For manual events, `semantic_state` is mandatory and follows the acceptance-learning enums and candidate/approval fields. For Linear-backed operations it is a recoverable mirror, not a replacement for the Linear record. `tool_transaction` stores the approved candidate's base commit, exact target/lock paths and baselines, staged tree, and proven tool commit.

`mode` is exactly one of `distill`, `aggregate`, `reconcile`, `skill_to_note`,
`consolidate`, or `bootstrap`; reject every other spelling. It must agree with the
operation ID contract above (`acceptance:*`, `aggregate:*`, `delivery:*`,
`skill-note:*`, `consolidate:<uuid-v4>`, or `bootstrap:v1`) before state adoption.

`phase` is one of `pending`, `planned`, `writing`, `commit_pending`, `committed`,
`zero_atoms`, `no_change`, or `failed`. `operation_result.state` is one of `pending`,
`committed`, `zero_atoms`, `no_change`, or `failed`. Its `promotion_result` is one
acceptance promotion enum or one of `skipped_aggregate`, `skipped_reconciliation`,
`skipped_skill_source`, and `skipped_consolidation`. Mode-local terminal closure is
exact:

- acceptance/manual distillation: committed plus a terminal promotion phase, or
  `zero_atoms` + `not_applicable`;
- aggregate: `committed | zero_atoms | no_change` + `skipped_aggregate`;
- skill-to-note: `committed | zero_atoms | no_change` + `skipped_skill_source`;
- reconciliation: `committed | no_change` + `skipped_reconciliation` (material drift
  uses `no_change`, reason `reaccept_required`);
- consolidation/migration: `committed | no_change` + `skipped_consolidation`;
- bootstrap: `committed` + `not_applicable`.

Only those pairs are terminal for `already_processed`. Mode-specific no-change reasons
are `aggregate_no_change`, `skill_source_no_change`,
`delivery_equivalent_no_provenance_delta`, `reaccept_required`, and
`maintenance_no_change`; the three editor zero reasons remain reserved for
distillation/aggregation/skill-source editor output.

`blocked_conflict` and `entity_resolution_ambiguous` use `phase` and
`operation_result.state: failed`; they are nonterminal, retain the exact conflict/editor
payload hash, and resume only `resolution` or `entity_resolution`. They never become
`zero_atoms` merely because `event_paths` is empty.

## Atomic Ownership

Admission/retrieval/lint may run concurrently, but mutations are serialized:

- Before persisting any page-changing, zero-change, or `seo_compile` failure result,
  acquire `.git/viberig/wiki-writer.lock/` with an owner record containing operation ID,
  journal key, base commit, random nonce, process/host identity, and timestamp. Hold it
  through commit proof, the durable zero-change result, or the CAS-proven failure
  record. After acquisition, re-read
  the event state first; an already-terminal winner is adopted. A different owner returns
  `blocked: wiki_writer_busy` before editing. Revalidate `HEAD`, candidate blobs,
  catalog inputs, and all baselines after acquisition.
- Before evaluating `promotion: not_started`, replaying/acknowledging an outbox, or
  applying an approval, acquire the event-scoped atomic directory
  `.git/viberig/promotion-locks/<event-key>.lock/`. Under that lock, compare the latest
  Linear state and local semantic state, then persist exactly one normalized
  `wiki_only` or immutable candidate decision plus its full SHA-256 before mirroring it
  to Linear. A loser adopts that exact decision; it never evaluates another packet.
- Atomic acquisition has no ownerless window: create a unique sibling temporary
  directory, fully write/fsync its `owner.json`, then atomically rename that directory
  to the final lock name with no-replace semantics. A pre-existing target loses the
  race; an orphan temporary directory is not a lock and may be quarantined only after
  its recorded process is proven gone. Use the same algorithm for promotion locks.
  Never `mkdir` the final lock before its owner exists, use check-then-write, or steal
  ownership by timestamp age alone.

A retry with the same operation may recover a dead owner's lock only after proving the
recorded owner process is gone (when local process identity is verifiable), the owner
journal and git/tool state have one unambiguous recovery boundary, and the lock owner
bytes/inode remain unchanged during an atomic rename to a unique quarantine path. A
different operation may take over only when the prior journal is terminal and the wiki
index/worktree are clean, or after explicit human recovery. Dirty unverifiable event
paths remain blocked; ownership recovery never makes their bytes valid. Release deletes
only the exact nonce-owned lock after terminal state is durable.

Under the writer lock, re-read local/Linear state before persisting `failed` or its
editor draft. A terminal `committed`/`zero_atoms` winner is adopted and can never be
overlaid by a later failure. Canonicalize the complete safety-filtered editor invocation
with JCS and store its SHA-256 as `editor_input_sha256`. The packet includes the editor
phase, literal `editor_contract_version: 1`, accepted-source fingerprint, schema version, admission
ledger, sorted candidate page paths and blob OIDs, and exact routing context; it excludes
retrieval scores and generated SEO fields. Zero prior editor result starts
`editor_revision: 1`. The same input plus the same result is adopted; the same input plus
a different result returns `blocked: editor_result_conflict` without overwriting either
state.

A different input may supersede a nonterminal failed draft only when the current
committed wiki `HEAD` proves that a candidate page blob OID or route availability used by
that operation changed after the archived attempt. Under the same writer lock, compute
revision `N+1`, create and fsync its immutable envelope first, then perform one journal
compare-and-swap against the unchanged revision-`N` record that both appends the prior
revision, input/result hashes, payload reference, candidate blob/route proof, and base
commit to `editor_attempts` and installs the new current revision/input/result/ref. Only
after that local CAS succeeds may the runner mirror the same revision and hashes to the
mapped Linear phase record and treat the new attempt as authoritative. A crash before
the journal CAS leaves at most an unreferenced `r<N+1>.json`; recovery never treats its
presence as authority, but may adopt its exact bytes while repeating the same CAS only
when the prior journal digest and input-change proof still match. Any byte mismatch
returns `blocked: editor_revision_conflict` without replacement or deletion.

The accepted source and operation ID stay unchanged. Schema/editor drift alone, absent
proof, a skipped revision, or rewritten attempt history also returns `blocked:
editor_revision_conflict`. Archived drafts are recovery evidence, never canonical
knowledge or retrieval input.

## Bootstrap Recovery

Bootstrap is the fixed `bootstrap:v1` operation and creates only missing `AGENTS.md`, `index.md`, and `log.md` from the installed schema-v2 templates.

- If the directory is not a git repository, initialize it, atomically create the bootstrap journal with `base_commit: unborn`, then write only absent template files.
- If a crash left an unborn repository before the journal landed, resume only when every present required file is byte-identical to its template and every other path is untouched; otherwise return `blocked: bootstrap_conflict`.
- Stage only the required files, persist `staged_tree`, and commit once with `VibeRig-Operation: bootstrap:v1`. A unique reachable matching commit plus required files proves completion.
- If an existing repository already has all required files and no bootstrap marker, write no synthetic bootstrap commit. Validate the live schema marker and catalog contract. A legacy append-only `index.md` or pre-v2 schema is recoverable history but not a valid current retrieval surface: normal writes return `blocked: wiki_schema_upgrade_required` until an explicit `vb-wiki consolidate` operation rebuilds the catalog and safely migrates package-owned schema sections. Never silently overwrite user-authored schema prose or taxonomy rows, and never compare a live initialized file byte-for-byte with its original template.

## Safe Write Transition

1. **Plan read-only**. Resolve retained knowledge decisions, canonical-page targets, type-specific body changes, deterministic current-catalog output, the one append-only log entry, meta/taxonomy/schema effects, and the complete event path set before changing a wiki file. Build `index.md` from `HEAD` bytes outside `event_paths` plus exact planned event bytes; never absorb unrelated dirty or untracked pages into it. For a schema-v2 operation, require the base `log.md` to contain zero canonical entries whose final operation-ID field exactly equals this operation ID; otherwise adopt the already-proven operation or return `blocked: operation_log_conflict` before editing.
2. **Prove a clean base**. Require no staged changes anywhere in the wiki repository. Require every event path to match its `HEAD` baseline and have no unstaged change. Unrelated unstaged paths may remain untouched. Capture full `HEAD` (or `unborn` only for bootstrap), paths, and baselines; atomically persist `phase: planned` before editing.
3. **Enter writing**. Mirror `wiki: writing` to the Linear state when applicable, then edit only the persisted event paths. If recovery finds dirty event paths while no matching `staged_tree` was durably recorded, return `blocked: wiki_draft_unverifiable`; do not assume those bytes belong to this operation.
4. **Stage exactly once**. Verify `HEAD == base_commit`, the index was clean before this operation, and only `event_paths` are staged. Require no unstaged diff on those paths. Run `git write-tree`, persist its full OID as `staged_tree`, then set journal/Linear to `commit_pending`. A retry may proceed only when current `HEAD`, staged path set, and `git write-tree` exactly match the journal; otherwise return `blocked: wiki_worktree_conflict` with zero writes.
5. **Commit**. Commit the staged tree once with fixed trailer `VibeRig-Operation: <operation-id>`. The commit's first parent must equal `base_commit` and its tree must equal `staged_tree`; `bootstrap:v1` with `base_commit: unborn` is the sole exception and must create a parentless root commit.
6. **Prove reachability and durability**. A schema-v2 page-changing operation is committed only when exactly one fixed-string trailer match exists, that commit is an ancestor of current `HEAD`, and its parent/tree match the journal. Inspect the matching commit tree and parent diff—not mutable current worktree bytes—and require `log.md` to gain exactly one canonical line whose final field is the exact operation ID, with no prior log line deleted/rewritten and zero such lines in the parent. Enumerate every canonical page in that commit tree, validate schema/status/sources/provenance/body fingerprint and globally unique page IDs, deterministically rebuild the complete compact catalog, and require byte equality with that commit's `index.md`. This proves a total bijection: exactly one path+summary entry per canonical page, no duplicate and no dangling entry. For recovery of a pre-v2 operation only, multiple historical per-page log lines are tolerated when every matching line was introduced by that same uniquely proven commit; never rewrite them during recovery. Bootstrap instead verifies its exact required-file tree and current structural presence; it does not add a log entry. The log is a durable human receipt, but the journal parent/tree/trailer proof remains the machine identity. Then persist `wiki_commit` and `phase: committed`.
7. **Separate later edits**. Current dirty event paths do not invalidate a proven historical commit. Record them as `post_commit_worktree_conflict`, perform no additional page write, and read promotion evidence from the committed tree. Any dirty or untracked wiki path—including an unrelated user draft—also suppresses retrieval refresh so uncommitted bytes never enter search. Never recommit or absorb those bytes.

Together with the proven `wiki_commit`/`phase: committed`, persist
`operation_result.state: committed` and the mode's promotion result: `not_started` for
an eligible fresh acceptance, otherwise the exact `not_applicable` or `skipped_*`.

If a matching trailer commit exists before phase persistence, run steps 6–7 and adopt it. Zero matches mean the commit is not proven; multiple matches return `blocked: operation_history_ambiguous`. A matching commit that is not reachable from current `HEAD` returns `blocked: operation_commit_unreachable`; never mark it committed or merge/cherry-pick it without separate authority.

## Zero-Change Operations

For zero admitted knowledge or a zero-page-plan resolution containing only
`no_change`/resolution-discarded candidates, persist `phase: zero_atoms` with
`result_reason: zero_knowledge | semantic_no_change | resolution_discarded`; mirror it as
`wiki_result_reason` for Linear/manual semantic state. Keep `event_paths: []`, create
no wiki commit, and do not run retrieval refresh. Only normal acceptance/manual sets
`promotion: not_applicable`; aggregate and skill-source operations record
`operation_result.state: zero_atoms` plus their own `skipped_*` result without altering
a source acceptance event. Reconciliation and
consolidation persist `phase`/`operation_result.state: no_change`, their exact reason
above, and their required `skipped_*` promotion result.

Build a normalized zero-result packet from the exact operation ID, accepted-source
fingerprint, editor/schema version, result reason, and complete final candidate-ledger
hash; store its full SHA-256 as `decision_sha256` / `wiki_decision_sha256`. For a
Linear-backed acceptance or aggregate, persist the exact typed phase overlay with
`zero_atoms`, reason, and digest in the mapped host **before** marking the local journal
terminal: zero matching records permits one append, one structurally matching record is
adopted, and multiple/malformed/digest-mismatched records return
`blocked: zero_result_conflict`. That mapped record is the no-commit durable boundary;
a crash after it is repaired into the local mirror without rerunning the editor. Manual
and skill-to-note operations have no Linear host, so their atomic local journal record is
the durable boundary. Never let a local hash grant human acceptance or approval.
