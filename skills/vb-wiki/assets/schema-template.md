<!-- VibeRig-Wiki-Schema: 2 -->
# ~/.vb-wiki — LLM Wiki Schema

This git repository is a persistent, LLM-maintained synthesis compiled from
immutable accepted sources. It is not a collection of Issue summaries and not
a raw-document RAG corpus. Humans may edit it; their changes remain user-owned
and are never absorbed into an unrelated agent operation.

The llm-wiki separation is strict:

1. **Raw sources** — Linear acceptance, commits, Proof Packets, contracts, and
   external records remain immutable outside the wiki and are the source of
   truth.
2. **Canonical wiki pages** — the current synthesis: concepts, decisions,
   conventions, patterns, facts, and gotchas maintained across many sources.
3. **Schema and operations** — this file plus the installed `vb-wiki`
   protocols govern ingest, query, lint, and maintenance.

Retrieval metadata is a projection of canonical pages. It helps an agent find
a page but never proves a claim. Knowledge is compiled once and improved over
time, like a human notebook or mistake log, rather than re-derived from task
history on every query.

## Root Layout

```text
~/.vb-wiki/
├── AGENTS.md              current schema, taxonomy, and page conventions
├── index.md               current-state catalog, one entry per canonical page
├── log.md                 append-only human-readable operation timeline
├── <tech-dir>/...         global canonical pages
└── projects/
    └── <project-key>/
        ├── meta.md        exact external/root-history identity; excluded from answers
        └── <tech-dir>/... project canonical pages
```

Machine transaction state lives only under `.git/viberig/**`; operation records are
under `.git/viberig/operations/`. It is
not wiki content, history, or retrieval input.

## Scope And Project Identity

- **Global** knowledge is proven across codebases or describes an upstream
  language/tool/framework contract.
- **Project** knowledge is a repository convention, architecture decision,
  local contract, or project-specific gotcha.
- Uncertain scope is project, never global by aspiration.
- Match an existing project directory only through one unique validated identity:
  non-empty GitHub repository slug or Linear project ID, falling back to the stored
  root-commit fingerprint only when both external identities are unavailable. Project
  keys and resolved paths must pass the safe-component/containment checks.

## Technology Taxonomy

Paths are organized by technology, never page type. Reuse an existing
directory whenever possible; different runtimes use different directories;
cross-language knowledge goes to `architecture/` or another platform
directory. Register a genuinely new technology here in the same commit.

| tech-dir | covers |
|---|---|
| `architecture/` | cross-language system design, boundaries, contracts |
| `go/` | Go, go-zero, goctl, Go tooling |
| `typescript/` | TypeScript/JavaScript, Node, tsdown, Vite |
| `monorepo/` | pnpm, Turborepo, go.work, workspace migration |
| `uni-weapp/` | uni-app, WeChat mini-programs, cloud functions |
| `casdoor/` | Casdoor SSO, management API, JWT boundaries |
| `lago/` | Lago billing, wallets, events |
| `cloudbase/` | Tencent CloudBase models, NoSQL, functions |
| `postgres/` | Postgres, Drizzle/Payload migrations |
| `node-tooling/` | npx, MCP servers, CLI process/environment behavior |

## Canonical Page Frontmatter

Every content page other than `AGENTS.md`, `index.md`, `log.md`, and `meta.md`
uses schema v2:

```yaml
---
schema_version: 2
page_id: "page:<lowercase-uuid-v4>" # legacy migration: page:legacy:<64-lowercase-hex>
title: <human title in the page language>
summary: <one-line answer entailed by the body>
created: <ISO 8601 date>
updated: <ISO 8601 date>
type: gotcha | pattern | decision | convention | fact
scope: global | project
status: current | needs_revalidation | superseded
tech: <registered tech-dir without slash>
tags: [<body-entailed retrieval topic>, ...]
aliases: [<alternate name or exact stable term>, ...]
answerable_queries: [] # 1-5 for current; may be empty while revalidation is required
task_intents: [] # subset of diagnose, decide, implement, verify, explain, operate
exact_terms: [<code symbol, error string, command, old name>, ...]
applies_to: [<positive scope/version/condition>, ...]
does_not_apply_when: [<adjacent non-applicable condition>, ...]
invalidation_signals: [<observable re-check trigger>, ...]
sources: [<exact structured source ID>, ...]
provenance:
  - event_id: <acceptance/aggregate/delivery/operation ID>
    accepted_source: <commit, non-code record, child events, or skill tree>
    delivery_state: accepted_unmerged | accepted_in_milestone | merged | authoritative_branch | no_merge_required | not_applicable
content_fingerprint: sha256:<64 lowercase hex chars>
# project_key: <required only for project scope>
# caused_by: [<page_id>, ...]
# fixed_by: [<page_id>, ...]
# supersedes: [<page_id>, ...]
# superseded_by: [<page_id>, ...]
---
```

`content_fingerprint` is the full lowercase SHA-256 of the Unicode-NFC,
LF-normalized Markdown body after frontmatter. Retrieval fields are generated
only after the knowledge editor retains and renders the body. `summary`, `tags`,
`aliases`, `answerable_queries`, `task_intents`, and `exact_terms` may improve
recall but may not add a fact, promise, applicability scope, or causal claim
absent from the body.
For `status: needs_revalidation`, `summary` names the unresolved boundary or
conflict and never presents either competing claim as settled truth.

