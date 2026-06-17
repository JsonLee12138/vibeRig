---
name: documentation-and-adrs
description: Create or update Architecture Decision Records (ADRs), inline documentation, and API docs. Use when making a significant technical decision, changing a public API, shipping a user-facing feature, onboarding a new agent or team member, or when the codebase lacks a record of why something was built a certain way.
---

# Documentation and ADRs

Capture **why** decisions were made, not just what was built. Code shows what was built; documentation explains why it was built this way.

## Contract

Use this skill to:
- Create or update ADRs for significant architectural or technical decisions.
- Write or review inline documentation (comments, gotchas, non-obvious invariants).
- Produce or validate API documentation (JSDoc, OpenAPI specs).
- Prepare agent-readable project context (CLAUDE.md, spec files, convention guides).

Do not use this skill for:
- Documenting obvious code — if a future reader can understand it from the identifiers alone, skip it.
- Throwaway prototypes or spike branches.
- General README writing unrelated to decisions or APIs; redirect to the project's own onboarding process.

Stop and ask when: the decision's context, alternatives considered, or consequences cannot be inferred from the codebase or conversation.

## Input Contract

Required:
- The decision, change, or feature to document.
- Target file or directory (e.g., `docs/decisions/`, source file for inline, API module for JSDoc).

Optional:
- Alternatives that were considered.
- Known consequences or trade-offs.
- Existing ADR to supersede.

If context is missing, inspect the git log, PR description, or related code before asking.

## Output Contract

Return or produce:
- The created or updated file path(s).
- For ADRs: status, context, decision, alternatives, consequences.
- For inline docs: only non-obvious explanations added; no restatements of code.
- For API docs: parameter types, return values, exceptions, and a usage example.

Do not claim completion unless the document is placeholder-free and linked from the index (if one exists).

## ADR Format

Store ADRs in `docs/decisions/` with sequential numbering: `NNNN-short-title.md`.

Use this structure: [ADR template](./assets/adr-template.md)

## ADR Lifecycle

ADRs move through explicit states. Never delete an ADR — preserve history.

| Status | Meaning |
|---|---|
| `proposed` | Under discussion; not yet accepted. |
| `accepted` | The current decision. |
| `deprecated` | No longer relevant; note why. |
| `superseded` | Replaced by a newer ADR; link to it with `superseded_by`. |

When a decision changes: create the new ADR first, mark it `accepted`, then update the old one to `superseded` with a `superseded_by` link to the new ADR number.

## When to Write an ADR

Write one when the decision:
- Affects multiple components or teams.
- Is hard to reverse or expensive to change later.
- Involves a meaningful trade-off between two or more real options.
- Would otherwise be re-debated in six months without a record.

Skip ADRs for: implementation details with no architectural consequence, library version bumps with no behavior change, and decisions that are obvious from the code.

## Inline Documentation Rules

Comment on intent and rationale, not on what the code does.

**Write a comment when:**
- There is a hidden constraint (e.g., "must run before X due to Y lock").
- The behavior would surprise a future reader.
- A workaround exists for a specific external bug.

**Do not write a comment when:**
- The identifier already communicates the intent.
- The comment restates the code in prose.
- The comment is stale or references a ticket that no longer exists.

Never leave commented-out code. Use git history for that.

## API Documentation Rules

For TypeScript APIs, use JSDoc:
- Document parameters, return values, thrown exceptions, and one usage example.
- Pair JSDoc with TypeScript types — do not duplicate type information in prose.

For REST APIs, maintain an OpenAPI/Swagger spec alongside the implementation.

## Agent-Readable Project Context

When the project uses AI agents (Claude, Codex, etc.), ensure these files exist and are current:
- `CLAUDE.md` — conventions, file layout, tool choices, and known gotchas for agents.
- Spec or schema files — authoritative source of truth for data shapes.
- ADRs — so agents understand past decisions and do not re-propose rejected alternatives.

## Validation

```bash
# ADR has required frontmatter fields
grep -E "^# (Status|Context|Decision|Consequences)" docs/decisions/*.md

# No unresolved placeholders
grep -rn "TODO\|FIXME\|<placeholder>" docs/decisions/

# Superseded ADRs link to a successor
grep -l "superseded" docs/decisions/*.md | xargs grep -L "superseded_by" && echo "missing link" || echo "ok"
```

- [ ] ADR status is one of: `proposed`, `accepted`, `deprecated`, `superseded`.
- [ ] Superseded ADRs have a `superseded_by` reference to the new ADR.
- [ ] No inline comments restate what the code already says.
- [ ] API docs include at least one usage example.
- [ ] Agent-readable files (CLAUDE.md, spec files) are updated when the decision changes conventions.
