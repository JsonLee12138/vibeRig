---
name: vb-wiki
description: >-
  Distil a completed Linear task — or an existing ~/.vb-skills skill — into
  the git-backed llm-wiki knowledge base at ~/.vb-wiki (global cross-project
  notes + per-project notes under projects/<project-key>/), organized by
  technology directory with an atomized fan-out (architecture / per-language
  / gotcha 错题 pages). Trigger phrases: "vb-wiki VB-42", "沉淀到 wiki",
  "记到 vb-wiki", "更新知识库", "vb-wiki skill <name>", "vb-wiki
  consolidate". Parallel to `vb-learn` (which distils into `~/.vb-skills`) —
  same trigger points, different store and different format (llm-wiki pages,
  not triggerable skills).
---

# VB Wiki

Given a Linear key (or a skill name under `~/.vb-skills`), read the source
autonomously and distil durable knowledge into `~/.vb-wiki` — a git-backed,
llm-wiki-style knowledge base (YAML frontmatter, `[[double-links]]`,
append-only `index.md`/`log.md`), split into global and per-project notes and
organized by **technology directory** (TIL style: `go/`, `typescript/`,
`architecture/`, …), not by note type. One accepted task fans out into
**multiple atomic pages** — typically one architecture/decision note, one
note per language/stack touched, and one gotcha (错题) note per pitfall hit —
all cross-linked as one thought chain. Read
[assets/schema-template.md](assets/schema-template.md) for the full
page/repo schema before writing anything.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept-issue` | issue 验收通过、状态置终态之后 — 传 issue key |
| `accept-milestone` | 里程碑验收通过之后 — 传里程碑 id |
| User (manual) | "vb-wiki VB-42", "沉淀到 wiki", "记到 vb-wiki", "更新知识库" |
| User (skill → note) | "vb-wiki skill <name>", "把 <skill> 记到 wiki" — 蒸馏一个已有 `~/.vb-skills/<name>/` skill |
| User (consolidate) | "vb-wiki consolidate" — 整理子流程，仅限用户显式触发 |

### Do NOT invoke

- Mid-implementation, to take working notes — this skill records *accepted*
  outcomes, not in-flight state.
- To create a triggerable skill — that is `vb-learn`'s job; this skill only
  *suggests* it (Step 8) and hands off on user confirmation.
- To copy a SKILL.md verbatim into the wiki — the skill → note path
  re-summarizes; it never transplants the file.

## Workflow

### 1. Bootstrap `~/.vb-wiki` (idempotent)

If `git -C ~/.vb-wiki rev-parse --is-inside-work-tree` prints `true`, skip —
never re-init, never overwrite. Otherwise:

1. `mkdir -p ~/.vb-wiki && git init ~/.vb-wiki`
2. Create each of `AGENTS.md`, `index.md`, `log.md` **only if missing**, with
   the verbatim contents of [assets/schema-template.md](assets/schema-template.md),
   [assets/index-template.md](assets/index-template.md), and
   [assets/log-template.md](assets/log-template.md) respectively.
3. `git add` the created files, commit `chore: init vb-wiki knowledge base`.

### 2. Resolve output language

Read the current project's `.vibeRig/project.yaml` `output.language` →
`WIKI_LANG`. Missing → use the user's current working language and state the
fallback. `WIKI_LANG` governs page **titles, bodies, index summaries, and
log reasons**. Never translate: slugs/filenames (always kebab-case English —
link stability), frontmatter keys, `type`/`scope` enum values, `tags`,
code/commands/error text, Linear keys, commit hashes, paths, URLs. On the
update-path, keep the target page's existing language — never mix languages
within one page.

### 3. Gather the source and split into atoms

**Linear-path**: read the issue/milestone and all comments.

**Skill-path** (source is `~/.vb-skills/<name>/`): read its SKILL.md and
references, then **re-summarize** — strip the skill skeleton (frontmatter,
trigger/When sections, validation checklists, step scaffolding) and extract
only the durable knowledge: invariants, the core procedure's shape, and the
pitfalls. Never copy the markdown through.

Produce an **atoms list**: each atom is one self-contained knowledge point,
classified as `tech × type × one-line summary`, where `type` is one of
`gotcha | pattern | decision | convention | fact`. A typical accepted task
yields several atoms — e.g. 1 cross-language architecture decision + 1 note
per language/stack touched + 1 gotcha per pitfall actually hit. Rules:

- Split by concern: never merge a Go-side lesson and a TS-side lesson into
  one page just because they came from one task.
- `type: gotcha` atoms (错题集) must be structured in three sections:
  **现象** (symptom as observed) / **错因** (root cause) / **自检清单**
  (checklist to prevent recurrence).
- All atoms from one event share the same `sources` and must
  `[[cross-link]]` each other — that is the persisted thought chain.
- Don't force atoms into existence: a trivially small task may yield one.

Steps 4–5 run **per atom**; Step 6 writes and commits them all at once.

### 4. Dedup — check for an existing page on the same topic (per atom)

```bash
npx -y @tobilu/qmd vsearch "<topic keywords>" -c vb-wiki   # semantic, preferred
grep -i "<topic keyword>" ~/.vb-wiki/index.md               # lexical fallback
```

If the `vb-wiki` collection isn't registered yet (first-ever run), treat qmd
as "no result" and rely on the `index.md` scan — never fail on qmd being
unavailable.

Judging "same topic" is semantic, not string-match: read the candidate's
title/summary, don't trust a score alone. A high-relevance top hit whose
title names the same subject → match. A page that merely mentions the
keyword in passing → not a match. A pure MOC/link page (see supersede, Step
6) is never an update target for content — follow its links to the real
page. **When uncertain, default to no-match (create a new page)** — an
extra page is cheap to consolidate later; appending unrelated content
corrupts an existing page for every future reader.

- **No match** → Step 5 (routing) then Step 6 create-path.
- **Match on existing page `P`** → skip Step 5 (P's path is the target), go
  to Step 6 update-path.

### 5. Routing — decide scope and target path (create-path only)

**5a. Classify scope** (agent judgment, no per-item confirmation): would
this knowledge help in *any* codebase (`scope: global` — tool usage,
language/framework pitfalls, general patterns) or only in *this* one
(`scope: project` — repo conventions, architecture decisions, project
gotchas)? When uncertain, default to `project` — promoting a page to global
later is easy; leaking project detail into global notes pollutes every other
project immediately.

**5b. Resolve `PROJECT_KEY`** (project scope only): match the current repo's
identity — `git remote get-url origin` parsed to an `owner/repo` slug,
and/or `.vibeRig/project.yaml`'s `linear.project_id` — against every
existing `~/.vb-wiki/projects/*/meta.md`. **Either field matching is
sufficient**; on a match, reuse that directory's name as `PROJECT_KEY` even
if it differs from this clone's derived name (renamed/relocated clones must
not fork a second project directory). No match → derive the key from
`.vibeRig/project.yaml` `project.name` and set `NEW_PROJECT_META=true` so
Step 6 also writes the project's `meta.md`. Exact commands and edge cases:
[references/project-identity.md](references/project-identity.md).

**5c. Resolve `TARGET_PATH`** — the directory axis is the **technology
stack**, never the page type:

- project → `~/.vb-wiki/projects/<PROJECT_KEY>/<tech-dir>/<slug>.md`
- global → `~/.vb-wiki/<tech-dir>/<slug>.md` (never contains `projects/`)

`<tech-dir>` selection is a controlled vocabulary:

1. `ls -d ~/.vb-wiki/*/` (or the project subtree) and **reuse** an existing
   directory whenever one fits.
2. Different language/runtime → different directory, always (`go/` vs
   `typescript/`; a note useful to both is two atoms or `architecture/`).
3. Cross-language / cross-stack knowledge (system design, module boundaries,
   monorepo layout decisions) → `architecture/` (or an existing platform
   directory like `monorepo/`).
4. Only when nothing fits, create a new directory — and in the same commit
   **register it in the taxonomy table in `~/.vb-wiki/AGENTS.md`** (this
   registration is the only permitted AGENTS.md edit).

`<slug>` is kebab-case English, no `.md`.

### 6. Write all atoms and commit once

Compute `NOW=$(date -u +%Y-%m-%d)` and `TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)`
once up front.

**Create-path** (Step 4 found no match for this atom):

1. `mkdir -p` the parent of `TARGET_PATH`; write the page: frontmatter
   `title/created/updated/type/scope/tags/sources` (plus
   `project_key: <PROJECT_KEY>` when project scope; `created` = `updated` =
   `NOW`). `sources` entries use the structured forms `linear:<KEY>`,
   `commit:<hash>`, `pr:<url>`, `file:<path>` — at least one, always.
   Optional typed relations when they truly hold:
   `caused_by` / `fixed_by` / `supersedes` (lists of `[[slug]]`).
2. Body in `WIKI_LANG`. Link to related pages with `[[double-links]]` —
   atoms of this same event must interlink; links to older pages only where
   a real relationship exists. **Never fabricate a link target; when no
   related page genuinely exists, zero links is correct.**
3. When `NEW_PROJECT_META=true`, also write
   `projects/<PROJECT_KEY>/meta.md` from
   [assets/meta-template.md](assets/meta-template.md) with the identity
   fields from Step 5b.

**Update-path** (Step 4 matched existing page `P`):

1. Never create a new file. Edit only `P`'s `updated:` frontmatter line
   (leave `created` untouched) and **append** the new content to `P`'s body
   in `P`'s existing language; cross-link the sibling atoms of this event.

**Supersede** (an existing page is being replaced/split by this event's
atoms): the one sanctioned body rewrite — reduce the old page's body to a
pure MOC (links to the pages that now hold the content, nothing else), add
`superseded_by: [[[new-slug]], ...]` to its frontmatter, bump `updated`, and
record it in `log.md` like any other touched page.

**All paths, then commit**:

4. Append **one `index.md` line and one `log.md` line per page touched**
   (created, updated, or superseded):
   - `index.md`: `- [[<slug>]] — scope: <scope> — dir: <tech-dir> — type: <type> — <summary>`
   - `log.md`: `- <TS> — [[<slug>]] — <scope> — <reason>` (note "updated
     existing page" / "superseded" where applicable)
   Never edit or reorder existing lines yourself.
5. Check `git -C ~/.vb-wiki status --porcelain` for changes **you did not
   make** (uncommitted manual edits — possibly human, possibly valid).
   Stage **everything** (`git add -A`) and commit **once** for the whole
   event. If pre-existing foreign changes were absorbed, list them in the
   commit message: `(absorbs uncommitted manual edits: <files>)`.
6. Verify `git -C ~/.vb-wiki status --porcelain` is now empty. If not, stop
   and investigate — do not commit further.

### 7. Refresh vector index (best-effort, after the commit lands)

```bash
npx -y @tobilu/qmd collection add ~/.vb-wiki --name vb-wiki   # idempotent
npx -y @tobilu/qmd embed -c vb-wiki
```

One collection covers the whole tree — never one per project. On failure:
report it and stop this step; never retry indefinitely, never roll back or
amend the Step 6 commit. The write is durable; a missed refresh only delays
search recall and any later `embed` run heals it.

### 8. Suggest a skill (read-only gate)

Only when this event took the **update-path on a procedure-shaped page**
(`type: gotcha` or `pattern` describing a repeatable action sequence) — i.e.
the same lesson has now come up at least twice. Recurrence is the promotion
signal from semantic to procedural memory; never suggest on a page's first
write, and never for plain facts/decisions/conventions.

Ask **once**, presenting a proposed skill name (`^[a-z0-9][a-z0-9-]*$`) and
a one-line When trigger, e.g.:

> This lesson has now recurred. Want me to turn it into a skill? Proposed
> name: `<name>`. When: "<trigger>". Create it? (yes/no)

- **No / no answer** → stop. Zero writes to `~/.vb-skills/`, zero changes to
  `vb-skill-lock.json`, no `vb-learn` invocation. The wiki write stands.
- **Yes** → hand the name + When to `vb-learn`'s existing skill-creation
  workflow; do not duplicate its planning/lock/commit logic here.

This step never touches `~/.vb-wiki`.

### Consolidate (manual trigger only)

On explicit "vb-wiki consolidate" (never self-initiated): merge duplicate
pages (winner absorbs, loser becomes a superseded MOC), slim bloated MOCs,
fix broken `[[links]]`, re-taxonomize misfiled pages (`git mv` to the right
`<tech-dir>`, then append correction lines to `index.md`/`log.md` — never
edit historical lines), and optionally rewrite legacy pages into `WIKI_LANG`
(never forced — do it page-by-page as they're touched). One consolidate run
= one commit, followed by a Step 7 embed refresh.

## Hard Rules

- Step 4 (dedup) runs per atom before any write — create-vs-update is
  decided before any file under `~/.vb-wiki` is touched.
- Never overwrite an existing page file on the create-path — if
  `TARGET_PATH` exists, dedup should have routed to an update; stop and
  investigate.
- The directory axis is the technology stack; `type` never determines the
  path. A new `<tech-dir>` requires the AGENTS.md taxonomy registration in
  the same commit.
- Never fabricate a `[[link]]` target; zero links beats a fake link.
- `index.md`/`log.md` are append-only **for the agent** — never edit,
  reorder, or delete an existing line; corrections are new appended lines.
  Every page touched gets exactly one new line in each.
- Every distillation event is exactly one commit; pre-existing uncommitted
  working-tree changes are absorbed into it (`git add -A`) and named in the
  commit message — never discarded, never left behind.
- `sources` must be non-empty and structured (`linear:` / `commit:` / `pr:`
  / `file:`) — refuse to write a page otherwise.
- Skill-path never copies SKILL.md content verbatim — re-summarized atoms
  only.
- `meta.md` is never committed alone — it rides with the project's first
  page. Never modify an existing project's `meta.md`.
- Step 7 failures never block or undo the write; Step 8 declines never
  touch `~/.vb-skills`. Consolidate runs only on explicit user trigger.

## Validation

```bash
OLD=<HEAD before the write>
git -C ~/.vb-wiki status --porcelain              # empty
git -C ~/.vb-wiki log --oneline $OLD..HEAD        # exactly 1 line
awk '/^---$/{n++} n==1' <page>                    # all frontmatter fields; sources structured & non-empty
# link check — every [[slug]] in touched pages resolves to a real file:
grep -ohE '\[\[[a-z0-9-]+\]\]' <touched pages> | sort -u | tr -d '[]' \
  | while read s; do find ~/.vb-wiki -name "$s.md" | grep -q . || echo "BROKEN: $s"; done
