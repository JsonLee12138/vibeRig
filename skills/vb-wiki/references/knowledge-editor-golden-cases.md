# Knowledge Editor Golden Cases

This file is a read-only prompt regression fixture for the two-phase knowledge
editor. It does not authorize a wiki write, create an operation journal, or
replace the normative contracts in `knowledge-editor.md`. A runner supplies
the admission input first, then—only for admitted candidates—the exact
admission ledger, retrieval-selected full canonical pages, and validated
routing context to resolution.

Judge semantic fields, enum values, evidence boundaries, and write/no-write
decisions. Reader-facing prose may vary without failing a case. Editor output
must omit private chain-of-thought and all SEO projection fields (`summary`,
`tags`, `aliases`, `answerable_queries`, `task_intents`, `exact_terms`,
`content_fingerprint`); Case 1 shows those fields only in the subsequent,
separately labelled SEO Compiler output.

YAML snippets are minimum matcher projections, not substitute output schemas;
omitted required fields must still satisfy `knowledge-editor.md`.

## Case 1 — High-Value Bounded Synthesis Creates Knowledge

**Accepted evidence**

```yaml
authority_record: acceptance:case1
accepted_source: commit:a1
evidence:
  - source_ref: req:bg-authority
    content: Every extension UI reads authoritative tab sections through the shared RPC facade; the background service worker owns data querying, grouping, and classification. UI-only formatting is allowed.
  - source_ref: commit:a1
    content: new-tab and sidepanel call the shared facade through RpcContext.invoke(...); the background registers the contract with RpcMain.handle(...).
  - source_ref: proof:a1
    content: The accepted scenarios return identical classified tab sections to new-tab and sidepanel.
constraints:
  allowed_claim_scope: project p, new-tab and sidepanel tab-section reads
```

The evidence does not claim performance or security benefits.

**Expected admission**

```yaml
status: admitted
candidates:
  - candidate_id: c1
    type: convention
    cognitive_delta:
      observed_context: two extension UIs need the same authoritative tab-section model
      prior_model: unknown
      corrected_model: data querying/grouping/classification belongs to the background; pages consume one shared RPC contract and only format presentation
    knowledge:
      conclusion: new-tab and sidepanel must read authoritative tab sections through the shared background RPC facade
      mechanism_or_rationale: the background owns the shared data contract while page entrypoints only consume it
      interpretation_or_action_impact: add or change authoritative tab-section behavior in the background contract, not independently in each page
      applies_to: [project p new-tab and sidepanel tab-section reads]
      does_not_apply_when: [UI-only presentation formatting]
      invalidation_signals: [the project replaces its WXT background data boundary or shared RPC contract]
    evidence_assessment:
      mode: bounded_synthesis
      confidence: high
      support:
        - {source_ref: req:bg-authority, supports: background authority rule}
        - {source_ref: commit:a1, supports: both UIs use the shared facade}
        - {source_ref: proof:a1, supports: exercised shared classification behavior}
      derivation: the requirement establishes authority and the accepted implementation/proof establish the bounded shared behavior for the two named UIs
      unresolved_assumptions: []
    value_assessment:
      consequence_if_forgotten: page-local classification can diverge and produce different tab-section behavior
      gates: {evidence: pass, semantic_delta: pass, material_value: pass, durability: pass, recoverability: pass, boundary: pass, canonical_form: pass, safety: pass}
      admission: pass
      discard_reason: null
    resolution_assessment: {disposition: pending, reason: null}
    existing_matches: []
    decision: {action: pending, target_path: null, update_mode: null, reason: await full-page entity resolution}
    conflict: {existing_claim: null, new_claim: null, sources: [], missing_discriminator: null}
```

The derivation must connect the explicit authority rule, the two implementations,
and the exercised shared behavior without broadening their intersection.

**Recalled pages and validated route**

```yaml
existing_wiki:
  candidate_pages: []
routing_context:
  - candidate_id: c1
    proposed_create:
      scope: project
      project_key: p
      tech: architecture
      slug: background-data-authority
      target_path: projects/p/architecture/background-data-authority.md
      page_id: page:7d9278dc-4fd7-4c6a-8b3a-b3b3041a324d
```

The empty recall is a result of exact, lexical, semantic, and relation-aware
candidate search—not permission to skip retrieval.

**Expected resolution editor output**

