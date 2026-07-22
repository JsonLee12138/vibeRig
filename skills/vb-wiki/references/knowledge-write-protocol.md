# Knowledge Write Protocol

Use this protocol only after `vb-wiki` has proved source authority, loaded the
[operation journal](operation-journal.md) plus any Linear phase state, resolved
the output language, and read the live wiki schema. This protocol turns a
knowledge-editor decision or an explicit reconciliation/consolidation plan into one
crash-recoverable git transaction. It does
not decide tool-worthiness and it never treats retrieval metadata as truth.

A page-changing operation produces the minimum useful `0..N` canonical-page
changes and exactly one knowledge commit. A zero-retention or semantic
no-change result produces no commit and still records its finalization state.

## 1. Consume The Editor's Single Decision Model

For normal/manual/skill-source distillation and aggregation, run
[the knowledge editor](knowledge-editor.md) before touching the wiki.
Acceptance-path sources include the `insights` retrospective,
`acceptance_event`, Proof Packet, acceptance comment, requirement contracts,
`accepted_commit` or accepted non-code record, and optional delivery evidence.
The retrospective is an auditable event analysis and candidate source, not a
second wiki and not the sole semantic bottleneck.

The editor may form a bounded synthesis from one or more accepted immutable
sources only when every premise is cited and the conclusion is entailed by
those premises. It may reject, narrow, or correct a retrospective signal after
checking the accepted evidence. It must not import an unaccepted change,
conversation recollection, or plausible-but-unproven cause. Acceptance proves
the identified outcome; it does not automatically prove every causal story,
preference, or generalization stated around that outcome.

Use exactly one normative intermediate model: the editor's `candidates` ledger and
`page_plans`. Do not translate it into another `knowledge_decisions` schema or
reclassify its enums.

1. Run `phase: admission` with accepted evidence. Only candidates that pass every
   value gate with `evidence_assessment.confidence: high` continue.
2. Route each admitted candidate through the retrieval protocol and read every plausible
   full canonical page. For every admitted candidate, also prepare (but do not create)
   one safe fallback project/taxonomy/path/page-ID route defined in section 3; resolution
   may ignore it when an existing page owns the knowledge object.
3. Run `phase: resolution` with the exact admission ledger, full recalled page bytes,
   and validated routing context. Then consume its ledger/page plans verbatim after
   validating their source
   IDs, target blob OIDs, paths, and schema. Never add a candidate during this step.

Truth is necessary but not sufficient; the editor owns value, evidence, boundaries,
type contracts, and discard reasons. Retrieval owns recall but cannot rescue a discard.
The SEO compiler runs only after a resolution page plan passes the critic.

Every retained candidate needs its mode's exact operation provenance:
`acceptance:...:rN`, `aggregate:...`, or
`skill-note:<skill-name>:<committed-source-tree-oid>`, plus `linear:<KEY>`,
`commit:<hash>`, `pr:<url>`, `file:<path>`, or the committed skill tree as applicable.
`accepted_unmerged` and `accepted_in_milestone` remain valid evidence states and do
not lower confidence.

Zero admitted candidates and every **non-blocked** zero-page-plan resolution create no commit. Use
`result_reason: zero_knowledge` before retrieval; `semantic_no_change` when at least
one candidate is `no_change` and every other candidate is `no_change` or resolution-
discarded; or `resolution_discarded` when all admitted candidates are discarded. For
normal acceptance/manual, mirror this as journal `phase`/wiki `zero_atoms`, skip
retrieval refresh, and set `promotion: not_applicable`.
Aggregation and skill-to-note instead keep their source event untouched and record
`promotion: skipped_aggregate` / `skipped_skill_source` on their own operation. Do not
invent another wiki state or repeat admission/resolution on retry.

`blocked_conflict` and `blocked: entity_resolution_ambiguous` are never zero results,
even though they have no page plan. Under the writer lock, persist `phase`/wiki/
`operation_result.state: failed`, exact reason `blocked_conflict` or
`entity_resolution_ambiguous`, `wiki_resume_from: resolution | entity_resolution`, and
the source-bound conflict/editor payload hash. Make zero wiki writes and leave promotion
unstarted. Retry re-reads current canonical pages and resumes that exact boundary; it
never discards the competing claims, fabricates a target, or maps the block to
`zero_atoms`.

