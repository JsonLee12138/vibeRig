---
name: vb-wiki
description: >-
  Distil a completed Linear task into the git-backed llm-wiki knowledge base
  at ~/.vb-wiki (global cross-project notes + per-project notes under
  projects/<project-key>/). Trigger phrases: "vb-wiki VB-42", "沉淀到
  wiki", "记到 vb-wiki", "更新知识库". Parallel to `vb-learn` (which
  distils into `~/.vb-skills`) — same trigger points, different store and
  different format (llm-wiki pages, not triggerable skills).
---

# VB Wiki

Given a Linear key, read the task and its comments autonomously and distil
durable knowledge (gotchas, domain facts, code conventions, decision
rationale) into `~/.vb-wiki` — a git-backed, llm-wiki-style knowledge base
(YAML frontmatter, `[[double-links]]`, append-only `index.md`/`log.md`),
split into global and per-project notes. Read
[assets/schema-template.md](assets/schema-template.md) for the full
page/repo schema before writing anything.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept-issue` | issue 验收通过、状态置终态之后 — 传 issue key |
| `accept-milestone` | 里程碑验收通过之后 — 传里程碑 id |
| User (manual) | "vb-wiki VB-42", "沉淀到 wiki", "记到 vb-wiki", "更新知识库" |

### Do NOT invoke

- Mid-implementation, to take working notes — this skill records *accepted*
  outcomes, not in-flight state.
- To create a triggerable skill — that is `vb-learn`'s job; this skill only
  *suggests* it (Step 6) and hands off on user confirmation.

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

### 2. Dedup — check for an existing page on the same topic

Before routing or writing, search for an existing page covering the topic:

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
keyword in passing → not a match. **When uncertain, default to no-match
(create a new page)** — an extra page is cheap to consolidate later;
appending unrelated content corrupts an existing page for every future
reader.

- **No match** → Step 3 (routing) then Step 4 create-path.
- **Match on existing page `P`** → skip Step 3 (P's path is the target), go
  to Step 4 update-path.

### 3. Routing — decide scope and target path (create-path only)

**3a. Classify scope** (agent judgment, no per-item confirmation): would
this knowledge help in *any* codebase (`scope: global` — tool usage,
language/framework pitfalls, general patterns) or only in *this* one
(`scope: project` — repo conventions, architecture decisions, project
gotchas)? When uncertain, default to `project` — promoting a page to global
later is easy; leaking project detail into global notes pollutes every other
project immediately.

**3b. Resolve `PROJECT_KEY`** (project scope only): match the current repo's
identity — `git remote get-url origin` parsed to an `owner/repo` slug,
and/or `.vibeRig/project.yaml`'s `linear.project_id` — against every
existing `~/.vb-wiki/projects/*/meta.md`. **Either field matching is
sufficient**; on a match, reuse that directory's name as `PROJECT_KEY` even
if it differs from this clone's derived name (renamed/relocated clones must
not fork a second project directory). No match → derive the key from
`.vibeRig/project.yaml` `project.name` and set `NEW_PROJECT_META=true` so
Step 4 also writes the project's `meta.md`. Exact commands and edge cases:
[references/project-identity.md](references/project-identity.md).

**3c. Resolve `TARGET_PATH`**:

- project → `~/.vb-wiki/projects/<PROJECT_KEY>/<type-dir>/<slug>.md`
- global → `~/.vb-wiki/<type-dir>/<slug>.md` (never contains `projects/`)

`<type-dir>` is the plural of the page `type` (`gotcha` → `gotchas/`, etc.);
`<slug>` is kebab-case, no `.md`.

### 4. Write or update a page (exactly one commit)

Compute `NOW=$(date -u +%Y-%m-%d)` and `TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)`
once up front.

**Create-path** (Step 2 found no match):

1. `mkdir -p` the parent of `TARGET_PATH`; write the page: frontmatter
   `title/created/updated/type/scope/tags/sources` (plus
   `project_key: <PROJECT_KEY>` when project scope; `created` = `updated` =
   `NOW`; `sources` non-empty — Linear key, commit hash, PR URL), then the
   body containing **at least one `[[double-link]]` to a real existing
   page** — never fabricate a link target.
2. When `NEW_PROJECT_META=true`, also write
   `projects/<PROJECT_KEY>/meta.md` from
   [assets/meta-template.md](assets/meta-template.md) with the identity
   fields from Step 3b.

**Update-path** (Step 2 matched existing page `P`):

1. Never create a new file. Edit only `P`'s `updated:` frontmatter line
   (leave `created` untouched) and **append** the new content to `P`'s body;
   the appended content must contain at least one `[[double-link]]`.

**Both paths**:

3. Append exactly one line to `index.md`
   (`- [[<slug>]] — scope: <scope> — <summary>`) and one entry to `log.md`
   (`- <TS> — [[<slug>]] — <scope> — <reason>`; note "updated existing
   page" on the update-path). Never edit or reorder existing lines.
4. Stage **exactly** the touched files (page, `index.md`, `log.md`, plus
   `meta.md` if written) — never `git add -A` — and commit once.
5. Verify `git -C ~/.vb-wiki status --porcelain` is empty. If not, stop and
   investigate — do not commit further.

### 5. Refresh vector index (best-effort, after the commit lands)

```bash
npx -y @tobilu/qmd collection add ~/.vb-wiki --name vb-wiki   # idempotent
npx -y @tobilu/qmd embed -c vb-wiki
```

One collection covers the whole tree — never one per project. On failure:
report it and stop this step; never retry indefinitely, never roll back or
amend the Step 4 commit. The write is durable; a missed refresh only delays
search recall and any later `embed` run heals it.

### 6. Suggest a skill (read-only gate)

Only when the just-written page describes a reusable **operational
procedure** — a repeatable action sequence with a clear trigger ("when X,
do steps 1..N") — not a plain gotcha/fact/decision/convention. When
uncertain, don't ask; firing on every write turns the gate into noise.

Ask **once**, presenting a proposed skill name (`^[a-z0-9][a-z0-9-]*$`) and
a one-line When trigger, e.g.:

> This page describes a reusable procedure. Want me to turn it into a
> skill? Proposed name: `<name>`. When: "<trigger>". Create it? (yes/no)

- **No / no answer** → stop. Zero writes to `~/.vb-skills/`, zero changes to
  `vb-skill-lock.json`, no `vb-learn` invocation. The wiki write stands.
- **Yes** → hand the name + When to `vb-learn`'s existing skill-creation
  workflow; do not duplicate its planning/lock/commit logic here.

This step never touches `~/.vb-wiki`.

## Hard Rules

- Step 2 (dedup) runs before any routing or write — create-vs-update is
  decided before any file under `~/.vb-wiki` is touched.
- Never overwrite an existing page file on the create-path — if
  `TARGET_PATH` exists, dedup should have routed to an update; stop and
  investigate.
- `index.md`/`log.md` are append-only — never edit, reorder, or delete an
  existing line.
- Every distillation is exactly one commit on a clean tree; stage touched
  files explicitly, never `git add -A`.
- `sources` must never be empty — refuse to write a page without at least
  one source.
- Never modify an existing project's `meta.md` — it is written once, on the
  project's first write.
- Step 5 failures never block or undo the write; Step 6 declines never
  touch `~/.vb-skills`.

## Validation

```bash
OLD=<HEAD before the write>
git -C ~/.vb-wiki status --porcelain              # empty
git -C ~/.vb-wiki log --oneline $OLD..HEAD        # exactly 1 line
awk '/^---$/{n++} n==1' <page>                    # all frontmatter fields, sources non-empty
grep -cE '\[\[[^]]+\]\]' <page>                   # >= 1
git -C ~/.vb-wiki show HEAD -- index.md log.md    # only "+" lines
npx -y @tobilu/qmd vsearch "<topic>" -c vb-wiki   # new/updated page in results
```

- [ ] Create-path: page at the routed path, correct `scope`/`project_key`
      pairing (project pages under `projects/<key>/` with matching
      frontmatter; global pages outside `projects/` with no `project_key`).
- [ ] Update-path: no new `.md` content file in the commit; `updated`
      changed while `created` didn't; appended content has a double-link.
- [ ] Renamed/relocated clone resolves to the existing `PROJECT_KEY`
      (`ls ~/.vb-wiki/projects/` count unchanged).
- [ ] Skill gate: at most one yes/no question; a decline leaves
      `ls -R ~/.vb-skills` and `shasum ~/.vb-skills/vb-skill-lock.json`
      byte-identical.