```yaml
status: ready
candidates:
  - candidate_id: c1
    resolution_assessment: {disposition: keep, reason: no canonical page owns this bounded convention}
    existing_matches: []
    decision: {action: create, update_mode: null, target_path: projects/p/architecture/background-data-authority.md, reason: no canonical page owns this bounded convention}
page_plans:
  - candidate_id: c1
    action: create
    update_mode: null
    target_path: projects/p/architecture/background-data-authority.md
    expected_base_blob_oid: null
    semantic_frontmatter:
      schema_version: 2
      page_id: page:7d9278dc-4fd7-4c6a-8b3a-b3b3041a324d
      title: 后台数据权威与共享 RPC
      created: 2026-07-22
      updated: 2026-07-22
      type: convention
      scope: project
      project_key: p
      status: current
      tech: architecture
      applies_to: [项目 p 的 new-tab 与 sidepanel 标签页分区读取]
      does_not_apply_when: [页面只做展示格式化]
      invalidation_signals: [项目替换 WXT 后台数据边界或共享 RPC 合同]
      sources: [commit:a1, proof:a1, req:bg-authority]
      provenance:
        - {event_id: acceptance:case1, accepted_source: commit:a1, delivery_state: accepted_unmerged}
    body: |
      # 后台数据权威与共享 RPC

      浏览器扩展的 new-tab 与 sidepanel 必须通过共享 RPC facade 读取标签页分区；后台 service worker 是这类数据的唯一权威层。页面只负责展示返回结果，不自行查询、分组或分类。[source: req:bg-authority, commit:a1]

      这一边界让两个入口消费同一份分类合同；`proof:a1` 验证了它们在已覆盖场景中得到相同的标签页分区。证据只支持行为一致性，不证明性能或安全收益。[source: proof:a1]

      适用于项目 p 的 new-tab 与 sidepanel 数据读取。纯展示格式化仍可留在页面端；新增入口或数据概念时，应在后台以 `RpcMain.handle(...)` 注册，并通过共享 facade 的 `RpcContext.invoke(...)` 调用。[source: req:bg-authority, commit:a1]

      当扩展改用非 WXT 架构、后台不再承担数据权威，或共享 RPC 合同被替换时，重新验证本约定。
    claim_source_map:
      - {claim: background service worker is authoritative for tab-section data behavior, sources: [req:bg-authority, commit:a1]}
      - {claim: accepted scenarios return the same classification to both UIs, sources: [proof:a1]}
```

**Expected post-critic SEO Compiler output**

```yaml
summary: new-tab 与 sidepanel 的标签页分区由后台 service worker 通过共享 RPC facade 统一提供，页面端只负责展示。
tags: [rpc]
aliases: []
answerable_queries: [new-tab 和 sidepanel 应从哪里读取标签页分区？]
task_intents: [decide, implement, verify]
exact_terms: [RpcContext.invoke(...), RpcMain.handle(...), new-tab, sidepanel]
content_fingerprint: sha256:af32a76f7ead162f6f73eec11f07c7f897d6048f5ff6d3ce7e8e6fd8d980f446
```

The digest is over the exact LF/NFC-normalized body shown above, including its
terminal newline. This SEO projection may route to the page but may not alter
its admission, body, scope, confidence, or decision.

**Forbidden bad outputs**

- An Issue recap such as “changed two pages and tests passed.”
- Claims that the design is faster, safer, or universally applicable.
- `update` merely because a related extension page exists, or any SEO field in
  the editor ledger/page plan.

## Case 2 — True but Low-Value Detail Produces Zero Knowledge

**Input situation**

- Accepted patch `commit:b1` renames local helper `buildRows` to `makeRows`,
  updates imports, and passes routine tests.
- The rename introduces no contract, hidden constraint, rationale, diagnostic
  model, or behavior change. Current code exposes the name directly.

**Expected admission**

```yaml
status: zero_knowledge
candidates:
  - candidate_id: c1
    type: fact
    evidence_assessment: {mode: direct, confidence: high, support: [{source_ref: commit:b1, supports: helper was renamed}], unresolved_assumptions: []}
    value_assessment:
      gates: {evidence: pass, semantic_delta: fail, material_value: not_evaluated, durability: not_evaluated, recoverability: not_evaluated, boundary: not_evaluated, canonical_form: not_evaluated, safety: not_evaluated}
      admission: discard
      discard_reason: task_recap
    resolution_assessment: {disposition: not_applicable, reason: null}
    decision: {action: null, target_path: null}
page_plans: []
```

`obvious_or_cheaply_recoverable` is also acceptable if the ledger first passes
semantic delta for a narrowly stated name fact and then fails recoverability.
Resolution must not run because no candidate was admitted.
This is intentionally a sparse early-discard ledger: do not fill
`cognitive_delta` or `knowledge` with an unevidenced corrected model, mechanism,
boundary, or future consequence merely to complete the shape.