If a separate committed operation later changes an exact candidate page blob or route
input and thereby makes the block resolvable, use the operation journal's
proved-input-change transition: archive the failed draft, increment `editor_revision` exactly once,
and permit one new resolution result hash for the unchanged source event. A different
result from unchanged input remains `blocked: editor_result_conflict`; never reinterpret
model nondeterminism as new knowledge.

## 2. Retrieve Canonical Pages Between Editor Passes

For each admitted candidate apply the write-time section of the
[retrieval protocol](retrieval-protocol.md). Search is high-recall routing only.
Read every plausible canonical page and give the full bytes to the resolution
pass; neither a qmd score nor an `index.md` line may decide identity or supply
evidence. The knowledge editor, not this write protocol, produces the final outcome:

Compare the candidate with each plausible page by semantic object, conclusion,
scope, applicability, and invalidation boundary. Produce exactly one outcome:

- `no_change` — the current page already expresses the same knowledge and the
  new source adds no material evidence, mechanism, boundary, counterexample, or
  invalidation information;
- `update` — integrate a real semantic/evidence delta into one canonical page;
- `create` — no existing page owns this independent concept or question;
- `update` with `update_mode: supersede` — accepted evidence clearly replaces or
  splits an older claim;
- `conflict` — competing accepted claims cannot yet be reconciled by
  scope/version or evidence strength. When one canonical target is proven,
  update it to `needs_revalidation`, preserve both sourced claims and the
  missing discriminator, and make no definitive recommendation. When the
  canonical target itself is ambiguous, block with zero writes.

Uncertain identity never silently appends to an unrelated page or creates a
near-duplicate. When no canonical target can be established safely, return the
protocol's explicit `blocked: entity_resolution_ambiguous` / `blocked_conflict`
outcome with zero writes.

## 3. Prepare New-Page Routes Before Resolution

After recall and before the resolution pass, classify one fallback create route for
every admitted candidate from evidence, not anticipated search reach:

- `global`: proven across codebases or an upstream language/tool/framework
  contract;
- `project`: repository convention, architecture decision, local contract, or
  project-specific gotcha;
- uncertain: `project`.

For project scope execute [project identity matching](project-identity.md).
Choose paths by technology, never page type:

- project: `~/.vb-wiki/projects/<project-key>/<tech-dir>/<slug>.md`
- global: `~/.vb-wiki/<tech-dir>/<slug>.md`

Reuse a registered taxonomy directory. Different runtimes use different
directories; cross-stack knowledge belongs in `architecture/` or another
existing platform directory. A genuinely new technology requires one taxonomy
row in `AGENTS.md` in the same commit. Slugs are stable kebab-case English and
name the durable concept, not the Issue.

Allocate one `page:<lowercase-uuid-v4>` per fallback route and persist it in the
routing context/journal plan before any page edit. Resolution ignores it for
`update`/`no_change`/`conflict`; a `create` consumes it exactly once. Never derive or
rewrite an existing page ID from its route.

## 4. Maintain Canonical Knowledge Pages

Compute one UTC date and timestamp for the operation. Render pages using the
type-specific contracts and final critic from the knowledge editor, then run
the SEO compiler from the retrieval protocol.

`seo_gap` returns the plan to the editor critic before any page edit, baseline,
staging, catalog/log change, or commit. The editor may improve the body only
when accepted evidence already supports content required by the natural knowledge/type
contract; it may not add keyword padding or invent examples merely to satisfy SEO. If
the compiler still cannot produce required body-entailed fields, persist `wiki: failed`
with `wiki_resume_from: seo_compile`, preserve the exact source/editor-result hashes,
and the operation journal's safety-filtered `editor_payload_ref`, and make zero wiki
writes. Before persisting that failure/draft, acquire the writer lock, re-read local and
Linear state, adopt any terminal winner, and apply the journal's zero/one/hash-conflict
CAS so a concurrent failure can never regress `committed`/`zero_atoms`. Retry verifies
the payload hash, accepted source, schema, candidate page blob
OIDs, and routes before resuming that compile/critic boundary; drift discards the
recovery draft and restarts retrieval/resolution with zero wiki writes.

Create:

- refuse to overwrite an existing path;
- write schema-v2 frontmatter, structured `sources` / `provenance`, project identity
  when scoped, and the post-retention retrieval fields;
- write a human learning note: current conclusion, mechanism/rationale,
  applicability and adjacent non-applicability, action/diagnosis guidance,
  an example/counterexample only when evidenced and useful, evidence, and
  invalidation conditions;
