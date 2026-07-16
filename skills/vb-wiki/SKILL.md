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

Given a Linear key, read the task and all sub-tasks autonomously and distil
durable knowledge (gotchas, domain facts, code conventions, decision
rationale) into `~/.vb-wiki` — a git-backed, llm-wiki-style knowledge base
(YAML frontmatter, `[[double-links]]`, `index.md`, `log.md`), split into
global notes and per-project notes. See `assets/schema-template.md` for the
full page/repo schema.

**Status of this skill**: this version implements the **topic dedup check**
(Step 2 below, `JSO-275`), the **repo bootstrap** (Step 1), **global/project
routing with cross-path project identity matching** (Step 3 below, `JSO-270`
+ `JSO-272`), the **core single-page write engine — with both a create-path
and an update-path** (Step 4 below; the update-path is `JSO-275`), the
**qmd embed refresh** (Step 5 below, `JSO-271`), and the **skill-creation
suggestion gate** (Step 6 below, `JSO-273`) — given a Linear key and
distilled content, it first checks whether an existing page already covers
the same topic (Step 2). If no existing page matches, it classifies the
content as `scope: global` or `scope: project`, resolves
`TARGET_PATH`/`PROJECT_KEY` (matching the current repo's identity against
existing `projects/*/meta.md` files so a renamed or relocated clone reuses
its original project directory instead of forking a new one), and writes
one frontmatter'd page (and, on a project's first-ever write, its
`meta.md`) — the create-path. If an existing page `P` already covers the
topic, it instead updates `P`'s `updated` field and appends new,
double-linked content to `P` — the update-path — without creating any new
page file. Either path appends to `index.md`/`log.md`, produces exactly one
commit on a clean tree, best-effort refreshes the `vb-wiki` qmd collection's
vector index so the change becomes searchable, and then — only when the
just-written/updated page is a reusable operational procedure — asks the
user once whether to create a skill from it, handing off to `vb-learn` on
"yes" and doing nothing further on "no" — satisfying `AC-4` through `AC-11`
and `AC-14`/`AC-15` in full.

This is the **last issue in milestone M1 (req-0001)**: every step this
skill needs is implemented, and there are no remaining "future work" /
handoff notes below.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept-issue` | issue 验收通过、状态置终态之后 — 传 issue key（分工同 `vb-learn`：由后续 issue 接线） |
| `accept-milestone` | 里程碑验收通过之后 — 传里程碑 id（分工同 `vb-learn`：由后续 issue 接线） |
| User (manual) | "vb-wiki VB-42", "沉淀到 wiki", "记到 vb-wiki", "更新知识库" |

### Do NOT invoke

- Steps 0–6 (dedup + bootstrap + routing incl. project identity matching +
  core page write/update + qmd embed refresh + skill-suggestion gate) are
  all implemented. Do not skip Step 2 and jump straight to Step 3
  (routing) or Step 4 (write) — every distillation must run the dedup check
  first so create-vs-update is decided before any file under `~/.vb-wiki`
  is touched.
- Step 6 must never create a skill itself, write to `~/.vb-skills/`, or touch
  `vb-skill-lock.json` directly — on user confirmation it only hands off to
  `vb-learn`'s existing skill-creation workflow (see Step 6 below).

## Workflow

### 1. Bootstrap `~/.vb-wiki` (idempotent)

Run before any write. If `~/.vb-wiki` already exists **and** is already a git
repository, do nothing — never re-init, never overwrite existing content.

```bash
if git -C ~/.vb-wiki rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "vb-wiki already initialized — skipping bootstrap"
else
  mkdir -p ~/.vb-wiki
  git -C ~/.vb-wiki rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || git init ~/.vb-wiki >/dev/null

  NEW_FILES=""
  [ -f ~/.vb-wiki/AGENTS.md ]  || NEW_FILES="$NEW_FILES AGENTS.md"
  [ -f ~/.vb-wiki/index.md ]   || NEW_FILES="$NEW_FILES index.md"
  [ -f ~/.vb-wiki/log.md ]     || NEW_FILES="$NEW_FILES log.md"

  # Only create files that are actually missing — never clobber existing ones.
  # Content for each comes verbatim from this skill's assets/*-template.md:
  #   AGENTS.md <- assets/schema-template.md
  #   index.md  <- assets/index-template.md
  #   log.md    <- assets/log-template.md

  if [ -n "$NEW_FILES" ]; then
    git -C ~/.vb-wiki add $NEW_FILES
    git -C ~/.vb-wiki commit -m "chore: init vb-wiki knowledge base" >/dev/null
  fi
