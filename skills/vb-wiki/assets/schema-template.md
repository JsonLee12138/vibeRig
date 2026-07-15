# ~/.vb-wiki — LLM Wiki Schema

This repository is a git-backed **llm-wiki** style knowledge base, distilled by
VibeRig agents from completed Linear work. It is read and written by agents,
not by hand. This file is the schema/convention reference — read it before
writing or querying any page. Do not delete or hand-edit this file casually;
later `vb-wiki` tooling versions this file's content.

Method references: NousResearch hermes-agent `llm-wiki` skill, Karpathy's LLM
Wiki gist. Knowledge is compiled once and accumulates over time — like a
running notebook / mistake log, not a one-shot report.

## Root layout

```
~/.vb-wiki/
├── AGENTS.md              (this file — schema, read-only reference)
├── index.md                (flat page index, append-only)
├── log.md                  (change log, append-only, one entry per distillation)
├── <topic>/...              (global knowledge, organized by topic/type)
└── projects/
    └── <project-key>/
        ├── meta.md          (project identity: github repo id, linear_project_id, base architecture)
        └── <topic>/...      (project-specific knowledge)
```

- **Global knowledge** (cross-project: tool usage, language/framework gotchas,
  general patterns) lives directly under `~/.vb-wiki/`, organized into
  topic/type directories.
- **Project knowledge** (this-project-only: gotchas, conventions, architecture
  decisions) lives under `~/.vb-wiki/projects/<project-key>/`.
- `<project-key>` identity is resolved by matching the current repo's GitHub
  repo id **or** `.vibeRig/project.yaml`'s `linear.project_id` against each
  project directory's `meta.md` — either match means "same project" (renames
  / directory moves do not orphan the knowledge). Creating `meta.md` and the
  project-uniqueness check are implemented by a later `vb-wiki` issue, not by
  this bootstrap step.

## Page frontmatter

Every content page (anything other than `AGENTS.md`, `index.md`, `log.md`,
and `meta.md`) requires this YAML frontmatter:

```yaml
---
title: <string>
created: <ISO 8601 date>
updated: <ISO 8601 date>
type: <string>        # e.g. gotcha, convention, pattern, decision, fact
scope: global | project
tags: [<string>, ...]
sources: [<string>, ...]   # at least 1 — Linear issue key, commit hash, PR URL, etc.
---
```

When `scope: project`, also include `project_key: <project-key>` matching the
containing `projects/<project-key>/` directory name.

## Double-links

Reference related pages inline with `[[page-slug]]` (the page's filename
without the `.md` extension, no path). Every distilled page should link to at
least one related page where a real relationship exists — this is what turns
the store into a navigable knowledge network rather than a flat pile of
notes. Do not invent links to pages that do not exist.

## index.md discipline

`index.md` is a flat, append-only index of every page in the wiki. Each
distillation appends one line for each new page it creates; existing lines
are never edited or removed by normal writes. Suggested line format:

```
- [[page-slug]] — scope: global|project — one-line summary
```

## log.md discipline

`log.md` is an append-only change log. Each distillation appends exactly one
entry describing what was written and why; existing entries are never edited
or removed. Suggested line format:

```
- <ISO 8601 timestamp> — [[page-slug]] — global|project — <one-line reason / source>
```

## git discipline

`~/.vb-wiki/` is one git repository for the whole store (global + all
projects). Every distillation results in exactly one commit that leaves the
working tree clean — no partial or uncommitted writes.
