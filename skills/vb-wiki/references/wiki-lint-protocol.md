# Wiki Lint Protocol

Use this protocol to health-check the committed `~/.vb-wiki` knowledge base in the spirit of [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f): the wiki is a compiled, evolving synthesis, so lint asks whether its current knowledge is internally coherent, current within its stated boundaries, connected, and retrievable. Lint diagnoses; it does not ingest sources, create knowledge, or repair files.

## 1. Authority And Safety Boundary

- The default and only implicit mode is `lint_only`: read the committed wiki snapshot and return a report with zero filesystem, git, index, journal, Linear, or tool-store writes.
- A lint finding is diagnostic evidence about the wiki, not evidence that a domain claim is true or false. It never grants acceptance authority and cannot originate a knowledge atom.
- Do not turn a suspected contradiction, stale claim, missing concept, search result, repository observation, or model inference into canonical knowledge. A question is not a fact, and absence from the wiki is not proof of absence in the domain.
- Do not run `qmd embed`, regenerate SEO, edit `index.md` / `log.md`, create placeholder pages, change links, or stage/commit files during lint. Read-only search is allowed.
- A content or metadata repair requires a later, separately authorized and journaled consolidation or maintenance operation. It must follow [the operation journal](operation-journal.md), use a fresh operation ID, prove path baselines and staged tree, and create its own commit. Never reuse a lint run ID as a write operation ID.
- Existing accepted sources may support a maintenance edit only to the extent they already entail it. A new or broadened claim, a conflict resolution not proved by existing sources, or an answer to a knowledge gap must return to the normal source/acceptance path.
- External research may be suggested as a next question. Even when the user separately authorizes a search, its result remains a candidate source and cannot bypass VibeRig's acceptance gate.

## 2. Snapshot And Corpus

Lint a stable committed snapshot, not a mixture of committed knowledge and user drafts.

1. Resolve the full `HEAD` OID as `scanned_commit`. An unborn or missing repository returns `blocked: wiki_not_initialized` with zero writes.
2. Record staged, unstaged, untracked, and ignored paths as `worktree_observations`, but read canonical pages, their retrieval frontmatter, schema, and catalog from `scanned_commit`. Never treat dirty worktree bytes as current knowledge or modify them.
3. Read `AGENTS.md` first, then inventory all committed Markdown content pages, `index.md`, and project `meta.md` files. Exclude `log.md` from current-domain-claim comparison; it is an episodic audit trail, not canonical knowledge. Exclude `.git/**` entirely.
4. Classify each artifact as canonical content plus its derived retrieval frontmatter, navigation/catalog, project identity, or schema. Retrieval frontmatter and an `index.md` entry are never independent knowledge sources.
5. Build these read-only views:
   - page inventory keyed by repository path, slug, scope, project identity, and canonical page identity;
   - link graph from frontmatter relations and body `[[wikilinks]]`;
   - claim view containing conclusion, applicability / `when_not`, mechanism or rationale, operational implication, version/condition qualifiers, evidence, and invalidation signals;
   - retrieval mapping from each schema-v2 `page_id` to its path, flat retrieval fields, `content_fingerprint`, `status`, and one `index.md` entry;
   - concept mentions and unanswered questions used only for gap detection.

If `HEAD` changes while lint is running, discard the report and restart against the new snapshot. A report must describe exactly one `scanned_commit`.

## 3. Reasoning Posture

For every candidate finding, reason like a careful human editor rather than a keyword checker:

1. **What question is this page intended to answer?** Separate the durable answer from task history and delivery metadata.
2. **Under what exact scope, version, state, preconditions, and `when_not` boundary is the answer claimed?** Two different answers are not contradictory when their applicability does not overlap.
3. **What accepted evidence supports the answer?** Distinguish a source-backed conclusion from an inference made only by the linter.
4. **What would invalidate it, and has that signal actually occurred?** Missing a review date is not itself proof that a claim is stale.
5. **Can a future agent find and safely apply it?** Check canonical identity, SEO freshness, links, aliases, scope, and version boundaries without changing the content.
6. **What concrete harm follows if this is left unresolved?** Prefer a small number of actionable findings over generic style criticism.