fi
```

Concretely (this is a markdown-skill plugin — the agent performs the file
writes itself, there is no compiled installer):

1. Check: `git -C ~/.vb-wiki rev-parse --is-inside-work-tree` — if it prints
   `true`, the repo already exists and is initialized. **Stop here, do
   nothing else in this step.**
2. Otherwise, create `~/.vb-wiki/` if missing, then `git init ~/.vb-wiki`.
3. For each of `AGENTS.md`, `index.md`, `log.md` under `~/.vb-wiki/`: if the
   file does not already exist, write it with the verbatim contents of this
   skill's `assets/schema-template.md`, `assets/index-template.md`, and
   `assets/log-template.md` respectively. If a file already exists (e.g. a
   partially-initialized store), leave it untouched.
4. If any file was created in step 3, `git -C ~/.vb-wiki add` those files and
   `git -C ~/.vb-wiki commit -m "chore: init vb-wiki knowledge base"` so the
   working tree ends clean.

### 2. Check for an existing page on the same topic (dedup)

Run after Step 1 (bootstrap) and before Step 3 (routing) — this step decides
whether Step 3/4 ever run their create-path at all, or whether Step 4's
update-path runs instead. This is `JSO-275`'s dedup-before-write check
(`AC-14`): 沉淀前对已有页面做主题查重，命中同主题旧页面时更新而非新建。

**Inputs**: the same distilled content the caller would otherwise hand
straight to Step 3's routing — at minimum a topic/title and the draft
`BODY` to be written or appended.

**2a. Search for a same-topic existing page.** Use both search methods
below when available; either alone is acceptable if the other is
unavailable (e.g. qmd not yet installed/registered):

1. **qmd vector search** (preferred — semantic, catches paraphrased or
   differently-worded topics) against the `vb-wiki` collection that Step 5
   (qmd embed refresh) maintains:

   ```bash
   npx -y @tobilu/qmd vsearch "<topic keywords from the content to be distilled>" -c vb-wiki
   ```

   If the `vb-wiki` collection isn't registered yet (e.g. this is the very
   first distillation ever, before Step 5 has run once), treat this as "no
   result" and fall back to the `index.md` scan below — do not fail this
   step or block the write on qmd being unavailable.

2. **`index.md` scan** (lexical fallback / cross-check) — grep
   `~/.vb-wiki/index.md`'s one-line-per-page summaries for keyword overlap
   with the topic:

   ```bash
   grep -i "<topic keyword>" ~/.vb-wiki/index.md
   ```

**2b. Judge "same topic" — a semantic heuristic, not exact-string
matching.**

- Treat a candidate as "same topic" only when it is clearly, substantively
  about the same subject as the content about to be distilled — not merely
  sharing a keyword. Read the candidate page's title/body (or the matched
  `index.md` summary), not just a vsearch score, before deciding.
- A high qmd relevance score on the top hit, combined with a title/summary
  that names the same subject, is a strong "same topic" signal.
- A low relevance score, or a top hit that only mentions the topic in
  passing while being primarily about something else, is **not** a match.
- **When uncertain, default to creating a new page** — i.e. behave as if no
  match were found and proceed to Step 3/Step 4's create-path. False
  negatives (an avoidable extra page) are cheap: the store can be
  consolidated later. False positives (appending unrelated content into an
  existing page `P`) corrupt `P` for every future reader of that page — a
  materially more expensive mistake. This mirrors Step 3a's existing "when
  uncertain, default to project scope" reversibility argument.

**2c. Route based on the outcome:**

- **No match found** (including "qmd unavailable and `index.md` scan found
  nothing") → proceed to Step 3 (routing) and Step 4's create-path,
  unchanged from prior versions of this skill.
- **Match found** (existing page `P`) → skip Step 3 (routing) entirely —
  there is no fresh `TARGET_PATH` to resolve, `P`'s existing path *is* the
  target — and go straight to Step 4's **update-path** instead of its
  create-path.

### 3. Decide scope and target path (routing)

Run only when Step 2 found **no** matching existing page. This step turns
distilled content into the `TARGET_PATH`/`SCOPE`/`PROJECT_KEY` inputs Step 4
expects — it does not write, `mkdir`, or touch git at all; Step 4 does all of
that.

**3a. Classify scope.** Per `.vibeRig/requirements/req-0001/intake.md`
("全局 / 项目分流由 agent 自动判断，无需逐条确认"), this is an agent
judgment call, not a deterministic rule — no per-item user confirmation is
required. Ask: would this knowledge help in *any* codebase, or only in
*this* one?

- `scope: project` — specific to this codebase's conventions, architecture
  decisions, or gotchas. Examples grounded in vb-plugin itself:
  - vb-plugin's version number must be kept in sync across 6 locations
    (`package.json`, `.claude-plugin/plugin.json`,
    `.claude-plugin/marketplace.json`, etc. — see this repo's `CLAUDE.md`
    "Version Sync" rule). That release convention is specific to this repo's
    file layout, not a general practice.
  - VibeRig stores milestone/issue state exclusively in Linear, never in a
    local markdown copy as source of truth — an architecture decision
    specific to this project's workflow design.
  - `skills/vb-wiki` Step 4 (write engine) stages exactly three files per
    commit and never uses `git add -A` — an implementation convention of
    this specific skill in this specific repo.
- `scope: global` — reusable across projects: tool usage, language/framework
  pitfalls, general patterns. Examples:
  - `npx` can hit a registry timeout on first run and needs a retry (see the
    `npx-registry-timeout` example used elsewhere in this file) — a generic
    npm-tooling gotcha, not tied to vb-plugin.
  - Idempotent repo bootstrap: check
    `git rev-parse --is-inside-work-tree` before `git init`, never re-init an
    existing repo — reusable in any git-backed tool, as done in Step 1 above.
  - The llm-wiki distillation pattern itself (YAML frontmatter +
    `[[double-link]]`, append-only `index.md`/`log.md`) is a general
    knowledge-management technique, not something particular to vb-plugin.

  When genuinely uncertain, default to `scope: project` — over-scoping to
  project is reversible later (a page can be promoted to global), while
  leaking project-specific detail into global notes pollutes every other
  project's context immediately.

**3b. Resolve `PROJECT_KEY`** (only needed when `scope: project`), by
matching the current repo's identity against existing
`projects/*/meta.md` files before ever deriving a fresh key — this is what
lets a renamed or relocated clone of the same repo reuse its original
`projects/<key>/` directory instead of forking a new one (`JSO-272`,
`AC-11`).

**Step 1 — extract the current repo's identity fields.**

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
CURRENT_GITHUB_REPO=$(echo "$REMOTE_URL" | sed -E 's#^(https?://[^/]+/|git@[^:]+:|ssh://git@[^/]+/)##; s#\.git$##')

CURRENT_LINEAR_PROJECT_ID=$(awk '
  /^linear:/ { in_linear=1; next }
  /^[^ ]/ { in_linear=0 }
  in_linear && /^[ ]+project_id:/ {
    sub(/^[ ]+project_id:[ ]*/, "");
    gsub(/"/,"");
    print;
    exit
  }
