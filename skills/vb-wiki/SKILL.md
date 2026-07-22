---
name: vb-wiki
description: >-
  Maintain the git-backed ~/.vb-wiki as compiled long-term memory: ingest
  explicitly accepted evidence, query canonical knowledge, lint its health,
  and maintain its retrieval catalog. Use for “学习 VB-42”, “记录经验”,
  “沉淀到 wiki”, “查知识库”, “vb-wiki lint”, replies to a pending vb-wiki
  tool-promotion proposal, skill-to-note conversion, or consolidation.
---

# VB Wiki

`vb-wiki` is VibeRig's default self-learning sink and long-term-memory editor. It compiles immutable accepted evidence into a persistent, current synthesis rather than another Issue summary. Canonical pages hold knowledge; a separate retrieval projection makes that knowledge findable; schema and maintenance protocols keep both accurate. Only after a knowledge commit may one pattern be considered for promotion into a separately authorized tool skill.

## Contract

- Single responsibility: maintain `~/.vb-wiki` as a sourced, deduplicated, git-backed knowledge base split into global and project scopes.
- Follow the llm-wiki separation: accepted records/git artifacts are immutable sources; canonical Markdown pages are the maintained synthesis; this skill and the live schema define ingest/query/lint behavior.
- Keep **knowledge admission** separate from **retrieval SEO**. Admission asks whether accepted evidence supports durable knowledge that changes future understanding or decisions. SEO runs only after retention and describes when to open a page; it never creates or validates a claim.
- `index.md` is a current-state catalog with exactly one entry per canonical page and is updated/rebuilt in the same transaction as page changes. `log.md` alone is the append-only human timeline. `.git/viberig/**` alone owns machine transaction recovery/atomic ownership; it is never knowledge.
- Knowledge is passive guidance retrieved by future work. A skill is an actively invoked capability package; reusability alone does not make knowledge a skill.
- Explicit human acceptance is the Linear-path write gate. Do not wait for merge or `accept-milestone`; `delivery_state` is provenance, not permission.
- A requirement `aggregation_event` may replay only completed child acceptance events; it is not a human acceptance event and introduces no new claim.
- Code-backed knowledge is anchored to `acceptance_event` and the exact `accepted_commit`. If delivered content later differs materially, require new acceptance instead of silently mutating the accepted conclusion.
- Zero retained knowledge is a successful no-op. Never invent a note, retrieval hook, or skill candidate to avoid an empty result.
- This skill may propose at most one tool promotion per fresh acceptance event after the wiki commit. Aggregate replay, reconciliation, skill-to-note conversion, and consolidation skip promotion; this skill never writes `~/.vb-skills` itself.

## When

| Caller | Condition |
|---|---|
| `accept-issue` | Immediately after the human acceptance comment and `insights` retrospective, including milestone-bound or unmerged work |
| `accept-milestone` | Immediately after Milestone acceptance and `insights`, before any separately authorized merge |
| `accept-milestone` / `merge-issue` reconciliation | After delivery, with `reconcile_only: true`; compare content and supplement delivery provenance without re-distilling |
| User (accepted Linear scope) | “学习 VB-42”; resolve VB-42 through the Linear acceptance path, never manual-note authority |
| User (standalone manual note) | “记录这个 pattern”, “沉淀一下”, “记到知识库”, “更新 vb-wiki”, with a sourced statement supplied in the conversation |
| User (pending promotion reply) | Explicit yes/no to the one persisted `vb-wiki` candidate; bind the reply and resume its promotion phase before any `vb-learn` handoff |
| User (skill → note) | “vb-wiki skill <name>”, “把 <skill> 记到 wiki” |
| User (query) | “查一下知识库”, “根据 wiki 回答”; search the retrieval projection, then read canonical pages before answering |
| User (lint) | “vb-wiki lint”; inspect contradictions, staleness, duplicates, broken links, orphan pages, retrieval drift, and knowledge gaps without writing |
| User (consolidate) | “vb-wiki consolidate”; explicit write-capable maintenance/migration trigger only |

Do not invoke:

