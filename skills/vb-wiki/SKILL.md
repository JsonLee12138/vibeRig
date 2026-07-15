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

**Status of this skill**: this version implements the **repo bootstrap**
(Step 1), **global/project routing** (Step 2 below, `JSO-270`), and the
**core single-page write engine** (Step 3 below) — given a Linear key and
distilled content, it classifies the content as `scope: global` or
`scope: project`, resolves `TARGET_PATH`/`PROJECT_KEY`, then writes one
frontmatter'd page, appends to `index.md`/`log.md`, and produces exactly one
commit on a clean tree, satisfying `AC-5`/`AC-6` in addition to `AC-4`,
`AC-7`, `AC-8`, `AC-9`. This version does **not** refresh qmd embeddings
after the commit (`AC-10`), does **not** check for an existing page to
update instead of creating a new one (`AC-14`), and does **not** prompt
about creating a reusable skill (`AC-15`). Step 2's `PROJECT_KEY`
derivation is also a deliberate placeholder (see Step 2b) that `JSO-272`
will replace with proper cross-path project identity matching. Those are
implemented by later `vb-wiki` work (see "Handoff notes for later issues"
below) and are **not yet present** in this file. Do not treat the absence of
those steps as a bug in this version — extend this file when that work
lands, rather than duplicating the write-engine logic elsewhere.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept-issue` | issue 验收通过、状态置终态之后 — 传 issue key（分工同 `vb-learn`：由后续 issue 接线） |
| `accept-milestone` | 里程碑验收通过之后 — 传里程碑 id（分工同 `vb-learn`：由后续 issue 接线） |
| User (manual) | "vb-wiki VB-42", "沉淀到 wiki", "记到 vb-wiki", "更新知识库" |

### Do NOT invoke

- Steps 1–3 (bootstrap + routing + core page write) are implemented. Do not
  attempt qmd embed refresh, dedup-before-write, or the skill-creation gate
  here — those are "future work" (see "Status of this skill" above) and land
  in later issues. Callers must already have decided this is a new page, not
  an update to an existing one (dedup-before-write is `JSO-275`'s job, not
  Step 2's or Step 3's).

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

### 2. Decide scope and target path (routing)

Run after Step 1 bootstrap, before Step 3 (page write). This step turns
distilled content into the `TARGET_PATH`/`SCOPE`/`PROJECT_KEY` inputs Step 3
expects — it does not write, `mkdir`, or touch git at all; Step 3 does all of
that.

**2a. Classify scope.** Per `.vibeRig/requirements/req-0001/intake.md`
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
  - `skills/vb-wiki` Step 3 (write engine) stages exactly three files per
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

**2b. Resolve `PROJECT_KEY`** (only needed when `scope: project`):

```bash
PROJECT_KEY=$(awk -F': *' '/^project:/{p=1} p && /name:/{gsub(/"/,"",$2); print $2; exit}' .vibeRig/project.yaml)
```

This reads `project.name` from the current repo's `.vibeRig/project.yaml`
(e.g. `vb-plugin`). **This is a placeholder derivation**, not the final
design: it assumes the directory/repo name is a stable, globally-unique
project identity, with no cross-path identity matching — a renamed or
relocated clone of the same repo would resolve to a different `PROJECT_KEY`
and silently fork its knowledge into a second `projects/<key>/` directory.
`JSO-272` replaces this with matching against `meta.md`'s GitHub repo id /
`linear.project_id`, per `assets/schema-template.md`'s "Root layout"
section — do not build that matching logic here; use the simple
`project.yaml` read above until `JSO-272` lands.

**2c. Resolve `TARGET_PATH`**:

- `scope: project` →
  `~/.vb-wiki/projects/<PROJECT_KEY>/<content-type-dir>/<slug>.md`
- `scope: global` → `~/.vb-wiki/<content-type-dir>/<slug>.md` — this path
  must **not** contain a `projects/` segment anywhere.

`<content-type-dir>` is the plural of Step 3's `TYPE` input (`gotcha` →
`gotchas/`, `convention` → `conventions/`, `pattern` → `patterns/`,
`decision` → `decisions/`, `fact` → `facts/`). `<slug>` is Step 3's
`PAGE_SLUG` input (kebab-case, no `.md`).

**2d. Frontmatter obligations these choices impose on Step 3**:

- `scope: project` → Step 3's frontmatter must include `scope: project` and
  `project_key: <PROJECT_KEY>`, and `PROJECT_KEY` must equal the
  `projects/<PROJECT_KEY>/` directory segment in `TARGET_PATH` (`AC-5`).
- `scope: global` → Step 3's frontmatter must include `scope: global` and
  must **not** include a `project_key` field at all; `TARGET_PATH` must not
  contain `projects/` anywhere (`AC-6`).

**2e. Hand off** `TARGET_PATH`, `SCOPE`, and (when `scope: project`)
`PROJECT_KEY` to Step 3 unchanged — do not duplicate Step 3's write logic
here, this step only produces its inputs.

### 3. Write a page (core write engine)

**Inputs this step assumes the caller already resolved** (Step 2 above
resolves `TARGET_PATH`/`SCOPE`/`PROJECT_KEY`; dedup is out of scope here —
see "Status of this skill"):

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
   and `updated` are identical on a first write — only a later update (out
   of scope for this step; see `AC-14` handoff notes below) changes
   `updated` alone.
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

6. Stage **exactly** the three touched files (the new page, `index.md`,
   `log.md`) — never `git add -A` / `git add .`, to guarantee the commit
   contains only this write's changes:

   ```bash
   git -C ~/.vb-wiki add "<path-relative-to-~/.vb-wiki>" index.md log.md
   git -C ~/.vb-wiki commit -m "docs(wiki): add <PAGE_SLUG>" >/dev/null
   ```

7. Verify the result before reporting success:

   ```bash
   git -C ~/.vb-wiki status --porcelain   # -> must be empty
   ```

   If it is not empty, something outside this step's three files changed —
   stop and investigate rather than committing further.

This produces exactly one new commit (append-only page + append-only
`index.md`/`log.md` edits) on a clean working tree, satisfying `AC-4`,
`AC-7`, `AC-8`, and `AC-9` (and, together with Step 2's routing decision,
`AC-5`/`AC-6`).

**Handoff notes for later issues** (extension points, not yet implemented):

- **JSO-272 (project-uniqueness cross-path matching)**: should replace Step
  2b's placeholder `PROJECT_KEY` derivation (`.vibeRig/project.yaml`'s
  `project.name`, read verbatim as the key) with identity matching against
  each `projects/<project-key>/meta.md` (GitHub repo id and/or
  `linear.project_id`), per `assets/schema-template.md`'s "Root layout"
  section, so a renamed or relocated clone of the same repo still resolves
  to the same `PROJECT_KEY` instead of forking a new `projects/` directory.
  Step 2b is the single place this later change needs to touch.
- **JSO-271 (qmd embed refresh)**: should run *after* step 7 succeeds
  (commit landed, tree clean), keyed off `TARGET_PATH`/`PAGE_SLUG`, so a
  failed embed refresh never blocks or partially-undoes the commit produced
  here.
- **JSO-273 (skill-creation gate)**: should run *after* step 7, inspecting
  `BODY`/`TYPE` for a reusable operational pattern; it is a read-only
  suggestion prompt and must not touch `~/.vb-wiki` itself.
- **JSO-275 (dedup-before-write)**: should run *before* step 1, replacing
  "write a new page" with "update existing page `P`'s `updated` field and
  append new content (with a double-link) to `P`" whenever an existing page
  already covers the topic — i.e. it decides whether to invoke this step's
  create-path at all, or instead perform an update-path that this step does
  not implement.

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

After a Step 2 (routing) + Step 3 (write) sequence:

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

## Hard Rules

- Bootstrap (Step 1) write target is `~/.vb-wiki/` root only — `AGENTS.md`,
  `index.md`, `log.md`, and the repo's `.git/`. No other paths.
- Never re-run `git init` or recreate the root files if `~/.vb-wiki` is
  already a git repository — bootstrap is a no-op in that case.
- Never overwrite an existing `AGENTS.md` / `index.md` / `log.md` — only
  create files that are missing.
- Step 2 (routing) only computes `TARGET_PATH`/`SCOPE`/`PROJECT_KEY` — it
  never writes files, never runs `mkdir`, and never touches git. All actual
  writes happen in Step 3.
- Global-scope `TARGET_PATH` values must never contain a `projects/`
  segment; project-scope `TARGET_PATH` values must always be under
  `projects/<PROJECT_KEY>/`, with `PROJECT_KEY` matching the directory name
  exactly (`AC-5`/`AC-6`).
- Step 2b's `PROJECT_KEY` derivation (reading `.vibeRig/project.yaml`'s
  `project.name`) is a known placeholder pending `JSO-272` — do not build
  cross-path project identity matching (`meta.md`, GitHub repo id,
  `linear.project_id`) here.
- Step 3 (page write) touches exactly three files per invocation: the one
  new page file, `index.md`, and `log.md`. Never `git add -A`/`git add .`;
  always stage those three paths explicitly.
- Step 3 only **appends** to `index.md`/`log.md` — never edit, reorder, or
  delete an existing line/entry in either file.
- Step 3 never overwrites an existing page file — if `TARGET_PATH` already
  exists, that means the caller's dedup step (out of scope here, see
  `AC-14`/JSO-275) should have routed to an update instead; stop and
  investigate rather than clobbering it.
- Every Step 3 write is exactly one git commit; never split a single page
  write across multiple commits, and never leave the tree dirty afterward.
- `sources` must never be an empty array — refuse to write a page without at
  least one source.
- Do not implement qmd embed refresh, dedup-before-write, or the
  skill-creation gate here — those belong to later `vb-wiki` issues
  (`JSO-271`, `JSO-275`, `JSO-273` respectively).