' .vibeRig/project.yaml)
```

- `CURRENT_GITHUB_REPO` is the `owner/repo` slug parsed out of `git remote
  get-url origin` (handles `https://github.com/owner/repo(.git)`,
  `git@github.com:owner/repo.git`, and `ssh://git@github.com/owner/repo.git`
  forms). This is a deliberate, documented simplification of "GitHub repo
  id": the numeric GitHub repo id requires a GitHub API call, which this
  step avoids; the `owner/repo` slug is stable across renames/relocations of
  the *local clone* (it only changes if the repo is renamed *on GitHub*,
  which is a materially different, rarer event than "moved to a new local
  path" that this issue targets). If there is no `origin` remote,
  `CURRENT_GITHUB_REPO` is empty — that half of the match is simply
  unavailable, not an error.
- `CURRENT_LINEAR_PROJECT_ID` reads the nested `linear.project_id` field
  from the current repo's `.vibeRig/project.yaml` (not `project.name` — that
  placeholder read is now only a same-invocation fallback, see Step 4
  below). Empty if `.vibeRig/project.yaml` has no `linear:` block or no
  `project_id` under it.

**Step 2 — derive the candidate key** (same placeholder-style derivation as
before; only used if no existing project matches):

```bash
CANDIDATE_KEY=$(awk -F': *' '/^project:/{p=1} p && /name:/{gsub(/"/,"",$2); print $2; exit}' .vibeRig/project.yaml)
```

**Step 3 — scan existing `projects/*/meta.md` files for an identity match**,
before creating anything:

```bash
PROJECT_KEY=""
for META in ~/.vb-wiki/projects/*/meta.md; do
  [ -f "$META" ] || continue
  EXISTING_GITHUB_REPO=$(awk -F': *' '/^github_repo:/{gsub(/"/,"",$2); print $2; exit}' "$META")
  EXISTING_LINEAR_PROJECT_ID=$(awk -F': *' '/^linear_project_id:/{gsub(/"/,"",$2); print $2; exit}' "$META")
  if { [ -n "$CURRENT_GITHUB_REPO" ] && [ "$CURRENT_GITHUB_REPO" = "$EXISTING_GITHUB_REPO" ]; } \
     || { [ -n "$CURRENT_LINEAR_PROJECT_ID" ] && [ "$CURRENT_LINEAR_PROJECT_ID" = "$EXISTING_LINEAR_PROJECT_ID" ]; }; then
    PROJECT_KEY=$(basename "$(dirname "$META")")
    break
  fi
done

if [ -z "$PROJECT_KEY" ]; then
  PROJECT_KEY="$CANDIDATE_KEY"
  NEW_PROJECT_META=true   # Step 4 (write engine) must also create this project's meta.md this write
else
  NEW_PROJECT_META=false  # matched an existing project — reuse it, never create a second directory
fi
```

**Either field matching is sufficient** — `github_repo` OR
`linear_project_id`, not both — per intake.md's "项目唯一性校验": "任一匹配即
认定为同一项目". The scan stops at the first match; `~/.vb-wiki/projects/`
is not expected to contain more than one `meta.md` matching the same
identity (if it does, that is a pre-existing dedup problem out of this
step's scope, not something to resolve here).

If a match is found, `PROJECT_KEY` is the **existing** directory's name —
even when it differs from `CANDIDATE_KEY` (e.g. `vb-plugin` vs.
`vb-plugin-renamed`). This is the whole point: the renamed/relocated clone's
derived name is discarded in favor of the identity match, so its knowledge
lands in the same `projects/<key>/` directory as before instead of forking a
new one.

If no match is found, this is the first time this project is seen:
`PROJECT_KEY = CANDIDATE_KEY`, and `NEW_PROJECT_META=true` is handed off to
Step 4 so it also writes this project's `meta.md` (see Step 4 below) —
recording `CURRENT_GITHUB_REPO`/`CURRENT_LINEAR_PROJECT_ID` so a *future*
renamed/relocated clone of *this* project can match back to it.

**3c. Resolve `TARGET_PATH`**:

- `scope: project` →
  `~/.vb-wiki/projects/<PROJECT_KEY>/<content-type-dir>/<slug>.md`
- `scope: global` → `~/.vb-wiki/<content-type-dir>/<slug>.md` — this path
  must **not** contain a `projects/` segment anywhere.

`<content-type-dir>` is the plural of Step 4's `TYPE` input (`gotcha` →
`gotchas/`, `convention` → `conventions/`, `pattern` → `patterns/`,
`decision` → `decisions/`, `fact` → `facts/`). `<slug>` is Step 4's
`PAGE_SLUG` input (kebab-case, no `.md`).

**3d. Frontmatter obligations these choices impose on Step 4**:

- `scope: project` → Step 4's frontmatter must include `scope: project` and
  `project_key: <PROJECT_KEY>`, and `PROJECT_KEY` must equal the
  `projects/<PROJECT_KEY>/` directory segment in `TARGET_PATH` (`AC-5`).
- `scope: global` → Step 4's frontmatter must include `scope: global` and
  must **not** include a `project_key` field at all; `TARGET_PATH` must not
  contain `projects/` anywhere (`AC-6`).

**3e. Hand off** `TARGET_PATH`, `SCOPE`, and (when `scope: project`)
`PROJECT_KEY`, `NEW_PROJECT_META`, `CURRENT_GITHUB_REPO`, and
`CURRENT_LINEAR_PROJECT_ID` to Step 4 unchanged — do not duplicate Step 4's
write logic here, this step only produces its inputs.

### 4. Write or update a page (core write engine)