- for unaccepted in-flight work or abandoned/cancelled delivery;
- to create a skill directly—explicit “做成 skill / 创建工具” requests belong to `vb-learn`;
- to copy a SKILL.md verbatim into the wiki; skill-to-note always re-summarizes accepted knowledge.
- to answer from `index.md`, qmd snippets, `log.md`, or the operation journal without reading the canonical page and checking applicability;
- to treat an Issue timeline, changed-file list, test transcript, merge state, or search-keyword bundle as knowledge content.

An accepted-but-unmerged PR is valid input and must be written now.

## Input Contract

Required for Linear-path distillation:

- accepted scope ID and `insights` retrospective record from the mapped Issue-comment or Project-Update host;
- `acceptance_event.id` and its human acceptance record;
- persisted phase state from [the acceptance learning state](../insights/references/acceptance-learning-state.md), with `insights: completed`;
- Proof Packet / validation / acceptance evidence;
- `accepted_commit`, or an accepted non-code final record;
- `delivery_state`: `accepted_unmerged`, `accepted_in_milestone`, `merged`, `authoritative_branch`, or `no_merge_required`.

An optional merge result is delivery provenance only. Missing merge evidence never defers an accepted write.

Required for skill-path writes: an existing skill package and a user request to convert it to knowledge.

Required for manual note writes: an explicit current-conversation request plus evidence for a standalone statement. Compute the canonical manual fingerprint from [the acceptance learning state](../insights/references/acceptance-learning-state.md), derive `acceptance_event.id = acceptance:manual:<fingerprint>:r<revision>`, and persist `insights: not_applicable` plus all later phases in [the local operation journal](references/operation-journal.md). Unsupported assertions still produce zero atoms. A request naming a Linear scope (for example “学习 VB-42”) must use the Linear acceptance path and cannot use manual mode to bypass missing acceptance.

Required for requirement aggregation: `aggregate_only: true`, canonical `aggregation_event.id`, and completed child acceptance events listed at `aggregation_event.derived_from`. Recompute the child digest before any write. Aggregation has no human acceptance gate and may not introduce new claims.

Required for reconciliation: `reconcile_only: true`, the original acceptance event, `accepted_commit`, delivered commit/tree, and `delivery_event.id = delivery:<scope-id>:<accepted-source-fingerprint>:<delivered-commit>`.

Required for query mode: a user question or task plus any available project/technology/version scope. It is read-only and requires no acceptance event.

Required for lint mode: an explicit `vb-wiki lint` request. It is read-only; proposed content fixes require a later explicit `vb-wiki consolidate` operation.

Optional orchestration flags:

- `aggregate_only: true` — deduplicate a requirement-level aggregate already processed by its Milestones; use `aggregation_event.id` for idempotency and skip promotion.
- `reconcile_only: true` — compare the accepted scope/behavior (not unrelated main changes or merge metadata) with delivered content and optionally append merge provenance; use `delivery_event.id` for idempotency and perform no atomization or promotion.
- `defer_promotion_question: true` — evaluate after the knowledge commit but return any proposal to the caller without pausing its already-authorized delivery steps; the caller asks only in its final report.

Normal distillation, `aggregate_only`, `reconcile_only`, promotion-reply, skill-to-note, query, lint, and consolidate are mutually exclusive operation modes. Reject ambiguous combinations before any write; `defer_promotion_question` is allowed only with normal acceptance/manual distillation. Query and lint are read-only and never create a journal operation, knowledge commit, Linear phase, or promotion candidate.

For normal Linear distillation, missing explicit acceptance returns `deferred: acceptance_missing` with zero writes. Aggregation instead requires complete child acceptance events; it never fabricates a human acceptance gate.

## Context Loading

