# VB Wiki Retrieval Protocol

Use this protocol for SEO compilation, entity resolution, `index.md` rebuilds,
qmd refresh, and retrieval without turning search metadata into knowledge.

## 1. Authority Boundary

Keep four representations separate:

1. immutable accepted sources are evidence;
2. canonical page bodies are maintained knowledge;
3. schema-v2 retrieval frontmatter and `index.md` route to likely pages;
4. qmd is a disposable candidate cache.

Only an applicable canonical body backed by its sources may support a claim.
SEO, index lines, qmd results, touch counts, and log frequency may rank
candidates but never answer, create claims, raise confidence, or settle conflict.

Exclude `AGENTS.md`, `index.md`, project `meta.md`, `log.md`, and
`.git/viberig/**` from answers. Logs/journals are never knowledge evidence.

Mandatory read path:

`query -> index / lexical / qmd candidates -> canonical body -> boundary and evidence checks -> answer`

## 2. Schema-v2 SEO Projection

Frontmatter stays flat; never add a nested `seo` object. The Knowledge Editor
owns the body and `schema_version`, `page_id`, `title`, `type`, `scope`, optional
`project_key`, `status`, `tech`, `sources`, `applies_to`,
`provenance`, `does_not_apply_when`, `invalidation_signals`, and relations. After the body
passes its critic, the SEO Compiler generates only:

| Field | Contract |
|---|---|
| `summary` | One-line answer entailed by the body; routing aid, not answer evidence. |
| `tags` | Small body-entailed retrieval topics; never a value or truth judgment. |
| `aliases` | Equivalent names/exact stable terms; no broader, narrower, or merely related concepts. |
| `answerable_queries` | `current`: `1..5` body-answered questions; `needs_revalidation`: `0..5` questions only about the unresolved boundary; superseded redirects may be empty. |
| `task_intents` | Subset of `diagnose`, `decide`, `implement`, `verify`, `explain`, `operate`. |
| `exact_terms` | Verbatim errors, APIs, symbols, config keys, commands, paths, or old names in the body. |
| `content_fingerprint` | `sha256:<64 lowercase hex>` over the normalized body after frontmatter. |

Normalize natural language to NFC/single-line whitespace; normalize, deduplicate,
then raw-UTF-8-sort lists. Preserve exact technical terms except line endings.
Empty aliases, exact terms, or intents are valid.

Fingerprint procedure:

1. parse frontmatter and take the body after the closing delimiter's line break;
2. normalize CRLF/CR to LF and Unicode to NFC;
3. preserve all remaining leading/trailing whitespace;
4. SHA-256 the UTF-8 bytes and prefix the full lowercase digest with `sha256:`.

The fingerprint excludes frontmatter. Body changes require recompilation;
matching fingerprints never excuse stale scope, status, or applicability.

## 3. SEO Compiler

Input is the critic-approved body plus semantic frontmatter. The compiler never
decides value, edits the body, or consults unrelated sources to increase recall.

1. Identify the durable question, conclusion, future uses, explicit symptoms,
   exact terms, and alternate names in the body.
2. Make `summary` the shortest entailed answer that retains material boundaries;
   add no absent cause, promise, recommendation, exception, version, or scope.
   For `needs_revalidation`, summarize the unresolved boundary/conflict and do
   not phrase either competing claim as current truth. A deterministic legacy migration
   may use a summary that states only the page's editorial revalidation status; it may
   not smuggle a domain claim absent from the preserved body.
3. Keep only body-entailed retrieval topics as tags and truly equivalent aliases.
4. For every `answerable_queries` item, verify the body contains its conclusion,
   applicability, and evidence; mentioning a topic is insufficient. A
   `needs_revalidation` item may ask only what is unresolved and must not imply either
   competing claim is true; an empty list is valid.
5. Select only task intents the page materially supports and copy exact terms
   verbatim from the body.
6. Compute the fingerprint, then remove every generated value not entailed by
   or copied from the body.

Missing content needed for a required, body-entailed retrieval field returns
`seo_gap`; optional aliases/tags/exact terms/intents may simply be empty. The compiler
neither adds missing content to the body nor hides it in metadata. The write protocol
must resolve or fail this result before any wiki edit. SEO runs after retention, so its
queries, aliases, summary, intents, and keyword expansion never influence the
knowledge-value gate or change a body claim.