This step has two paths, selected by Step 2's outcome:

- **Create-path** (Step 2 found no matching page) — writes a brand-new page
  file. This is unchanged from prior versions of this skill; see "Create-path"
  below.
- **Update-path** (Step 2 found an existing page `P` on the same topic) —
  never creates a new page file; instead updates `P`'s `updated` field and
  appends new, double-linked content to `P`. This is `JSO-275`'s `AC-14`
  work; see "Update-path" below.

Both paths still append to `index.md`/`log.md` and still produce exactly one
commit on a clean tree — the discipline in Step 4's Hard Rules applies to
either path equally.

#### Create-path

**Inputs this path assumes the caller already resolved** (Step 3 above
resolves `TARGET_PATH`/`SCOPE`/`PROJECT_KEY`/`NEW_PROJECT_META`; this path
only runs when Step 2 found no matching existing page):

- `TARGET_PATH` — absolute path under `~/.vb-wiki/` for the new page, e.g.
  `~/.vb-wiki/gotchas/npx-registry-timeout.md` (global) or
  `~/.vb-wiki/projects/vb-plugin/conventions/skill-status-notes.md`
  (project). The parent directory may not exist yet.
- `PAGE_SLUG` — `TARGET_PATH`'s filename without the `.md` extension and
  without any path segment (per the schema's double-link convention), e.g.
  `npx-registry-timeout`.
- `TITLE`, `TYPE` (e.g. `gotcha`, `convention`, `pattern`, `decision`,
  `fact`), `SCOPE` (`global` or `project`), `TAGS` (list), `SOURCES` (list,
  **must be non-empty** — Linear issue key, commit hash, PR URL, etc.), and
  `PROJECT_KEY` (only when `SCOPE=project`, must match the containing
  `projects/<project-key>/` directory name).
- `NEW_PROJECT_META`, `CURRENT_GITHUB_REPO`, `CURRENT_LINEAR_PROJECT_ID`
  (only when `SCOPE=project`, from Step 3b) — when `NEW_PROJECT_META=true`,
  this write is the first-ever write for `PROJECT_KEY` and must also create
  `~/.vb-wiki/projects/<PROJECT_KEY>/meta.md` (step 4a below); when `false`,
  that project already has a `meta.md` and this step must **not** touch it.
- `BODY` — the distilled markdown content, which the caller must write to
  include **at least one** `[[double-link]]` to a related, already-existing
  page (never invent a link to a page that doesn't exist — if no genuine
  related page exists yet, link to the closest real one, e.g. a topic index
  page, rather than fabricating a target).
- A one-line `SUMMARY` (for `index.md`) and `REASON` (for `log.md`).

**Sequence** (this is a markdown-skill plugin — the agent performs every
file write and git command itself):

1. Compute `NOW=$(date -u +%Y-%m-%d)` (ISO 8601 date) and
   `TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)` (ISO 8601 timestamp) once, up front,
   so `created`/`updated` and the log timestamp are consistent within one
   write.
2. `mkdir -p` the parent directory of `TARGET_PATH` if it doesn't exist.
3. Write `TARGET_PATH` with frontmatter followed by `BODY`:

   ```markdown
   ---
   title: <TITLE>
   created: <NOW>
   updated: <NOW>
   type: <TYPE>
   scope: <SCOPE>
   tags: [<TAGS...>]
   sources: [<SOURCES...>]
   ---

   <BODY, containing at least one [[double-link]]>
   ```

   When `SCOPE: project`, add a `project_key: <PROJECT_KEY>` line to the
   frontmatter (after `scope`), per `assets/schema-template.md`. `created`
   and `updated` are identical on a first write — only the update-path
   below (`AC-14`) ever changes `updated` alone, leaving `created`
   untouched.
4a. **Only when `SCOPE: project` and `NEW_PROJECT_META=true`** (Step 3b found
   no existing project matched this repo's identity): also write
   `~/.vb-wiki/projects/<PROJECT_KEY>/meta.md` (parent directory already
   created by step 2 above), with the verbatim structure of
   `assets/meta-template.md`, filled in with `NOW`, `CURRENT_GITHUB_REPO`,
   and `CURRENT_LINEAR_PROJECT_ID` from Step 3b:

   ```markdown
   ---
   github_repo: <CURRENT_GITHUB_REPO, or empty string if no origin remote>
   linear_project_id: <CURRENT_LINEAR_PROJECT_ID, or empty string if unset>
   created: <NOW>
   updated: <NOW>
   ---

   # <PROJECT_KEY> — project meta
   ...
   ```

   This is what lets a *future* renamed/relocated clone of this same repo
   match back to `PROJECT_KEY` instead of forking a new directory (`AC-11`).
   When `NEW_PROJECT_META=false`, skip this step entirely — do not rewrite,
   touch `updated` on, or otherwise modify an existing `meta.md`; updating an
   existing project's `meta.md` is out of scope for this write engine.
4. Append exactly one line to `~/.vb-wiki/index.md` — **never** rewrite or
   reorder existing lines, only append:

   ```
   - [[<PAGE_SLUG>]] — scope: <SCOPE> — <SUMMARY>
   ```

5. Append exactly one entry to `~/.vb-wiki/log.md` — **never** rewrite or
   reorder existing entries, only append:

   ```
   - <TS> — [[<PAGE_SLUG>]] — <SCOPE> — <REASON>
   ```

6. Stage **exactly** the touched files — the new page, `index.md`, `log.md`,
   and (only when step 4a ran) the new project's `meta.md` — never
   `git add -A` / `git add .`, to guarantee the commit contains only this
   write's changes:

   ```bash
   git -C ~/.vb-wiki add "<path-relative-to-~/.vb-wiki>" index.md log.md
   # only if step 4a ran this write:
   git -C ~/.vb-wiki add "projects/<PROJECT_KEY>/meta.md"
   git -C ~/.vb-wiki commit -m "docs(wiki): add <PAGE_SLUG>" >/dev/null
   ```

7. Verify the result before reporting success:

   ```bash
   git -C ~/.vb-wiki status --porcelain   # -> must be empty
   ```

   If it is not empty, something outside this step's files changed — stop
   and investigate rather than committing further.

This produces exactly one new commit (append-only page + append-only
`index.md`/`log.md` edits, plus a new `meta.md` on a project's first-ever
write) on a clean working tree, satisfying `AC-4`, `AC-7`, `AC-8`, and `AC-9`
(and, together with Step 3's routing decision, `AC-5`/`AC-6`/`AC-11`).

#### Update-path

Runs instead of the create-path above whenever Step 2 found an existing page
`P` matching the topic (`AC-14`). Never creates a new page file — `TARGET_PATH`
for this path is simply `P`'s existing, already-resolved path; Step 3
(routing) does not run.

**Inputs this path assumes**: `P` (the matched page's absolute path, from
Step 2), the new distilled `BODY` to append (must contain **at least one**
`[[double-link]]`, same requirement as the create-path — it may link back to
`P` itself only if it also links to at least one *other* related page; a
link purely to the page it is being appended to does not, by itself, satisfy
the double-link convention), and a one-line `SUMMARY`/`REASON` for
`index.md`/`log.md` describing what was added.

**Sequence:**

1. Compute `NOW`/`TS` exactly as in the create-path, step 1.
2. Edit `P` in place, **in-place editing only the `updated:` line** of its
   existing frontmatter to `updated: <NOW>` — leave every other frontmatter
   field, including `created`, byte-for-byte untouched (`AC-14`).
3. Append the new distilled content to the end of `P`'s body, separated from
   existing content by a blank line so it reads as a distinct increment
   rather than a silent rewrite, e.g.:

   ```markdown

   ## Update <NOW> (<SOURCES for this increment>)

   <newly distilled content, containing at least one [[double-link]]>
   ```

   Never delete, reorder, or rewrite any pre-existing line in `P`'s body —
   this path only appends.
4. Append exactly one line to `~/.vb-wiki/index.md`, noting this was an
   update rather than a new page (still append-only — never edit or remove
   the page's original `index.md` line from its first write):

   ```
   - [[<PAGE_SLUG of P>]] — updated <NOW> — scope: <SCOPE> — <SUMMARY of the appended content>
   ```

5. Append exactly one entry to `~/.vb-wiki/log.md`, explicitly noting this
   was an update to `P`, not a new page:

   ```
   - <TS> — [[<PAGE_SLUG of P>]] — <SCOPE> — updated existing page — <REASON>
   ```

6. Stage **exactly** the touched files — `P`, `index.md`, `log.md` — never
   `meta.md` (an existing project's `meta.md` is never touched by the
   update-path, same rule as the create-path) and never `git add -A`:

   ```bash
   git -C ~/.vb-wiki add "<path-relative-to-~/.vb-wiki of P>" index.md log.md
   git -C ~/.vb-wiki commit -m "docs(wiki): update <PAGE_SLUG of P>" >/dev/null
   ```

7. Verify exactly as in the create-path, step 7: `git -C ~/.vb-wiki status
   --porcelain` must be empty; if not, stop and investigate.

This produces exactly one new commit — no new page file, only modifications
to `P`/`index.md`/`log.md` — on a clean working tree: `git -C ~/.vb-wiki show
HEAD --stat` shows no added `.md` content files (`index.md`/`log.md` aside,
which are always modifications since they already exist), and `git -C
~/.vb-wiki show HEAD -- <P>` shows the `updated` field changing and new
`[[double-link]]`-bearing lines being added (`AC-14`).

### 5. Refresh vector index (qmd embed)

Run this step **only after** Step 4's step 7 (create-path or update-path,
whichever ran) has verified `git -C ~/.vb-wiki status --porcelain` is empty
following a successful commit. Never run this before the commit lands — it
must key off a change that is already committed. This step is best-effort:
it makes the just-written or just-updated page findable by vector search
(`AC-10`); it never touches the Step 4 commit, and applies identically to
both the create-path and the update-path — re-embedding is not specific to
newly-created pages.

**5a. Ensure `~/.vb-wiki` is a registered qmd collection** (idempotent —
`qmd collection add` on an already-registered path just re-indexes it, it
does not error or duplicate the collection):

```bash
npx -y @tobilu/qmd collection add ~/.vb-wiki --name vb-wiki
```

One collection named `vb-wiki` covers the **entire** `~/.vb-wiki` tree —
both global pages and every `projects/<project-key>/` subtree — because
`assets/schema-template.md`'s "Root layout" has no separate top-level split
that would need its own collection; project scoping is just a subdirectory
under the same tree. Do not create a collection per project.

**5b. Refresh embeddings for that collection only:**

```bash
npx -y @tobilu/qmd embed -c vb-wiki
```

`qmd embed` only computes vectors for content hashes that don't already have
them, so this is cheap on repeat runs — it re-embeds just the page(s) written
since the last refresh, not the whole wiki. `-c vb-wiki` scopes the refresh
to this collection so it never touches other collections a user may have
registered for unrelated notes.

**5c. Failure handling.** If either command exits non-zero or hangs/times
out, log/report the failure to the caller (e.g. "qmd embed refresh failed,
page committed but not yet vector-searchable — re-run `qmd embed -c
vb-wiki` manually") and stop this step. Do **not**:

- retry indefinitely,
- roll back, amend, or revert the Step 4 commit,
- fail the overall distillation — the wiki write already succeeded and is
  durable; a missed embed refresh only delays vector search recall for this
  page, it does not lose data (`qmd embed` is idempotent and can be re-run
  later, including by an unrelated future invocation of this step).

**5d. Verification** (what a caller or tester can run to confirm `AC-10`):

```bash
npx -y @tobilu/qmd vsearch "<topic words from the new page>" -c vb-wiki
```

The new page's `qmd://vb-wiki/<path>.md` should appear in the results. (The
same check can be done via the `qmd` MCP server's structured `query` tool
using a `vec:` line instead of the CLI — either satisfies `AC-10`'s
verification.)

### 6. Suggest a skill (read-only gate)

Run this step *after* Step 4's step 7 (create-path or update-path) has
verified a clean tree following a landed commit. It may run before, after,
or in parallel with Step 5 — the two are independent post-write checks and
neither depends on the other's outcome. This step is **read-only with
respect to `~/.vb-wiki`** — the wiki write already happened in Step 4/5;
this step never writes, edits, or touches any file under `~/.vb-wiki` (nor
`~/.vb-skills`, unless the user confirms — see 6d).

**6a. Trigger condition.** Only trigger when the page just written or
updated in Step 4 describes a reusable **operational procedure** — a
repeatable sequence of
concrete actions with a clear trigger condition ("when X happens, do steps
1..N") — as opposed to a standalone fact, gotcha, convention, or decision
record that is knowledge but not a procedure. This is a judgment call, made
by reading the page's `TYPE` and `BODY` together (a `TYPE: pattern` or
`TYPE: convention` page can still qualify if its body is actually a
procedure; a `TYPE: gotcha` or `TYPE: fact` page almost never does).

Examples distinguishing the two:

- **Ask** — "Here's a 5-step way to debug a stuck `qmd embed` refresh:
  check the collection is registered, check network reachability to the
  model host, check disk space for the local vector store, re-run with
  `--verbose`, and if it still fails, delete and re-add the collection." A
  repeatable sequence with a clear trigger ("qmd embed hangs or fails") —
  worth asking about.
- **Ask** — "When a renamed/relocated repo clone shows up, resolve its
  `PROJECT_KEY` by: (1) parsing `git remote get-url origin` into an
  `owner/repo` slug, (2) reading `.vibeRig/project.yaml`'s
  `linear.project_id`, (3) scanning existing `projects/*/meta.md` for either
  field, (4) reusing the match if found." A concrete, ordered, reusable
  procedure — worth asking about.
- **Do NOT ask** — "`npx` can hit a registry timeout on first run." A bare
  fact/gotcha with no procedure attached — just a note.
- **Do NOT ask** — "VibeRig stores milestone/issue state exclusively in
  Linear, never in a local markdown copy." A decision/convention record, not
  a sequence of actions to follow — just a note.

When uncertain whether the body is "a procedure" or "just a note", default
to **not** triggering — Step 6 firing on every write would make the gate
noise instead of signal; only ask when the page reads like a checklist or
runbook someone would want to invoke by name later.

**6b. When triggered, ask the user once**, presenting:

- A proposed skill name matching `vb-learn`'s naming convention
  `^[a-z0-9][a-z0-9-]*$` (derive it from the page's `PAGE_SLUG` or `TITLE`,
  kebab-cased).
- A one-line **When** — the trigger condition under which this skill would
  fire (mirrors what `vb-learn` Step 3 asks candidates to state).
- An explicit yes/no question, e.g.:

  > This page describes a reusable procedure. Want me to turn it into a
  > skill? Proposed name: `<proposed-skill-name>`. When: "<one-line trigger
  > condition>". Create it? (yes/no)

Ask this **once** per page write — do not re-prompt if the user doesn't
answer affirmatively the first time (see 6c).

**6c. Decline path.** If the user answers no, or gives any non-affirmative
response, or does not respond: **stop immediately.**

- Do not touch `~/.vb-skills/` in any way.
- Do not touch `vb-skill-lock.json` in any way.
- Do not invoke `vb-learn` or any part of its skill-creation machinery.
- The wiki write from Step 4/5 already happened and stands regardless of
  this answer — declining a skill never undoes or affects the wiki write.

**6d. Accept path.** If the user answers yes: hand off to `vb-learn`'s
existing skill-creation workflow — do not duplicate its Step 3 (skill
planning) or Step 4 (write each skill via `skill-builder` + lock update)
logic here. Pass it the proposed skill name and When condition from 6b as
the starting candidate (see `skills/vb-learn/SKILL.md` Step 3 "Skill
planning — decide what to learn" and Step 4 "Write each skill"). `vb-learn`
owns everything downstream of a "yes" — its own lock update, validation, and
commit sequence (`skills/vb-learn/SKILL.md` Step 5 "Validate and commit")
apply unchanged; Step 6 here does not re-implement or shortcut any of it.

**Implemented since the previous version**: `JSO-275` (dedup-before-write) —
Step 2 now checks, before any routing or write happens, whether an existing
page already covers the same topic (via qmd `vsearch` against the `vb-wiki`
collection and/or an `index.md` scan). When no match is found, the
create-path (Step 3 routing → Step 4's create-path) runs unchanged. When a
match `P` is found, Step 4's update-path runs instead: `P`'s `updated`
field is bumped, new double-linked content is appended to `P`'s body, no
new page file is created, and `index.md`/`log.md` note the update rather
than a new page. See Step 2 and Step 4's "Update-path" above.

**This is the last issue in milestone M1 (req-0001).** Every step this
skill needs — bootstrap (Step 1), dedup (Step 2), routing (Step 3), write/
update (Step 4), qmd embed refresh (Step 5), and the skill-suggestion gate
(Step 6) — is implemented. There are no remaining extension points or
handoff notes for a later `vb-wiki` issue; this file is feature-complete for
milestone M1.

## Validation

```bash
git -C ~/.vb-wiki rev-parse --is-inside-work-tree   # -> true
ls ~/.vb-wiki                                        # -> AGENTS.md index.md log.md ...
git -C ~/.vb-wiki status --porcelain                 # -> empty (clean tree) after bootstrap
```

- [ ] `~/.vb-wiki` is a git repository.
- [ ] `~/.vb-wiki/AGENTS.md` exists and matches `assets/schema-template.md`.
- [ ] `~/.vb-wiki/index.md` and `~/.vb-wiki/log.md` exist.
- [ ] Re-running the bootstrap step on an already-initialized `~/.vb-wiki`
      makes no changes (`git status --porcelain` stays empty, no new commit).
- [ ] Bootstrap never overwrites pre-existing files under `~/.vb-wiki`.

After a Step 2 (dedup, no match) + Step 3 (routing) + Step 4 create-path
(write) sequence:

```bash
OLD=<HEAD before the write>
git -C ~/.vb-wiki status --porcelain            # -> empty
git -C ~/.vb-wiki log --oneline $OLD..HEAD      # -> exactly 1 line
awk '/^---$/{n++} n==1' <new-file>              # -> frontmatter with all 7 fields, sources non-empty
grep -cE '\[\[[^]]+\]\]' <new-file>             # -> >= 1
git -C ~/.vb-wiki show HEAD -- index.md log.md  # -> only "+" lines besides hunk headers
```

- [ ] Exactly one new commit; working tree clean afterward (`AC-4`).
- [ ] New page frontmatter has `title`/`created`/`updated`/`type`/`scope`/
      `tags`/`sources`, with `sources` a non-empty array (`AC-7`).
- [ ] New page body has at least one `[[double-link]]` (`AC-8`).
- [ ] `index.md` gained exactly one new line naming the page; `log.md`
      gained exactly one new entry; neither file lost or modified an
      existing line (`AC-9`).

Routing-specific checks:

```bash
git -C ~/.vb-wiki diff --name-only $OLD..HEAD | grep '^projects/<project-key>/'   # project scope: matches
git -C ~/.vb-wiki diff --name-only $OLD..HEAD | grep -v 'projects/'                # global scope: matches
head -20 <new-file>   # frontmatter has scope: project + matching project_key, OR scope: global with no project_key
```

- [ ] Project-scope pages land under `projects/<project-key>/`, with
      frontmatter `scope: project` and `project_key` equal to that directory
      name (`AC-5`).
- [ ] Global-scope pages land outside `projects/` entirely, with frontmatter
      `scope: global` and no `project_key` field (`AC-6`).

Project-identity-matching check (`AC-11`) — simulating a renamed/relocated
clone:

```bash
PROJECTS_BEFORE=$(ls ~/.vb-wiki/projects/ | wc -l)
# ... clone this repo to a new path, set origin remote back to the same
#     github_repo (or keep the same .vibeRig/project.yaml linear.project_id),
#     trigger a vb-wiki project-scope write from the new path ...
PROJECTS_AFTER=$(ls ~/.vb-wiki/projects/ | wc -l)
[ "$PROJECTS_BEFORE" = "$PROJECTS_AFTER" ]   # -> true, no new project directory
```

- [ ] `ls ~/.vb-wiki/projects/` has the same directory count before and
      after the renamed/relocated-clone write (no new `projects/<key>/`
      directory created).
- [ ] The write's `TARGET_PATH` and page frontmatter's `project_key` both
      resolve to the **original** `PROJECT_KEY`, not a freshly-derived name
      from the new clone's `.vibeRig/project.yaml` `project.name` (`AC-11`).

After a Step 5 (qmd embed refresh) run:

```bash
npx -y @tobilu/qmd vsearch "<topic words from the new page>" -c vb-wiki
```

- [ ] The new page's `qmd://vb-wiki/<path>.md` appears in the `vsearch`
      results (`AC-10`).
- [ ] A deliberately-forced `qmd embed` failure (e.g. an unreachable model
      download) is reported/logged, and the Step 4 commit made just before
      it is untouched (`git -C ~/.vb-wiki log -1` still shows that commit,
      `git status --porcelain` still empty).

Dedup / update-path check (`AC-14`) — writing an initial page `P` on topic
`X` (Step 2 no-match + Step 3 + Step 4 create-path), then distilling a
second piece of knowledge on the **same** topic `X` and re-running Step 2:

```bash
OLD=<HEAD after P's initial write>
git -C ~/.vb-wiki show HEAD --stat    # after the SECOND (same-topic) distillation
git -C ~/.vb-wiki show HEAD -- <P>
```

- [ ] Step 2's dedup search (qmd `vsearch` and/or `index.md` scan) finds `P`
      as a high-confidence same-topic match for the second distillation.
- [ ] No new page file is created — `git show HEAD --stat` for the second
      distillation's commit shows no added `.md` content file; only `P`,
      `index.md`, and `log.md` are modified (`AC-14`).
- [ ] `P`'s frontmatter `updated` field changed to the second distillation's
      date, while `created` is byte-identical to before (`AC-14`).
- [ ] `P`'s diff contains newly-added lines with at least one
      `[[double-link]]` (`AC-14`).
- [ ] `log.md`'s new entry names `P` and states this was an update, not a
      new page.
- [ ] Exactly one new commit for the second distillation; working tree clean
      afterward — same commit discipline as the create-path.

Skill-suggestion gate check (`AC-15`) — writing a page whose body is a
reusable operational procedure, then declining Step 6's question:

```bash
ls -R ~/.vb-skills > /tmp/before.txt 2>&1
shasum ~/.vb-skills/vb-skill-lock.json > /tmp/before-lock.txt 2>&1
# ... trigger a vb-wiki distillation whose content is a reusable procedure,
#     answer "no" to Step 6's skill-creation question ...
ls -R ~/.vb-skills > /tmp/after.txt 2>&1
shasum ~/.vb-skills/vb-skill-lock.json > /tmp/after-lock.txt 2>&1
diff /tmp/before.txt /tmp/after.txt        # -> no output (identical)
diff /tmp/before-lock.txt /tmp/after-lock.txt   # -> no output (identical)
```

- [ ] The session transcript contains exactly one question presenting a
      proposed skill name and a one-line When trigger condition (`AC-15`).
- [ ] After a "no" answer, `ls -R ~/.vb-skills` and
      `shasum ~/.vb-skills/vb-skill-lock.json` are byte-identical to their
      pre-question state (`AC-15`).

## Hard Rules

- Bootstrap (Step 1) write target is `~/.vb-wiki/` root only — `AGENTS.md`,
  `index.md`, `log.md`, and the repo's `.git/`. No other paths.
- Never re-run `git init` or recreate the root files if `~/.vb-wiki` is
  already a git repository — bootstrap is a no-op in that case.
- Never overwrite an existing `AGENTS.md` / `index.md` / `log.md` — only
  create files that are missing.
- Step 2 (dedup) must run before Step 3 (routing) or Step 4 (write) for
  every distillation — never skip straight to "write a new page" without
  first checking for a same-topic existing page (`AC-14`).
- Step 2's "same topic" judgment is a semantic heuristic, not exact-string
  matching. When uncertain whether a candidate page is the same topic,
  default to **not** matching (i.e. proceed to create a new page) — a false
  positive corrupts an existing page, a false negative just costs one extra
  page.
- Step 2 never writes, edits, `mkdir`s, or touches git — it only searches
  (`qmd vsearch` and/or an `index.md` scan) and decides create-path vs.
  update-path. All actual writes happen in Step 4.
- Step 3 (routing) only runs when Step 2 found no matching page, and only
  computes `TARGET_PATH`/`SCOPE`/`PROJECT_KEY`/`NEW_PROJECT_META` — it never
  writes files, never runs `mkdir`, and never touches git. All actual writes
  happen in Step 4.
- Global-scope `TARGET_PATH` values must never contain a `projects/`
  segment; project-scope `TARGET_PATH` values must always be under
  `projects/<PROJECT_KEY>/`, with `PROJECT_KEY` matching the directory name
  exactly (`AC-5`/`AC-6`).
- Step 3b must always scan existing `projects/*/meta.md` for an identity
  match (`github_repo` OR `linear_project_id`) **before** deriving/using
  `CANDIDATE_KEY` — never skip the scan and never create a second
  `projects/<key>/` directory for a repo whose identity already matches an
  existing `meta.md` (`AC-11`). Matching on either field alone is
  sufficient; both fields do not need to match.
- Step 4's create-path (page write) touches exactly three files per
  invocation — the one new page file, `index.md`, and `log.md` — or exactly
  four when Step 3b set `NEW_PROJECT_META=true` (adds
  `projects/<PROJECT_KEY>/meta.md`). Never `git add -A`/`git add .`; always
  stage those paths explicitly.
- Step 4's create-path must never write or modify `meta.md` when
  `NEW_PROJECT_META=false` — an existing project's `meta.md` is immutable to
  this write engine (both paths).
- Step 4 only **appends** to `index.md`/`log.md` in either path — never
  edit, reorder, or delete an existing line/entry in either file.
- Step 4's create-path never overwrites an existing page file — if
  `TARGET_PATH` already exists, that means Step 2 should have found the
  match and routed to the update-path instead; treat this as a bug in Step
  0's dedup and stop to investigate rather than clobbering the existing
  file.
- Step 4's update-path (`AC-14`) never creates a new page file — it edits
  only the matched page `P`'s `updated:` frontmatter field (leaving
  `created` and every other frontmatter field untouched) and appends new
  content to `P`'s body, ending with at least one `[[double-link]]` in the
  appended content. It never touches `meta.md`.
- Every Step 4 write (create-path or update-path) is exactly one git commit;
  never split a single write across multiple commits, and never leave the
  tree dirty afterward.
- `sources` must never be an empty array on the create-path — refuse to
  write a page without at least one source.
- Step 5 (qmd embed refresh) must never run before Step 4's step 7 has
  confirmed a clean tree — it only ever follows a landed commit, from either
  path.
- Step 5 is best-effort: a failed `qmd collection add` / `qmd embed` must be
  logged/reported, never retried indefinitely, and must never roll back,
  amend, or revert the Step 4 commit.
- Step 5 uses exactly one qmd collection (`vb-wiki`) covering all of
  `~/.vb-wiki` — never create a separate collection per project or per
  scope.
- Step 6 (skill-suggestion gate) only triggers for pages describing a
  reusable operational procedure — never for plain gotchas/facts/decisions/
  conventions that carry no repeatable action sequence. When uncertain,
  default to not triggering.
- Step 6 must ask the yes/no skill-creation question **at most once** per
  distillation, and must present both a proposed skill name
  (`^[a-z0-9][a-z0-9-]*$`) and a one-line When condition in that question.
- On a "no" (or non-affirmative/no-response) answer, Step 6 must stop
  immediately: zero writes to `~/.vb-skills/`, zero changes to
  `vb-skill-lock.json`, and no invocation of `vb-learn`'s skill-creation
  machinery. The Step 4/5 wiki write is unaffected either way.
- On a "yes" answer, Step 6 must hand off to `vb-learn`'s existing
  skill-creation workflow rather than duplicating its planning/write/lock/
  commit logic here.
- Step 6 never writes, edits, or deletes anything under `~/.vb-wiki` — it is
  read-only with respect to the wiki; the write already happened in
  Step 4/5.