- Read [the wiki schema](assets/schema-template.md) before bootstrap or any page write.
- Read [the knowledge editor](references/knowledge-editor.md) before every normal/manual/skill-source distillation or aggregation. It owns sensemaking, knowledge value, type-specific content, and zero-note decisions.
- Read [the knowledge editor golden cases](references/knowledge-editor-golden-cases.md) only when changing/validating the editorial prompt or resolving ambiguous expected behavior; normal writes do not need the full fixture set.
- Read [the retrieval protocol](references/retrieval-protocol.md) for every write-time entity-resolution pass, SEO/catalog update, query, or retrieval refresh.
- Read [the wiki lint protocol](references/wiki-lint-protocol.md) for lint and before planning consolidation.
- Read [the knowledge write protocol](references/knowledge-write-protocol.md) for every distillation, aggregation, reconciliation, or consolidation event.
- Read [the acceptance learning state](../insights/references/acceptance-learning-state.md) for every Linear/manual event, phase resume, aggregation, or reconciliation.
- Read [the operation journal](references/operation-journal.md) before every write-capable mode; it owns git transaction recovery and non-Linear phase persistence. Query and lint remain read-only and create no journal.
- Read [project identity matching](references/project-identity.md) when any candidate may be project-scoped.
- Read [the skill-promotion gate](references/skill-promotion-gate.md) only after a fresh knowledge commit succeeds.
- Use `assets/index-template.md`, `assets/log-template.md`, and `assets/meta-template.md` only when creating their corresponding files.
- Read `assets/schema-v1-template.md` only during explicit legacy consolidation; its pinned digest and taxonomy-only comparison algorithm are migration evidence, not the current schema.

## Workflow

1. **Select mode and prove authority**.
   - Linear distillation: require explicit acceptance, `insights: completed`, `acceptance_event`, and the accepted source. Accept every declared `delivery_state`, including unmerged states.
   - Aggregation: require `aggregation_event` and completed child events at `aggregation_event.derived_from`; it may only replay/cross-link child knowledge.
   - Reconciliation: require the prior acceptance event, a wiki phase of `committed` / `zero_atoms`, `delivery_event`, `accepted_commit`, and delivered commit/tree. A missing/incomplete base returns `base_event_missing` with zero writes and never falls back to atomization. Material drift returns `reaccept_required`; equivalent content may only gain delivery provenance.
   - Manual note path: only an explicit standalone record-to-wiki request may use this path. Treat that request as authority for the supplied, sourced statement, derive the canonical manual acceptance event, persist `insights: not_applicable` in the local journal, and still apply the high-confidence evidence gate. Never use manual mode for a named Linear scope.
   - Promotion-reply path: bind yes/no only when the user supplies an exact pending candidate ID, or when the immediately preceding assistant proposal contains that ID and exactly matches one pending candidate. Zero/multiple candidates, a stale unrelated reply, or an unbound “可以/不要” returns `blocked: promotion_candidate_ambiguous`, requests the candidate ID, and changes no phase.
   - Skill path: read the skill and direct references, then treat the existing user-selected package as the accepted source.
   - Query path: apply the retrieval protocol read-only. An index/search hit is only a route to a canonical page, never evidence.
   - Lint path: apply the lint protocol read-only and return findings; do not silently repair them.
   - Consolidate path: require the explicit `vb-wiki consolidate` request, use current lint findings to plan one journaled maintenance operation, and skip source distillation.