- keep acceptance IDs, commits, PRs, and delivery state in frontmatter or a
  compact provenance section. Do not make the Issue journey the page narrative;
- create `meta.md` from its template only with the first project page.

Update:

- preserve `created` and the page's language; update `updated`;
- integrate the new evidence into one coherent **current synthesis**. Do not
  append another event summary beneath the old one;
- preserve still-valid claims and sources, narrow boundaries when required,
  and remove/replace claims only through explicit supersede or conflict logic;
- recompute retrieval metadata and the body content fingerprint from the final
  planned bytes.

Supersede:

- use only when content genuinely moved, split, or became invalid;
- keep a short redirect/MOC with `status: superseded` and `superseded_by`;
- never return the superseded body as a default answer source.

Every material claim must remain traceable to an exact source. Page-level
sources are not permission to make an uncited or broader body claim.

## 5. Compile The Catalog, Log, And Commit

`index.md` is the current retrieval catalog, not history. For every
page-changing operation regenerate its deterministic current state from:

1. canonical page bytes at `HEAD` for every path outside `event_paths`; and
2. the exact planned bytes for event paths.

Never read unrelated dirty/untracked worktree bytes into the catalog. Each
canonical page appears exactly once, sorted by repository-relative path using
raw UTF-8 byte order. A superseded page has one redirect entry. Removed paths
have no current entry. The compact entry contains only `[[relative/path]]` and
the exact normalized page summary; rich SEO remains in page frontmatter/qmd and
the catalog contains no new factual claim.

Append exactly one operation entry to `log.md`:

```text
- <timestamp> — <mode> — pages: <sorted [[relative/path]], ... or none> — <reason> — <exact operation-id>
```

Never edit or delete prior log entries. The exact operation ID is mandatory so
idempotency never depends on fuzzy text. Git already preserves prior catalog
versions; do not duplicate history inside `index.md`.

Execute the journal's plan → baseline → writing → staged-tree → commit →
reachability proof exactly. `index.md`, `log.md`, every content/meta/taxonomy
path, and any schema migration path are part of the persisted event path set.
Pre-existing staged changes block the operation; unrelated unstaged paths stay
untouched. Recovery never identifies a commit from page/diff context alone and
never commits dirty bytes without the exact durably recorded staged tree.

## 6. Refresh Derived Retrieval

After the knowledge commit, follow the refresh section of the retrieval
protocol. Require a completely clean wiki worktree outside `.git` before qmd
collection/embed. Index only `current` / `needs_revalidation` canonical pages
and consult the catalog separately; exclude `index.md`, `log.md`, operation
journals, raw evidence, and superseded bodies from qmd/default answer retrieval.

Any dirty staged, unstaged, untracked, or ignored wiki path returns
`refresh_skipped_dirty_worktree`. A refresh failure is reported but never
amends, rolls back, or invalidates the knowledge commit. Zero-change operations
skip refresh.

## 7. Aggregate Accepted Child Events

Run only with `aggregate_only: true` and a canonical `aggregation_event.id`
whose full SHA-256 digest verifies against the completed child acceptance IDs
at `aggregation_event.derived_from`.

1. Require every child to have completed insights and wiki `committed` /
   `zero_atoms`; otherwise return `child_acceptance_incomplete`.
2. Candidate content is limited to claims already established by completed
   child events. Aggregation may deduplicate, cross-link, or improve a combined
   current synthesis; it may not originate a claim or raise confidence.
3. Run canonical-page resolution and the same semantic-delta rules. A combined
   retrieval representation is written only when it materially improves use;
   repeated summaries are `no_change`.
4. Record the exact aggregation event in provenance/log, create one commit only
   when pages/catalog change, and return `promotion: skipped_aggregate`.

## 8. Reconcile Delivery Provenance

Run only with `reconcile_only: true` after the base acceptance event has wiki
`committed` or `zero_atoms`; otherwise return `base_event_missing`.

1. Require `delivery_event.id = delivery:<scope-id>:<accepted-source-fingerprint>:<delivered-commit>`.
2. Compare the accepted scope's patch, contracts/configuration, and observable
   behavior with `accepted_commit`; ignore merge metadata and unrelated main
   changes. A changed hash alone is not drift.
3. Material code/configuration/dependency/contract/behavior drift records
   `reaccept_required` and makes zero wiki writes.