## 4. Current-State `index.md`

`index.md` is the small, mutable, deterministically rebuildable catalog now. Git
keeps old catalogs; `log.md` keeps the append-only human timeline. Long SEO lists
stay in page frontmatter/qmd instead of bloating this navigation file. Every
canonical page appears exactly once in the schema-defined Markdown form:

```text
- [[<relative-path-without-.md>]] — <summary>
```

The path is the identity-free pointer and must match the restricted canonical path
grammar. Parse the first literal `]] — ` as the sole delimiter and treat the entire
remainder as the NFC, single-line-whitespace-normalized `summary`; summary content
therefore needs no delimiter escaping. Emit UTF-8 with LF line endings and exactly
one terminal LF. All other SEO fields stay in canonical page frontmatter.

Canonical content paths are exactly `<tech>/<kebab-slug>.md` or
`projects/<safe-project-key>/<tech>/<kebab-slug>.md`; every component is a validated
ASCII safe component, never `.`/`..`, a separator, control character, symlink escape,
or absolute path. This guarantees `]]` cannot occur inside the wikilink target.

Rebuild:

1. Use the exact committed tree plus this operation's exact planned page bytes,
   never unrelated dirty/staged/untracked/ignored bytes.
2. Enumerate `*.md`; exclude schema, index, log, every `meta.md`, `.git/**`, and
   generated/cache files.
3. Parse each schema-v2 page, recompute its fingerprint, and validate every SEO
   field against the body; compile only its path and exact normalized summary.
4. Fail the whole rebuild on duplicate path/page ID, malformed scope/project,
   invalid status, or fingerprint mismatch; never publish a partial catalog.
5. Emit one line per page sorted by raw UTF-8 bytes of its relative `.md` path.

The same source tree must produce byte-identical index bytes. Update replaces
one line; rename removes the old path and adds the new; supersede updates the
old redirect and survivor. Never append a historical duplicate. An index hit
is only a pointer: open the page and check `applies_to`,
`does_not_apply_when`, `status`, and `invalidation_signals` before use.

## 5. Write-Time Entity Resolution

Before resolution, build ephemeral queries from the admitted candidate's conclusion,
cognitive delta, action/interpretation impact, applicability, technology/scope/project,
and exact error/symbol tokens in its evidence. Do not persist these queries, turn them
into SEO fields, or feed them back into admission. Recall the union of:

- exact frontmatter/canonical-page matches for page ID, title, alias, exact term,
  and technology, plus exact catalog path/summary matches;
- lexical/BM25 matches in index and canonical pages;
- qmd semantic candidates;
- typed relations and `superseded_by` targets from plausible seeds.

Follow superseded pages before comparison. Rank, keywords, shared files, or
shared provenance never prove identity. Read plausible bodies and compare the
future question, subject/conclusion/mechanism, consequence, scope/component,
positive/negative applicability, version/invalidation, and changed future use.

| Condition | Write decision |
|---|---|
| Same entity, no semantic increment | `no_change`; add no prose or SEO noise. |
| Same entity, added evidence/mechanism/boundary/use/invalidation | `update` the page coherently. |
| Independent durable question | `create` one page; add only real relations. |
| Different result explained by project/version/component/applicability | `update` with `update_mode: revise`, or `create` only for a truly independent object; preserve explicit boundaries. |
| New accepted evidence proves old conclusion obsolete | `update` with `update_mode: revise` or `supersede`; preserve provenance and redirect when superseding. |
| Conflicting accepted claims and one canonical target is safely identifiable | Update that page with both claims/sources and missing discriminator; set `status: needs_revalidation`. |
| Conflicting claims but the entity/canonical target is ambiguous | `blocked: entity_resolution_ambiguous`; write nothing and request consolidation/correction. |
| Multiple non-superseded pages represent one entity | Same blocked result; never choose by rank or create another duplicate. |

A project exception never overwrites a global rule. Single-project evidence
stays project-scoped unless it proves global applicability; a global page is
updated only by evidence supporting its global scope.

## 6. Read-Time Routing And Rerank

The Query Router is read-only:

1. Capture question/task, current project, technology, component/version,
   symptoms, exact terms, and task intent; unknown context stays unknown.
2. Union exact catalog, lexical/BM25, and qmd candidates; search errors/symbols
   both verbatim and in natural language.