2. **Bootstrap or identify migration idempotently for write-capable modes only**. Normal/manual/skill-source/aggregate/reconcile/consolidate may execute or recover the journal's fixed `bootstrap:v1` operation for a new store. It safely recovers an interrupted `git init` / template write only when partial files are byte-identical to templates, commits only missing required files with the fixed operation trailer, and never overwrites a legacy or user-modified file. Query and lint never initialize, journal, commit, or migrate: a missing/unborn store returns `wiki_not_initialized`; query against pre-v2 returns `wiki_schema_upgrade_required`, while lint may inspect it read-only and report the exact migration findings. A proven bootstrap followed by missing required files returns `blocked: wiki_schema_missing`. A legacy pre-v2/append-only index returns `blocked: wiki_schema_upgrade_required` for normal writes; only explicit `vb-wiki consolidate` may safely migrate it while preserving taxonomy/user bytes or report exact conflicts.
3. **Load the exact mode state for write-capable modes**. Query and lint skip this step and inspect only committed wiki state.
   - Distillation uses `acceptance_event.id`; aggregation uses `aggregation_event.id`; reconciliation uses `delivery_event.id`. Never let an existing acceptance event short-circuit a new delivery event.
   - Resolve the exact operation ID defined by the journal. Load its atomic local journal; for Linear-backed operations also load the newest exact-event finalization record. Manual, skill-to-note, and consolidation never invent a Linear scope—the journal is their state store.
   - Run the journal's fixed-trailer, parent/tree, reachability, and durable-log checks before deciding whether a prior commit landed. Adopt only a unique fully proven commit. Current dirty paths after that commit become `post_commit_worktree_conflict`, not evidence that the commit failed; never recommit them. Page/log content alone never identifies a commit or proves `promotion` was evaluated.
   - Return `already_processed` only when every phase requested by this mode is terminal. Otherwise return `resumed_from: <phase>` internally and execute only that phase.
   - Skill-to-note uses `skill-note:<skill-name>:<committed-source-tree-oid>`. Consolidation creates/resumes the journal's UUID operation. Neither fabricates an acceptance event.
4. **Resolve language**. Read `.vibeRig/project.yaml` `output.language`; missing means the user's working language with a reported fallback. Preserve an existing page's language on update. Never translate slugs, schema keys/enums, tags, code, commands, errors, IDs, hashes, paths, or URLs.
5. **Execute only the current phase**.
   - Distillation with `wiki: pending` / `failed`: resume only from a journal-proven safe boundary. Run the knowledge editor's admission pass against the retrospective plus accepted immutable evidence; use only admitted semantic units to recall/read every plausible canonical page; then run its resolution/render pass with those full page bytes. Execute the knowledge write protocol from that one ledger/page-plan model for the minimum `0..N` changes. Persist base/path baselines before edits, persist the staged tree before commit, and record only proven `committed`; zero admitted knowledge or a zero-page-plan resolution containing only `no_change`/discarded candidates records `zero_atoms` with the exact result reason.
   - Distillation with `wiki: writing` / `commit_pending`: follow the journal exactly. A matching staged tree may finish the same commit; dirty event paths without that durable identity return `blocked: wiki_draft_unverifiable`. Do not edit knowledge again, regenerate a different catalog, append a duplicate log entry, or guess which bytes belong to the event.
   - Aggregation: summarize/cross-link/deduplicate only child conclusions, record its aggregate event, and skip promotion.
   - Reconciliation: execute only the protocol's reconciliation section, keyed by `delivery_event.id`.
   - Query: resolve intent/scope/version, recall candidates through the current catalog/qmd, read canonical pages, check `applies_to`, `does_not_apply_when`, status, and invalidation signals, then answer with page/source citations. A miss is a knowledge gap, not permission to synthesize from the log.
   - Lint: report contradictions, staleness, duplicate concepts, orphan/broken links, retrieval projection drift, and gaps. Make zero writes.
   - A target-ambiguous conflict/entity result has zero page writes but records nonterminal `wiki: failed` plus the exact `resolution` / `entity_resolution` resume boundary and conflict payload; it is never `zero_atoms`.
   - Evidence-insufficient or value-gate-discarded material remains in the retrospective/candidate ledger. Any page-changing phase creates exactly one clean wiki commit; zero atoms creates none.