# index/log discipline — one line per touched page, equal counts, additions only:
git -C ~/.vb-wiki show HEAD -- index.md log.md    # agent's changes are "+" lines; added index lines == added log lines == pages touched
npx -y @tobilu/qmd vsearch "<topic>" -c vb-wiki   # new/updated pages in results
```

- [ ] Atoms split by concern: no page mixes two languages'/stacks' lessons;
      atoms of this event cross-link each other.
- [ ] Every page sits in a `<tech-dir>` from the AGENTS.md taxonomy (new
      dirs registered in the same commit); no page path derived from `type`.
- [ ] `type: gotcha` pages contain the 现象 / 错因 / 自检清单 sections.
- [ ] Body/title/index summary/log reason are in `WIKI_LANG` (update-path:
      the page's existing language); slugs, frontmatter keys, enums, tags,
      code, and IDs untranslated.
- [ ] Create-path: page at the routed path, correct `scope`/`project_key`
      pairing (project pages under `projects/<key>/` with matching
      frontmatter; global pages outside `projects/` with no `project_key`).
- [ ] Update-path: no new `.md` content file for that atom; `updated`
      changed while `created` didn't.
- [ ] Superseded pages: body is pure MOC, `superseded_by` present.
- [ ] Renamed/relocated clone resolves to the existing `PROJECT_KEY`
      (`ls ~/.vb-wiki/projects/` count unchanged).
- [ ] Absorbed manual edits (if any) are named in the commit message.
- [ ] Skill gate: fired only on a recurrence (update-path), at most one
      yes/no question; a decline leaves `ls -R ~/.vb-skills` and
      `shasum ~/.vb-skills/vb-skill-lock.json` byte-identical.
