# ~/.vb-wiki — LLM Wiki Schema

This repository is a git-backed **llm-wiki** style knowledge base, distilled
by VibeRig agents from completed work. It is read and written by agents, not
by hand (hand edits are allowed but get absorbed into the next agent commit).
This file is the schema/convention reference — read it before writing or
querying any page. The only routine agent edit to this file is appending to
the taxonomy table below.

Method references: NousResearch hermes-agent `llm-wiki` skill, Karpathy's LLM
Wiki gist, TIL-style tech-directory layout. Knowledge is compiled once and
accumulates over time — like a running notebook / mistake log (错题集), not
a one-shot report.

## Root layout

```
~/.vb-wiki/
├── AGENTS.md              (this file — schema + taxonomy)
├── index.md                (flat page index, append-only)
├── log.md                  (change log, append-only, one entry per touched page)
├── <tech-dir>/...          (global knowledge, organized by technology/stack)
└── projects/
    └── <project-key>/
        ├── meta.md          (project identity: github repo slug, linear_project_id, base architecture)
        └── <tech-dir>/...   (project-specific knowledge, same taxonomy)
```

- **Global knowledge** (cross-project: tool usage, language/framework gotchas,
  general patterns) lives directly under `~/.vb-wiki/`.
- **Project knowledge** (this-project-only: repo conventions, architecture
  decisions, project gotchas) lives under `~/.vb-wiki/projects/<project-key>/`.
- `<project-key>` identity is resolved by matching the current repo's GitHub
  repo slug **or** `.vibeRig/project.yaml`'s `linear.project_id` against each
  project directory's `meta.md` — either match means "same project" (renames
  / directory moves do not orphan the knowledge).

## Directory taxonomy (`<tech-dir>`)

The directory axis is the **technology stack**, TIL style — so a reader
querying Go knowledge never wades through frontend notes. The page *type*
(gotcha/pattern/…) is frontmatter only and never determines the path.

Rules: reuse an existing directory whenever one fits; different
language/runtime → different directory, always; cross-language knowledge →
`architecture/` (or a platform directory); a genuinely new technology gets a
new directory **registered here in the same commit**.

| tech-dir | covers |
|---|---|
| `architecture/` | cross-language system design, module boundaries, contracts |
| `go/` | Go language, go-zero, goctl, Go tooling |
| `typescript/` | TS/JS language, Node, build tooling (tsdown, Vite, …) |
| `monorepo/` | pnpm/Turborepo/go.work workspace layout and migration |
| `uni-weapp/` | uni-app, WeChat mini-program, cloud functions |
| `casdoor/` | Casdoor SSO / management API / JWT boundaries |
| `lago/` | Lago billing, wallets, events |
| `cloudbase/` | Tencent CloudBase models, NoSQL, functions |
| `postgres/` | Postgres, Drizzle/Payload migrations |
| `node-tooling/` | npx, MCP servers, CLI process/env behavior |

(Agents: append new rows here — never rewrite existing ones.)

## Page frontmatter

Every content page (anything other than `AGENTS.md`, `index.md`, `log.md`,
and `meta.md`) requires this YAML frontmatter:

```yaml
---
title: <string, in the wiki output language>
created: <ISO 8601 date>
updated: <ISO 8601 date>
type: gotcha | pattern | decision | convention | fact
scope: global | project
tags: [<string>, ...]
sources: [<string>, ...]   # at least 1, structured: linear:<KEY> | commit:<hash> | pr:<url> | file:<path>
# optional typed relations (lists of [[slug]]), only when they truly hold:
# caused_by: [...]
# fixed_by: [...]
# supersedes: [...]
# superseded_by: [...]     # set on a page whose content moved elsewhere; its body is then a pure MOC
---
```

When `scope: project`, also include `project_key: <project-key>` matching the
containing `projects/<project-key>/` directory name.

## Language

Page titles, bodies, index summaries, and log reasons are written in the
wiki output language resolved at write time (from the writing project's
`.vibeRig/project.yaml` `output.language`, falling back to the user's
working language). Never translated: slugs/filenames (kebab-case English),
frontmatter keys, `type`/`scope` enum values, `tags`, code/commands/error
text, Linear keys, commit hashes, paths, URLs. A page keeps the language it
was created in; updates append in that same language.

## Gotcha pages (错题集)

`type: gotcha` pages are the mistake log and must contain three sections:
**现象** (the symptom as observed), **错因** (root cause), **自检清单**
(checklist to prevent recurrence). Gotchas live in their technology's
directory, not in a central pile — cross-cut them via the index's `type`
column or `grep 'type: gotcha'`.

## Double-links

Reference related pages inline with `[[page-slug]]` (the page's filename
without the `.md` extension, no path). Pages distilled from the same event
must link each other — that preserves the thought chain. Link older pages
only where a real relationship exists; **never invent a link to a page that
does not exist** — zero links is correct when nothing related exists yet.

## index.md discipline

`index.md` is a flat, append-only index of every page in the wiki. Each
distillation appends **one line per page it touched** (created, updated, or
superseded); existing lines are never edited or removed by the agent —
corrections are new appended lines. Line format:

```
- [[page-slug]] — scope: global|project — dir: <tech-dir> — type: <type> — one-line summary
```

## log.md discipline

`log.md` is the append-only change log — the episodic record. Each
distillation appends **one entry per page it touched**; existing entries are
never edited or removed by the agent. Line format:

```
- <ISO 8601 timestamp> — [[page-slug]] — global|project — <one-line reason / source>
```

## git discipline

`~/.vb-wiki/` is one git repository for the whole store (global + all
projects). Every distillation event results in exactly one commit that
leaves the working tree clean. Pre-existing uncommitted changes (e.g. valid
manual edits) are absorbed into that commit — staged with everything else
and named in the commit message — never discarded and never left dangling.
