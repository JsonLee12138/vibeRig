---
name: vb-wiki
description: Query, write, lint, and consolidate VibeRig’s git-backed ~/.vb-wiki long-term project knowledge. Use for explicit knowledge questions, accepted vb-insights novel/conflict handoffs, manual sourced notes, staleness checks, or wiki maintenance. Plane is never the knowledge store.
---

# VB Wiki

Maintain one sourced, deduplicated, git-backed knowledge base. Treat accepted evidence as immutable
source material and canonical wiki pages as the current synthesis.

## Authority

- Query and lint are read-only.
- Automatic project knowledge writes require human-accepted evidence and a `vb-insights` result of
  `novel` or `conflict`.
- A manual write requires an explicit user request and sourced facts from the current conversation.
- Only the parent delivery lead may write. Subagents return candidate ledgers.
- Never write knowledge to Plane Pages, Work Item comments, agent memory, or the source repository.

## Store

Use `~/.vb-wiki` with a git repository, a current `index.md`, append-only `log.md`, and canonical
pages split into global and project scopes. Resolve project identity from `.pi/viberig.yaml`, the
repository root, and stable git remote identity when present. Never store Plane API keys or other
secrets.

## Query

1. Resolve the requested project, technology, version, and task intent.
2. Search the current catalog and canonical pages with qmd when available; otherwise use bounded
   repository search.
3. Read full candidate pages before answering.
4. Check applicability, exclusions, status, provenance, and invalidation signals.
5. Cite page paths and source evidence. Report a knowledge gap instead of inventing an answer.

## Write

1. Prove authority, accepted revision, and the exact `vb-insights` candidate ledger.
2. Reject unsupported statements, task timelines, changed-file summaries, and duplicated knowledge.
3. Resolve every candidate against existing canonical pages.
4. Create the minimum page changes. Each retained statement must include provenance, confidence,
   applicability, exclusions, invalidation signals, and supersession state.
5. Update `index.md` in the same transaction and append one compact `log.md` entry.
6. Require a clean wiki worktree, stage only the operation paths, and create exactly one git commit.
7. Verify the committed tree and return the commit, pages, discarded candidates, and residual
   conflicts. Zero atoms creates no commit.

## Lint and Consolidate

Lint reports contradictions, stale claims, duplicate concepts, broken links, orphan pages,
retrieval drift, and knowledge gaps without writing. Consolidation requires an explicit user
request, preserves provenance, and creates one reviewable commit.

Never infer human acceptance from Plane status, merge state, tests, or reviewer output. Never let
knowledge-write failure revoke an already valid project acceptance.