6. **Compile and refresh retrieval without changing truth**. Every page-changing plan updates the current-state `index.md` entry for each touched canonical page in the same commit and appends only `log.md`. After the commit, inspect the entire wiki worktree (excluding `.git` journal metadata), including ignored files. Run qmd collection/embed only when there are zero staged, unstaged, untracked, or ignored wiki paths. Index canonical current/needs-revalidation pages only and consult the catalog separately; exclude `index.md`, `log.md`, journals, and superseded page bodies from qmd/default answer retrieval. Any event-path or unrelated user draft returns `refresh_skipped_dirty_worktree`; never index uncommitted bytes as accepted knowledge. `zero_atoms` also skips refresh. A refresh failure is reported but never rolls back or amends the knowledge commit.
7. **Resume or evaluate promotion after a knowledge commit**. Read the persisted promotion phase; never infer it from the wiki commit.
   - `not_started` after `wiki: committed` → apply the gate exactly once only to `status: current`, conflict-free canonical evidence and persist `wiki_only` or `proposal_pending`; a proposal stores stable candidate ID, source event, wiki commit, immutable evidence page IDs/paths/blob OIDs/fingerprints, `action` + `target_skill`, and packet before the user sees it.
   - `proposal_pending` → first prove every bound evidence page still exactly matches current wiki `HEAD` and remains `current`; a stale candidate is acknowledged as terminal `wiki_only` and never applied. Otherwise return the same immutable candidate from the durable outbox; never re-evaluate or generate another ID. With `defer_promotion_question: true`, return `promotion: proposed_deferred` plus that payload to the caller. Until a bound yes/no acknowledges it, later eligible final reports may replay the same candidate ID; delivery attempts do not mark it terminal.
   - `approved` / `applying` / `failed` → rerun the same evidence-page staleness guard, then reuse the exact persisted candidate and approval record and resume only the same `vb-learn` application. Never rebuild or substitute the candidate.
   - `wiki: zero_atoms` → persist `promotion: not_applicable`.
   - Only `wiki_only`, `declined`, `completed`, and `not_applicable` are terminal acceptance-event promotion states. Aggregate, reconcile, skill-to-note, and consolidate record `promotion: skipped_aggregate`, `promotion: skipped_reconciliation`, `promotion: skipped_skill_source`, or `promotion: skipped_consolidation` for the operation and do not alter an acceptance event's promotion state.
8. **Honor separate authority and apply idempotently**. Only a reply bound by promotion-reply mode, persisted as `approval_record` for the same candidate ID/source event/wiki commit/evidence pages/action/target/packet hash, may authorize the one approved promotion packet. Pass the current-page staleness guard, atomically acknowledge the outbox with `promotion: approved`, then set `applying` and the tool-store baselines before invoking `vb-learn`. Mark `completed` only after `vb-learn` proves the candidate-tagged tool commit; on interruption or error, persist `failed` and retry the exact same candidate through `vb-learn`'s candidate-ID recovery and the guard. Explicit bound no atomically acknowledges with `declined`; ambiguity/no answer leaves the same outbox queued for at-least-once replay. The wiki commit remains complete and `~/.vb-skills` stays byte-identical without approval.
9. **Record and report**. For Linear acceptance/aggregation, ask `vb-linear` to append the compact result with `VibeRig-Event` plus `VibeRig-Record: phase:<event-id>` to the mapped host (Issue comment or registered Project Update); delivery reconciliation uses record kind `delivery`. Mirror only proven git state from the local journal. For manual, skill-to-note, and consolidation, persist the complete finalization/promotion state only in the atomic local journal; never assume a Linear scope exists. Return source evidence, operation ID, accepted source and `delivery_state` when applicable, pages, commit, qmd refresh/conflict result, discarded-signal summary, reconciliation result, and promotion result.

## Red Flags