Assign `page:<lowercase-uuid-v4>` as the path-independent `page_id` only on normal create and
persist it before page edits. Keep it immutable across title, slug, directory,
taxonomy, and project-path moves. Explicit legacy migration may instead assign
`page:legacy:<sha256>` by its deterministic migration algorithm. A genuine
split/new knowledge object receives a new ID; a rename does not.

## Knowledge Body Contract

One canonical page answers one durable conceptual question. Multiple accepted
events may strengthen or revise the same page; one event may update multiple
pages. The body is a coherent current synthesis, not append-only event prose.

Every current page makes these recoverable when the dimension is material to
correct use; never invent a boundary or invalidation trigger merely to fill a field:

1. **Conclusion** — what a future reader should now believe or do.
2. **Mechanism or rationale** — why the conclusion holds; distinguish observed
   fact from causal explanation.
3. **Applicability** — known prerequisites, scope, version, and conditions; an
   empty list is allowed for a genuinely unconditional or not-yet-known boundary.
4. **Adjacent boundary** — where a similar-looking case does not apply, when one
   is evidenced and material.
5. **Use** — how the knowledge changes a decision, diagnosis, check, or action.
6. **Evidence** — exact sources beside or immediately after the material claims
   they support.
7. **Invalidation** — observable changes that require re-checking, or explicit
   `not_applicable` when the accepted claim has no meaningful trigger.

Issue timelines, changed-file inventories, routine tests, merge narration,
acceptance IDs, and delivery states belong in compact provenance, not the
explanatory story. `accepted_unmerged` and `accepted_in_milestone` remain valid
source states; they do not lower knowledge quality, but the page must not imply
delivery to main when that matters operationally.

## Type-Specific Contracts

- `fact`: a stable, non-obvious fact, its decision consequence, verification
  method, and invalidation condition.
- `decision`: context/forces, chosen option, material alternatives, rationale
  and trade-offs, plus conditions that reopen the decision.
- `convention`: normative rule, intended scope/actors, purpose, enforcement or
  self-check, and explicit exceptions.
- `pattern`: recurring problem/forces, mechanism, application guidance,
  trade-offs, and when not to apply it.
- `gotcha`: observed symptom, tempting wrong model, proven root cause, shortest
  diagnostic, prevention/checklist, and adjacent lookalike. Temporal sequence
  alone never proves root cause.

A page missing its type-specific semantics is not rescued by changing `type`.

## Language

Titles, bodies, summaries, and log reasons use the output language resolved at
write time. Existing pages keep their language. Never translate slugs,
frontmatter keys/enums, code, commands, error text, IDs, hashes, paths, URLs,
or existing external labels. Retrieval aliases may preserve exact alternate
names used in sources; they may not invent translated terminology.

## Links

Use `[[relative/path-without-.md|title]]` when a slug could be ambiguous and a
short `[[slug]]` only when unique. Typed frontmatter relations use `page_id`.
Pages from the same event link only when a real relationship exists; shared
provenance alone is not a relationship. Never invent a link or relation to a
page that does not exist. Zero links is correct.

## index.md — Current Retrieval Catalog

`index.md` represents the canonical corpus **now**. It is mutable/rebuildable,
not append-only. Each canonical page appears exactly once, sorted by raw UTF-8
bytes of repository-relative path. Compile it from committed page frontmatter
plus the current operation's exact planned page bytes, never unrelated dirty or
untracked worktree files.

Entry format:

```text
- [[<relative-path-without-.md>]] — <summary>
```

Parse the first literal `]] — ` delimiter; the remainder is the complete NFC,
single-line-whitespace-normalized summary, so summary punctuation needs no escaping.
Long aliases, questions, exact terms, IDs, scope, status, and fingerprints stay in
canonical page frontmatter/qmd rather than bloating the navigation catalog.

An index hit is only a pointer. An agent must open the canonical page and check
applicability, non-applicability, status, and invalidation before answering or
merging knowledge. Historical catalog versions are preserved by git.

## log.md — Append-Only Evolution

`log.md` is the sole append-only human timeline. Append exactly one entry per
page-changing operation; never edit or delete prior entries:

```text
- <ISO 8601 timestamp> — <mode> — pages: <sorted [[relative/path]], ... or none> — <reason> — <exact operation/event ID>
```

The exact operation/event ID is mandatory. The log answers when/why the wiki
changed; it is excluded from default knowledge retrieval and is never evidence
for a body claim or git-commit identity by itself.

## Query And Retrieval Invariants

- Resolve intent, project/scope, technology, version, and exact code/error
  tokens before search.
- Use exact/BM25, semantic search, and real link traversal for candidate recall.
- Prefer exact error/symbol and applicability matches over generic semantic
  similarity; `updated` is only a tie-breaker.
- Search scores, touch counts, source counts, and log frequency never prove
  truth or importance.
- Read canonical pages before use. Penalize or exclude `superseded`, scope or
  version mismatch, triggered invalidation, unresolved conflicts, and stale
  fingerprints.
- A miss is a knowledge gap. Inspect immutable sources when authorized; never
  assemble an answer from catalog/log fragments.

## Git Discipline

Every page-changing distillation, aggregation, reconciliation, consolidation,
or schema migration is exactly one commit. Zero retention/no semantic change
creates none. Persist base commit, exact paths/baselines, and staged tree in the
operation journal before the corresponding boundary. Commit only event paths
with `VibeRig-Operation: <operation-id>`.

Recovery requires a unique trailer match, exact parent/tree, current-branch
reachability, and the operation ID in committed `log.md`; page/index/log text
alone never proves ownership. Required paths with unrelated edits block the
operation. Unrelated user changes are preserved: never absorb, overwrite,
discard, stage, refresh, or recommit them.