3. Admit global and exact-project pages; exclude other projects unless requested.
4. Prefer `current`; isolate `needs_revalidation`; follow `superseded_by` and
   never answer from a superseded body. Reject path/ID/fingerprint mismatch.
5. Hard-exclude a matching `does_not_apply_when` or known incompatible boundary.
   A satisfied `applies_to` promotes; unknown applicability demotes and requires
   a caveat. A fired invalidation signal is treated as
   `knowledge_needs_revalidation` for this answer, with zero writes; recommend a
   later lint/consolidation or accepted update rather than changing status here.
6. Rerank in order: exact page/error/symbol; exact project/applicability;
   answerable query/task intent; title/alias; lexical/symptom; qmd similarity;
   linked support. `updated` only breaks otherwise equal candidates; final ties
   use canonical path raw UTF-8 order.
7. Open plausible canonical bodies and verify direct answer, applicability,
   evidence, delivery relevance, invalidation, and conflict state.
8. Answer only body-supported claims within their boundaries. Every material claim
   derived from the wiki cites its canonical page and underlying source IDs; never cite
   SEO/index/qmd/log/journal as proof. Pure routing/miss statements need no fabricated
   source citation.

Scores mean relevance, not confidence. A lower-ranked applicable page beats a
higher-ranked incompatible one; every multi-page claim stays attributable.

## 7. Gap, Staleness, And Conflict

- No applicable/evidenced body returns `knowledge_gap` plus what is missing.
  Never fill it from summaries, neighboring pages, logs, IDs, or model memory.
- Missing page, wrong ID/frontmatter, or fingerprint mismatch makes a hit stale.
  Ignore it, rebuild from committed/planned pages, and use committed lexical
  search until qmd can be safely refreshed.
- `needs_revalidation`, a fired invalidation signal, or applicable disagreement
  returns `knowledge_needs_revalidation` / `knowledge_conflict`, with competing
  conclusions, boundaries, source IDs, and the missing discriminator. Never
  choose the highest score or synthesize a stronger compromise.

When a unique canonical target is proven, record unresolved conflict there
with parallel sources and `status: needs_revalidation`. Block only when entity
identity/target is ambiguous. Resolution requires accepted evidence, coherent
Knowledge Editor revision, SEO recompilation, and index rebuild.

## 8. qmd Derived Cache

- Index committed canonical `current` and `needs_revalidation` pages only;
  exclude schema/index/log/meta/journal/cache files and superseded MOCs. If qmd
  cannot filter safely, build a disposable eligible-page corpus.
- Bind each cache generation to wiki commit OID, retrieval schema version, and
  sorted canonical-path-to-fingerprint mapping; this manifest is not evidence.
- Refresh only after a proven page/index commit and wholly clean worktree;
  never embed staged, dirty, ignored, untracked, or unrelated user bytes.
- Map hits back to current index/page and discard excluded, wrong-project,
  superseded, missing, or fingerprint-mismatched hits before reranking.
- Missing/stale/failed qmd degrades to index plus lexical search. It never blocks
  a commit or permits skipping body verification. Verify snippet text in the
  current body before quoting or using it.

## 9. Accuracy Invariants

1. **Body authority:** only an applicable canonical body and accepted sources support claims.
2. **SEO containment:** retrieval fields are body-entailed and never decide retention.
3. **Open before answer:** title/index/rank/embedding/snippet alone never answers.
4. **One current entry:** exactly one deterministic index line per canonical page.
5. **Identity binding:** a catalog path resolves to one page whose opaque page ID is
   globally unique and whose frontmatter/fingerprint validate; identity is not inferred
   from path text.
6. **Scope isolation:** other projects are excluded by default; project exceptions stay local.
7. **Applicability first:** an incompatible page loses regardless of score.
8. **Revalidation honesty:** invalidated/conflicting/superseded knowledge cannot rank into truth.
9. **Honest absence:** zero useful pages returns a gap, never plausible filler.
10. **Episodic exclusion:** logs, journals, schema, identity, and catalog are not answer corpus.
11. **Committed bytes only:** uncommitted/unowned bytes never enter index or cache.
12. **Cache disposability:** rebuilding index/deleting qmd changes retrieval, not knowledge.

Any violation fails closed: discard the hit, fall back to committed body search,
report a gap/conflict, or block the write. Never relax authority, scope, or
applicability merely to return a result.