Before reporting, try to disprove the finding. Read the full candidate pages and their applicability/evidence sections; never decide contradiction, duplication, or staleness from titles, snippets, embeddings, timestamps, or similarity scores alone.

## 4. Finding Classes

### 4.1 Contradictions

Report `contradiction` only when two current canonical claims:

- address the same subject and decision/question;
- have overlapping scope, project identity, versions, conditions, and time state; and
- assert conclusions that cannot both be followed.

Classify the result:

- `confirmed` — the incompatibility and overlapping applicability are explicit in the pages;
- `possible` — wording suggests tension but scope, version, evidence, or terminology is too incomplete to prove it;
- `historical_not_conflict` — one page is a valid superseded MOC or the claims apply to different regimes; omit this from actionable findings and include it only in scan metrics when useful.

Never choose a winner from recency alone. Cite both paths, the exact conflicting claims in paraphrase, the overlapping boundary, and the accepted sources that would need comparison. If existing evidence cannot resolve it, recommend a clarification or new accepted source—not a content edit.

### 4.2 Staleness And Invalidation

Evaluate each page's stated invalidation signals against newer accepted wiki sources and explicit committed provenance.

- `invalidated` — a named invalidation signal is demonstrably satisfied by accepted evidence, or a newer accepted source explicitly supersedes the claim.
- `possibly_stale` — the page lacks enough version/condition information, its source is no longer verifiable, or an invalidation signal may have occurred but is not proved.
- `missing_invalidation_contract` — the page lacks the schema-required invalidation section or gives only unusable wording.
- `delivery_misstatement` — an `accepted_unmerged` / `accepted_in_milestone` source is described as already delivered, or delivery provenance is presented as knowledge truth.

Age alone is never staleness. A newer page is not automatically more correct, and an external current version observed by lint is not accepted evidence. Report the triggering signal and the boundary affected; do not silently rewrite or delete the old conclusion.

### 4.3 Orphans And Missing Cross-References

Build inbound edges only from non-superseded canonical content pages. `index.md`, flat retrieval frontmatter, logs, self-links, and superseded MOCs pointing only to themselves do not count as semantic inbound links.

- `orphan_page` — a current non-MOC page has zero meaningful inbound links.
- `missing_cross_reference` — two pages explicitly depend on or explain one another, but no navigable relation exists.
- `isolated_cluster` — a group is internally linked but disconnected from every relevant concept hub.

An orphan is a retrieval risk, not proof that the page is wrong or must be merged. Report the page's likely entry concepts and candidate existing targets. Do not invent a relationship merely to eliminate zero-degree nodes; `no_fix_recommended` is valid when SEO already makes a legitimately standalone page easy to retrieve.

### 4.4 Broken Or Ambiguous Links

Inspect both inline wikilinks and typed frontmatter relations.

- `broken_link` — no committed canonical or superseded target resolves.
- `ambiguous_link` — a pathless slug resolves to multiple pages and the schema provides no unique canonical identity.
- `invalid_relation` — relation value/type violates schema, points to itself without a meaningful recursive concept, or points through an invalid redirect chain.
- `redirect_cycle` — `superseded_by` / MOC links form a cycle or fail to terminate at a current canonical page.

Report the source path, relation or line context, target token, and all candidates. A plausible spelling match is only a repair suggestion; lint must not select or write it.

### 4.5 Duplicate Pages And Canonical Collisions

Use exact identity, normalized titles/aliases, answerable questions, claims, scope, sources, and semantic similarity to retrieve candidates, then read the full pages.

- `exact_duplicate` — two current pages express the same supported knowledge, applicability, and intended future use.
- `partial_overlap` — pages share material but each retains distinct useful knowledge; recommend boundaries or cross-links, not automatic merging.
- `canonical_collision` — the same canonical `page_id`, slug resolution, or catalog identity maps to multiple pages.
- `alias_collision` — one retrieval alias/query route points to unrelated canonical meanings.