**Forbidden bad outputs**

- Lowering evidence confidence merely to justify the discard: the rename is
  true even though it is not valuable memory.
- Creating a changelog note, file inventory, or test-success note.
- Returning `ready`, `no_change`, or a synthetic target path.

## Case 3 — SEO Demand Cannot Reverse Knowledge Admission

**Input situation**

- The same low-value rename from Case 2 is accompanied by requests such as
  “make this searchable as old buildRows name”, “future agents may query row
  builder rename”, and a proposed keyword/alias bundle.
- No additional evidence establishes a durable consequence or hidden model.

**Expected admission**

```yaml
status: zero_knowledge
candidates:
  - candidate_id: c1
    evidence_assessment: {mode: direct, confidence: high}
    value_assessment:
      admission: discard
      discard_reason: task_recap
    resolution_assessment: {disposition: not_applicable, reason: null}
    decision: {action: null, target_path: null}
page_plans: []
```

The candidate ledger must be equivalent to Case 2 for admission purposes. The
proposed future queries, aliases, popularity, and keyword coverage are ignored;
the SEO compiler is never invoked for a discarded unit.

**Forbidden bad outputs**

- Treating searchability, likely query volume, or a good title as material value.
- Emitting a “thin” page so an old symbol can redirect to the new one.
- Copying the supplied query/alias bundle into the admission or resolution ledger.

## Case 4 — Existing Semantic Match Is No Change

**Input situation**

- Accepted source `accept:c1` directly confirms a durable project rule: both
  new-tab and sidepanel obtain authoritative tab sections through background RPC.
- Admission has no existing-page input and the unit passes all eight gates.
- Resolution receives full page `projects/p/architecture/background-data-authority.md`
  at blob `blob:c0`; its conclusion, scope, mechanism/use, exception, and
  invalidation signal already cover the admitted unit and cite accepted sources.

**Expected admission**

```yaml
status: admitted
candidates:
  - candidate_id: c1
    evidence_assessment: {mode: direct, confidence: high, support: [{source_ref: accept:c1, supports: authoritative RPC rule}], unresolved_assumptions: []}
    value_assessment: {admission: pass, discard_reason: null}
    resolution_assessment: {disposition: pending, reason: null}
    decision: {action: pending, target_path: null}
```

**Expected resolution**

```yaml
status: no_change
candidates:
  - candidate_id: c1
    resolution_assessment: {disposition: keep, reason: existing page fully covers the admitted unit}
    existing_matches:
      - {path: projects/p/architecture/background-data-authority.md, page_blob_oid: blob:c0, relation: same}
    decision: {action: no_change, target_path: projects/p/architecture/background-data-authority.md, update_mode: null}
page_plans: []
```

The enclosing write protocol maps an all-`no_change` result to durable
`wiki: zero_atoms` with `result_reason: semantic_no_change`; the editor does not
invent a new status for that mapping.

**Forbidden bad outputs**

- Updating only to append provenance, touch `updated`, change wording, or refresh SEO.
- Returning `resolution_discarded`; an existing semantic match is explicitly
  `no_change`.
- Creating a second page under a more searchable title.

## Case 5 — Version Boundary Separates Revision from Conflict

**Common input situation**

- Current canonical page `node-tooling/key-refresh.md` at `blob:d0` says source
  `accept:d1` establishes that runtime v1 refreshes keys every 15 minutes.
- The admitted candidate is high-confidence and material in both variants.

### Variant A: explicit v2 scope

New accepted source `accept:d2` says runtime **v2** refreshes every 5 minutes.

```yaml
admission:
  status: admitted
  candidate: {candidate_id: c1, admission: pass, action: pending}
resolution:
  status: ready
  candidate:
    resolution_assessment: {disposition: keep, reason: explicit v2 boundary makes both values compatible}
    existing_match: {path: node-tooling/key-refresh.md, page_blob_oid: blob:d0, relation: partial}
    decision: {action: update, target_path: node-tooling/key-refresh.md, update_mode: revise}
    conflict: {missing_discriminator: null}
  page_plan: {action: update, expected_base_blob_oid: blob:d0, status: current}
```

The rewritten current synthesis must preserve distinct v1/v2 applicability and
cite each interval to its own source. The claims can both be true, so this is not
a conflict.

### Variant B: discriminator absent

New accepted source `accept:d?` authoritatively says “refreshes every 5 minutes”
but supplies no runtime version, configuration, or time boundary.