4. Equivalent delivery may add compact provenance to pages sourced by the
   exact acceptance event only when that evidence changes a page's provenance
   state. Recompile its catalog entry; do not re-atomize, create, or promote.
   A prior `zero_atoms` reconciles without a page.
5. Append the one reconciliation log operation only when a commit occurs and
   return `promotion: skipped_reconciliation`.

## 9. Lint, Consolidate, And Schema Migration

`vb-wiki lint` is read-only and follows [the wiki lint protocol](wiki-lint-protocol.md).
It never creates a journal, commit, or corrected claim.

Only an explicit `vb-wiki consolidate` may repair reported duplicates, links,
taxonomy, catalog drift, or legacy schema/index layout. Create/resume exactly
one `consolidate:<uuid-v4>` journal operation, plan all affected paths, preserve
user-owned dirty bytes, and commit one coherent maintenance result. Content
contradictions require accepted evidence; unresolved ones remain reported.

A legacy append-only `index.md` is not authoritative history. During explicit
consolidation, rebuild it from committed canonical pages, while preserving
history in git and `log.md`. Use this deterministic migration plan:

1. Acquire the global writer lock, pin one clean committed base tree, and inventory
   every legacy content page. Exclude schema/index/log/meta/cache/journal paths. Any
   malformed frontmatter, missing legacy `title`/`created`/`updated`/`type`/`scope`/
   non-empty `sources`, unsafe route, scope/path mismatch, duplicate target, or dirty
   affected path returns `blocked: legacy_page_unmigratable` with exact paths.
   Separately validate every `projects/*/meta.md`. Require at least one non-empty
   external identity because v1 has no root-history fingerprint; both empty returns
   `blocked: legacy_project_identity_unmigratable`. If its body contains filled base
   architecture or other non-identity knowledge, return
   `blocked: legacy_meta_knowledge_requires_review` rather than moving or hiding that
   prose. Otherwise plan the v2 identity fields with `repo_root_fingerprint` empty and
   preserve dates/identifiers.
2. Preserve each legacy Markdown body byte-for-byte. Preserve legacy source IDs and
   non-conflicting user frontmatter keys. Derive `tech` and project identity only from
   its validated route/meta. Set `page_id` deterministically to
   `page:legacy:<sha256("viberig-wiki-legacy-v2\\n" + base-page-blob-oid + "\\n")>`;
   collision blocks. Compute the body fingerprint by schema v2.
3. A page already satisfying all v2 semantic/body checks may retain `status: current`.
   Otherwise set `status: needs_revalidation`, keep unknown applicability/invalidation
   lists empty, generate no answerable query, and make `summary` state only that this
   legacy note's applicability/evidence boundary needs revalidation—never restate a
   domain claim as settled. Preserve old tags only when body-entailed; leave other SEO
   lists empty rather than inventing terms. Add migration provenance referencing the
   exact consolidation operation and legacy base tree; it records migration, not new
   acceptance of the claim.
4. Load [the pinned v1 schema](../assets/schema-v1-template.md) and first require its exact SHA-256 to be
   `f253605a2378d2a3868bbe3f22df68188e92e2d9019cb7a0793fc47107b79cce`.
   Compare live `AGENTS.md` byte-for-byte with that asset after removing only extra
   taxonomy rows located between the asset's final known table row and its following
   `(Agents: append new rows...)` line. Every extra row must match exactly
   `| \`<safe-tech-dir>/\` | <non-empty single-line description> |`, have a unique safe
   tech directory, and leave all other bytes identical to the asset. Carry those rows
   into the v2 taxonomy byte-for-byte. A bad asset digest or any other user-authored
   schema difference returns
   `blocked: wiki_schema_upgrade_required`; git retains the exact old schema/index, and
   no partial page migration is committed.
5. From all planned v2 pages, rebuild the compact path+summary catalog, append exactly
   one migration log entry with every relative page path, and commit schema, pages,
   index, and log as one journaled transaction. Rerunning from the same base produces
   identical page IDs, fingerprints, catalog, and planned bytes except the already
   persisted operation timestamp.

The v2 SEO body-entailment rule permits one narrow exception for a migrated
`needs_revalidation` summary: it may describe only editorial revalidation status already
expressed by `status`, never a domain fact. Never silently rewrite a user-modified live
schema or repair the knowledge body during migration; semantic revalidation requires
accepted evidence in a later operation.