Similarity is candidate generation only. Do not merge pages that differ by project, version, runtime, precondition, or decision context. A proposed winner must be justified by canonical coverage and source preservation; unresolved ownership remains a finding.

### 4.6 SEO And Catalog Drift

SEO is a derived retrieval projection, never the knowledge itself. Schema v2 stores it as flat canonical-page frontmatter plus a Markdown current-state `index.md`; there is no nested `seo` object and no separate SEO document. `page_id` is the canonical identity, while `status` is exactly `current`, `needs_revalidation`, or `superseded`.

For every canonical page:

1. Parse the Markdown body after the closing frontmatter delimiter; frontmatter bytes are not part of the fingerprint.
2. Normalize the body to Unicode NFC and line endings to LF.
3. Hash the exact normalized UTF-8 body with SHA-256 and encode the full 64-character lowercase hex digest as `sha256:<digest>`.
4. Compare it byte-for-byte with the flat `content_fingerprint` field.
5. Verify `schema_version: 2`, a globally unique `page_id` matching exactly `page:<lowercase UUID-v4>` or `page:legacy:<64 lowercase hex>`, a valid status, non-empty structured `sources` / `provenance`, and that `summary`, `tags`, `aliases`, `answerable_queries`, `task_intents`, `exact_terms`, `applies_to`, `does_not_apply_when`, and `invalidation_signals` are entailed by the canonical body rather than adding claims. The sole exception is a deterministic legacy-migration summary that says only the page requires editorial revalidation and makes no domain claim.
6. Verify `index.md` is Markdown current state with exactly one entry per canonical path, sorted by raw UTF-8 bytes, and that its path and complete normalized summary match the page. Independently validate the rich SEO fields in page frontmatter.

Report:

- `content_fingerprint_drift` — the recomputed body hash differs from `content_fingerprint`;
- `content_fingerprint_unverifiable` — frontmatter/body boundaries or Unicode/line-ending normalization cannot be applied deterministically;
- `retrieval_metadata_missing` — a schema-v2 page lacks one or more required flat retrieval fields;
- `seo_semantic_drift` — a flat retrieval field is no longer entailed by the canonical body even if `content_fingerprint` still matches;
- `seo_overreach` — retrieval wording broadens the body's claim or hides a `does_not_apply_when` / invalidation boundary;
- `status_mismatch` — a `current` page has a proved invalidation trigger, a `needs_revalidation` page is routed as unconditional current knowledge, a superseded page is routed as current, or status uses a value outside the schema-v2 enum;
- `seo_catalog_missing` — a canonical page has no current `index.md` entry;
- `seo_catalog_duplicate` — a canonical path has multiple current entries;
- `seo_catalog_dangling` — an index entry resolves to no canonical page;
- `seo_catalog_drift` — catalog content or ordering differs from its canonical page inputs.

`summary`, tags, aliases, queries, intents, exact terms, and catalog text route candidate retrieval only and must never be cited as the answer. Recompiling flat SEO fields or rebuilding `index.md` from unchanged canonical content is still a write and belongs to a later journaled maintenance operation.

### 4.7 Missing Concepts And Knowledge Gaps

Look for concepts that are repeatedly required to understand current pages, central in the link graph, named in accepted evidence, or necessary to answer an important future task, but are not adequately covered by a canonical page.

Distinguish:

- `missing_concept_page` — supported fragments exist across current pages, but no canonical page integrates them;
- `missing_connection` — existing knowledge supports a useful relationship that is not represented;
- `knowledge_contract_gap` — a current page lacks a usable conclusion, applicability / `when_not`, mechanism or rationale, operational implication, evidence, or invalidation signal required to apply it safely;
- `knowledge_gap` — the wiki exposes an important unanswered question or lacks evidence needed to resolve a conflict/invalidation;
- `source_gap` — a claim needs stronger or newer primary evidence before it can be trusted or updated.

Each gap finding must include:

- the concrete future question that cannot currently be answered safely;
- pages/sources showing why the question matters;
- what information is missing;
- whether existing accepted content is sufficient for consolidation or new sourcing/acceptance is required;
- optional search terms or source types to investigate.

Do not create a thin definition page merely because a noun appears often. Aliases and `answerable_queries` belong to the derived SEO projection and are retrieval clues, not proof that a concept merits admission to the knowledge body. Do not answer the question inside the lint report as if the answer were verified. A missing concept recommendation is a research/navigation hypothesis, not a new atom.

### 4.8 Scope And Version Misuse

Report boundaries that would cause a future agent to apply correct knowledge in the wrong context:

- a `global` page whose conclusion is supported only for one project, repository path, tenant, deployment, or local convention;
- a project page whose `project_key`, containing directory, or `meta.md` external/root-history identity disagree, or whose key/path fails safe containment;
- unconditional prose or SEO that exceeds the page's applicability, runtime, dependency, API, platform, or version range;
- mixed version regimes presented as one simultaneous rule;
- a source version, accepted source state, or invalidation condition that conflicts with the declared applicability;
- project-specific examples presented as universal proof, or a general rule narrowed accidentally to one project without evidence.

Use `scope_misuse`, `project_identity_mismatch`, `version_boundary_missing`, `version_regime_collision`, or `applicability_overreach`. Recommend the smallest boundary clarification supported by existing sources. Moving project knowledge to global scope is a generalization and requires evidence; lint cannot authorize it.

## 5. Severity And Confidence

Assign severity by future harm, not stylistic preference:

| Severity | Meaning |
|---|---|
| `critical` | Current retrieval can direct an agent to mutually exclusive or demonstrably invalid behavior with material safety/data consequences. |
| `high` | Likely to cause a wrong engineering decision, project-boundary leak, or systematic retrieval of stale/incorrect guidance. |
| `medium` | Degrades discoverability, maintenance, or precision but a careful reader can recover safely. |
| `low` | Hygiene issue or investigation opportunity with no demonstrated near-term misuse. |

Use `confidence: high | medium | low` independently of severity. Only high-confidence deterministic defects may be proposed as safe maintenance candidates. Semantic findings remain review candidates unless the cited accepted sources fully prove both the defect and the bounded repair.

## 6. Read-Only Workflow

1. **Prove mode** — absent an explicit, separate maintenance request, select `lint_only`. Reject any combined `lint_and_fix` request as two operations: finish the read-only report first, then ask for/consume separate authority.
2. **Freeze snapshot** — resolve `scanned_commit`, record dirty-path observations, and read all lint inputs from that commit.
3. **Run deterministic checks** — schema shape, `page_id` uniqueness, project identity, link resolution, redirect cycles, `content_fingerprint`, status enum, flat retrieval-field integrity, and one-entry-per-page catalog coverage.
4. **Run semantic checks** — contradictions, invalidation/staleness, duplicate meaning, missing cross-references/concepts, knowledge gaps, and scope/version misuse. Read full pages and try to falsify every candidate.
5. **Check provenance** — identify whether accepted sources already prove a repair. Downgrade to a question when resolution would require inference or new evidence.
6. **Deduplicate findings** — one root defect should not create dozens of derivative findings. Keep affected paths on the primary finding and cross-reference dependent symptoms.
7. **Return the report** — make zero writes even when every proposed repair appears mechanical.

## 7. Report Contract

Return a structured report in the resolved VibeRig output language while preserving paths, IDs, hashes, schema fields, versions, code symbols, and URLs:

```yaml
mode: lint_only
scanned_commit: <full oid>
worktree_observations: [<dirty paths, if any>]
summary:
  pages: <count>
  catalog_entries: <count>
  findings_by_severity: {critical: 0, high: 0, medium: 0, low: 0}
findings:
  - finding_id: lint:<scanned-commit>:<stable-class-and-target-digest>
    class: <finding class>
    severity: critical | high | medium | low
    confidence: high | medium | low
    paths: [<repo-relative path>, ...]
    question_or_claim: <precise paraphrase; no invented fact>
    evidence: [<page/source/field/edge observation>, ...]
    applicability_overlap: <scope/version/condition comparison, when relevant>
    risk: <specific future retrieval or application failure>
    recommended_next_step: no_fix_recommended | maintenance | consolidation | new_source_and_acceptance | human_review
    proposed_change_boundary: <what may change without broadening claims, or null>
unanswered_questions:
  - question: <future question the wiki cannot answer safely>
    why_it_matters: <supported impact>
    needed_evidence: [<source type or missing fact>, ...]
```

`finding_id` is a report-local stable locator, not a journal key or write authority. Sort findings by severity, class, and raw UTF-8 path bytes. If no actionable defect is found, return `findings: []`; never manufacture an improvement to make lint appear useful.

## 8. Repair Handoff

The report may recommend a next operation but cannot start it implicitly.

| Finding | Earliest lawful repair path |
|---|---|
| Broken link with one source-proven target, redirect cycle, SEO hash/target drift | Separate journaled maintenance/consolidation operation |
| Exact duplicate with all claims and sources preserved | Separate explicit `vb-wiki consolidate` operation |
| Confirmed stale/superseded page proved by already accepted sources | Separate journaled maintenance/consolidation operation, preserving provenance and supersession trail |
| Possible contradiction, version ambiguity, or uncertain canonical winner | Human review or new source/acceptance; no content repair yet |
| Missing concept whose full content is already entailed across accepted pages | Separate consolidation operation may synthesize without adding claims |
| Knowledge/source gap or proposed generalization | Normal sourcing plus explicit acceptance before distillation |

For any later repair:

- require an explicit maintenance/consolidation request and a fresh operation ID defined by the journal;
- require current `HEAD == scanned_commit`, or re-run all affected lint checks against the new head;
- plan exact paths and preserve every accepted source, applicability boundary, invalidation signal, and user-owned dirty byte;
- make no claim stronger, broader, newer, or more certain than the accepted evidence;
- commit exactly once with the fixed operation trailer and refresh retrieval only from a clean committed worktree.

## 9. Red Flags

- “Lint found it, so it is true.” → A finding identifies a consistency or evidence question; it is not domain authority.
- “The newer page wins.” → Recency alone does not resolve applicability or correctness.
- “These pages are similar, so merge them.” → Similarity only retrieves candidates; full claims, boundaries, and sources decide identity.
- “The page is old, so mark it stale.” → Require a proved invalidation signal or explicit superseding evidence.
- “A missing concept deserves a placeholder.” → Empty/LLM-invented pages pollute retrieval; report the question and evidence gap.
- “SEO is derived, so silently rebuild it.” → Derived files are still committed state; repair them in an independent journaled operation.
- “Fixing links is harmless.” → Every write can absorb user work or change meaning; use baselines, staged-tree proof, and a separate commit.
- “A web search closes the gap.” → Research yields candidate sources, not accepted wiki truth.

## 10. Validation Checklist

- [ ] One immutable `scanned_commit` was used; dirty worktree content was reported but not treated as canonical.
- [ ] Lint made zero writes and did not stage, commit, refresh, journal, update Linear, or invoke `vb-learn`.
- [ ] Contradictions and duplicates were evaluated only after comparing full claims and overlapping applicability.
- [ ] Staleness named a proved invalidation signal; age or a newer timestamp alone was not used.
- [ ] Orphans, links, redirects, canonical identities, and project identities were checked deterministically.
- [ ] Every canonical page has a unique `page_id`; its body-only `content_fingerprint` and schema-v2 status were verified exactly.
- [ ] `index.md` contains exactly one matching current-state entry per canonical `page_id` and no dangling entries.
- [ ] Missing concepts/gaps were reported as questions with needed evidence, not written as facts.
- [ ] Scope and version findings described the exact misuse boundary.
- [ ] Every proposed repair states whether existing accepted sources suffice or new acceptance is required.
- [ ] No lint finding was used to bypass source authority, acceptance, or the operation journal.
