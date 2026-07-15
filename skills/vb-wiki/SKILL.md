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

**Status of this skill**: this version implements only the **repo bootstrap**
step (Step 1 below) — creating and idempotently verifying `~/.vb-wiki` as a
git repo with its root schema/index/log files. The page-writing engine,
global/project routing, project-uniqueness resolution, qmd embed refresh,
dedup-before-write, and the skill-creation suggestion gate are implemented by
later `vb-wiki` work and are **not yet present** in this file. Do not treat
the absence of those steps as a bug in this version — extend this file when
that work lands, rather than duplicating the bootstrap logic elsewhere.

## When

### Invoke

| Caller | Condition |
|---|---|
| `accept-issue` | issue 验收通过、状态置终态之后 — 传 issue key（分工同 `vb-learn`：由后续 issue 接线） |
| `accept-milestone` | 里程碑验收通过之后 — 传里程碑 id（分工同 `vb-learn`：由后续 issue 接线） |
| User (manual) | "vb-wiki VB-42", "沉淀到 wiki", "记到 vb-wiki", "更新知识库" |

### Do NOT invoke

- Only the bootstrap step (Step 1) is implemented — do not attempt the
  page-writing workflow described as "future work" above; that lands in
  later issues.

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

### 2. Distil and write pages

Not implemented in this version — see "Status of this skill" above.

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

## Hard Rules

- Write target for this step is `~/.vb-wiki/` root only — `AGENTS.md`,
  `index.md`, `log.md`, and the repo's `.git/`. No other paths.
- Never re-run `git init` or recreate the root files if `~/.vb-wiki` is
  already a git repository — bootstrap is a no-op in that case.
- Never overwrite an existing `AGENTS.md` / `index.md` / `log.md` — only
  create files that are missing.
- Do not implement page-writing, routing, qmd refresh, or the skill-creation
  gate here — those belong to later `vb-wiki` issues.