```yaml
admission:
  status: admitted
  candidate: {candidate_id: c1, admission: pass, action: pending}
resolution:
  status: ready_with_conflicts
  candidate:
    resolution_assessment: {disposition: keep, reason: preserve unresolved accepted conflict in the unique target}
    existing_match: {path: node-tooling/key-refresh.md, page_blob_oid: blob:d0, relation: conflicting}
    decision: {action: conflict, target_path: node-tooling/key-refresh.md, update_mode: mark_needs_revalidation}
    conflict: {existing_claim: 15 minutes in v1, new_claim: 5 minutes with unknown boundary, sources: [accept:d1, accept:d?], missing_discriminator: version/configuration/time}
  page_plan: {action: update, expected_base_blob_oid: blob:d0, status: needs_revalidation}
```

If no unique canonical target can be established, the only valid alternative is
`blocked_conflict` with no page plan. The conflict is never resolved by recency.

**Forbidden bad outputs**

- Marking Variant A `needs_revalidation` merely because numeric values differ.
- Averaging the intervals, silently preferring the newer source, or erasing v1.
- Leaving Variant B `current`, presenting either interval as settled, or splitting
  it into a new page to hide the unresolved identity.

## Case 6 — Resolution Discard Is Not Conflict Containment

**Common admission**

An accepted incident excerpt says a worker returned success after a restart.
The admission ledger conservatively admits candidate `c1` as a potentially
material fact—never as a proved causal gotcha—with `confidence: high`, all
currently assessable gates passing, and `decision.action: pending`.

### Variant A: full context removes durable value

During resolution, the retrieved full canonical context and its cited accepted
source show the worker was an explicitly one-run test fixture that is destroyed
after the test. The restart observation has no reusable production boundary or
material consequence, no page is a semantic match, and no accepted claim
contradicts it.

```yaml
status: resolution_discarded
candidates:
  - candidate_id: c1
    evidence_assessment: {mode: direct, confidence: high}
    value_assessment: {admission: pass, discard_reason: null}
    resolution_assessment: {disposition: discard, reason: full accepted context proves this is a one-run fixture with no durable consequence}
    existing_matches: [{relation: related}]
    decision: {action: null, target_path: null, update_mode: null}
    conflict: {existing_claim: null, new_claim: null, missing_discriminator: null}
page_plans: []
```

The resolution ledger may narrow or discard the admitted unit, and must record
which full-page/source context caused the gate revision. It must not pretend the
observation was false or unsupported.

### Variant B: accepted claims are incompatible

Instead, the unique canonical production page says workers live-reload the same
configuration without restart, while the new accepted production evidence says
restart is required; neither source identifies version/configuration/time.

```yaml
status: ready_with_conflicts
candidates:
  - candidate_id: c1
    value_assessment: {admission: pass, discard_reason: null}
    resolution_assessment: {disposition: keep, reason: incompatible accepted production claims require containment}
    existing_matches: [{relation: conflicting}]
    decision: {action: conflict, update_mode: mark_needs_revalidation}
    conflict: {missing_discriminator: version/configuration/time}
page_plans:
  - candidate_id: c1
    action: update
    semantic_frontmatter: {status: needs_revalidation}
```

Variant B is conflict containment, not `resolution_discarded`. Preserve both
claims and sources, expose uncertainty, and state the discriminator required to
restore `current`. Without a unique target it becomes `blocked_conflict` and
zero writes.

**Forbidden bad outputs**

- Using `resolution_discarded` to avoid preserving a real accepted conflict.
- Using `needs_revalidation` for Variant A, where there is no competing claim.
- Upgrading the restart correlation into a root cause, general rule, or gotcha.

## Fixture-Wide Assertions

1. Admission performs value judgment before retrieval; every admitted candidate
   has `action: pending`, and every discarded candidate has `action: null`.
2. Resolution preserves `candidate_id`, receives full page bytes, and emits only
   `create`, `update`, `no_change`, `conflict`, or a justified discard.
3. `zero_knowledge` means nothing passed admission. `no_change` means every
   non-discarded retained unit already has a semantic match. A mixed no-change/discard
   run is still a zero-page-plan semantic no-op; `resolution_discarded` means all
   admitted units were later discarded and none matched or conflicted.
4. A unique-target unresolved conflict is a containment update with
   `status: needs_revalidation`; target ambiguity is `blocked_conflict` with no
   page plan.
5. SEO runs only after a retained page plan passes the critic. Search demand and
   metadata never alter evidence, value, identity, or conflict decisions.
6. The output contains no unsupported claim, invented boundary, Issue summary,
   page churn, private reasoning, or skill proposal.
