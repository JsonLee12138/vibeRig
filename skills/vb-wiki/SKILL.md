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
(Step 1) and the **core single-page write engine** (Step 2 below) — given an
already-resolved target path, title, body, and sources, it writes one
frontmatter'd page, appends to `index.md`/`log.md`, and produces exactly one
commit on a clean tree. Step 2 as implemented here does **not** decide
*where* a page belongs (global vs `projects/<project-key>/` routing —
JSON-RPC-key-safe rendering aside, that's `AC-5`/`AC-6`'s job), does **not**
refresh qmd embeddings after the commit (`AC-10`), does **not** check for an
existing page to update instead of creating a new one (`AC-14`), and does
**not** prompt about creating a reusable skill (`AC-15`). Those are
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

- Steps 1–2 (bootstrap + core page write) are implemented. Do not attempt
  global/project routing decisions, qmd embed refresh, dedup-before-write, or
  the skill-creation gate here — those are "future work" (see "Status of
  this skill" above) and land in later issues. Callers of Step 2 must already
  have decided the target file path (including whether it lives under
  `projects/<project-key>/`) and must already have decided this is a new
  page, not an update to an existing one.

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

### 2. Write a page (core write engine)

**Inputs this step assumes the caller already resolved** (routing/dedup are
out of scope here — see "Status of this skill"):

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
`AC-7`, `AC-8`, and `AC-9`.

**Handoff notes for later issues** (extension points, not yet implemented):

- **JSO-270 (global/project routing)**: should run *before* this step and
  produce `TARGET_PATH`/`SCOPE`/`PROJECT_KEY` as described above. This step
  does not inspect `.vibeRig/project.yaml` or any project identity — it only
  writes to whatever path it's given.
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

After a Step 2 write:

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

## Hard Rules

- Bootstrap (Step 1) write target is `~/.vb-wiki/` root only — `AGENTS.md`,
  `index.md`, `log.md`, and the repo's `.git/`. No other paths.
- Never re-run `git init` or recreate the root files if `~/.vb-wiki` is
  already a git repository — bootstrap is a no-op in that case.
- Never overwrite an existing `AGENTS.md` / `index.md` / `log.md` — only
  create files that are missing.
- Step 2 (page write) touches exactly three files per invocation: the one
  new page file, `index.md`, and `log.md`. Never `git add -A`/`git add .`;
  always stage those three paths explicitly.
- Step 2 only **appends** to `index.md`/`log.md` — never edit, reorder, or
  delete an existing line/entry in either file.
- Step 2 never overwrites an existing page file — if `TARGET_PATH` already
  exists, that means the caller's dedup step (out of scope here, see
  `AC-14`/JSO-275) should have routed to an update instead; stop and
  investigate rather than clobbering it.
- Every Step 2 write is exactly one git commit; never split a single page
  write across multiple commits, and never leave the tree dirty afterward.
- `sources` must never be an empty array — refuse to write a page without at
  least one source.
- Do not implement global/project routing, qmd embed refresh, dedup-before-
  write, or the skill-creation gate here — those belong to later `vb-wiki`
  issues (JSO-270, JSO-271, JSO-275, JSO-273 respectively).