- An accepted-unmerged source is deferred for merge → wrong; write it now and preserve `delivery_state` plus invalidation signals.
- Confidence is lowered merely because the accepted source is unmerged → wrong; confidence follows evidence quality.
- The same event creates duplicate pages, log entries, commits, or promotion questions → resume from persisted phase; `already_processed` requires all requested phases to be terminal.
- An uncommitted page or log line is treated as a completed wiki write → wrong; resume only through journal proof. A proven historical commit stays committed even if later user edits are now dirty; those edits are a separate conflict and are never absorbed.
- A dirty draft without the journal's exact staged tree is resumed or committed → wrong; return `wiki_draft_unverifiable` and preserve the bytes for manual resolution.
- A wiki commit is treated as proof that promotion was evaluated → wrong; resume `promotion: not_started` or the exact pending decision.
- Reconciliation re-runs atomization or promotion → wrong; it only compares content and supplements delivery provenance.
- Reconciliation is keyed by `acceptance_event.id` instead of `delivery_event.id` → wrong; normal distillation would short-circuit it.
- Reconciliation fills in a missing base event by distilling from merge evidence → wrong; return `base_event_missing` and resume the original acceptance phases.
- A high-confidence statement is retained merely because it is true or has a knowledge `type` → wrong; truth is an entry condition, while durable decision/understanding value and a bounded content contract decide retention.
- `future_query`, aliases, symptoms, or tags decide whether a claim deserves storage → wrong; those are post-retention SEO fields.
- `index.md` gets another historical line for the same page → wrong; update its one current entry. Historical activity belongs only in `log.md` and git.
- A search score or one-line catalog entry decides create/update/merge or answers the user → wrong; always read and compare canonical page content.
- A page retells the Issue, files, tests, or merge journey → wrong; keep operation history in its source/log and compile only current knowledge.
- A fact, convention, decision, root cause, command snippet, or checklist is promoted merely because it is reusable → keep it in the wiki unless every tool gate passes.
- A skill question appears before the wiki commit or without explaining why reading the wiki is insufficient → suppress it.
- A bare yes/no is bound to whichever pending candidate is easiest to find → wrong; require an explicit candidate ID or the uniquely matching immediate prior proposal.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| “The PR is not merged, so knowledge is provisional.” | Explicit acceptance authorizes a real, searchable write. Delivery state is metadata, not a lower knowledge tier. |
| “This is the second occurrence, so promotion is automatic.” | Recurrence is evidence of value, not proof that a tool package is needed. |
| “The user accepted the work, so they accepted the skill too.” | Acceptance authorizes retrospective and knowledge capture only. Skill creation requires a separate explicit yes. |
| “No retained note means learning failed.” | A sourced `zero_atoms` result is preferable to polluting memory with one-off details. |
| “If I can imagine search keywords, the note is valuable.” | Searchability is produced after admission. The knowledge editor first decides whether the content is worth remembering. |
| “index.md must be append-only for auditability.” | `log.md` and git preserve history. A retrieval catalog must represent the current canonical corpus exactly once. |

## Validation

```bash
git -C ~/.vb-wiki log --all --fixed-strings --grep="VibeRig-Operation: <operation-id>" --format="%H" # expected: exactly wiki_commit
git -C ~/.vb-wiki show <wiki_commit> -- <event-paths> # expected: exact event ID appears in the committed event diff
git -C ~/.vb-wiki status --porcelain --untracked-files=all --ignored=matching # any output requires refresh_skipped_dirty_worktree
# Only when post_commit_worktree_conflict is empty: event paths have no staged/unstaged diff.
# When it is non-empty: verify the journal lists those paths and do not stage, refresh, or recommit them.
npx -y @tobilu/qmd vsearch "<topic>" -c vb-wiki      # expected only after a clean-worktree refresh; best effort
```

- [ ] Explicit acceptance, `acceptance_event`, and the accepted source were proven before a Linear-path write; merge state was not used as a gate.
- [ ] Every retained knowledge decision is high-confidence, valuable, sourced, and has truthful known boundaries/re-check signals without template filler; accepted-unmerged evidence was not automatically downgraded.
- [ ] Every retained page passed the knowledge-value and type-specific contract; no Issue summary or keyword bundle was stored as knowledge.
- [ ] Write-time search recalled candidates, canonical content—not scores—decided no-change/update/create/conflict, and SEO introduced no claim.
- [ ] Dedup, event idempotency, scope routing, project identity, taxonomy, links, current-state index/append-only log, and one-commit rules passed.
- [ ] Query/lint read only committed canonical pages; log/journal/search snippets were never treated as truth.
- [ ] Distill/aggregate/reconcile used separate event IDs and resumed only journal-proven phases; `wiki: committed` passed exact trailer, parent/tree, branch reachability, and durable-log checks, with later dirty paths reported separately.
- [ ] Promotion ran only after a fresh wiki commit under event-scoped ownership, used only exact `current` evidence pages, and passed the staleness guard before replay/approval/application; aggregate/reconcile/skill/consolidate modes skipped it.
- [ ] Without an explicit yes, no `vb-learn` call or `~/.vb-skills` write occurred.
