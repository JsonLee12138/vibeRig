---
name: source-driven-development
description: Ground every implementation decision in official documentation. Use when writing framework-specific code, implementing patterns where version correctness matters, or when the user wants verified, source-cited code. Do not use for version-independent logic, or when the user explicitly wants speed over verification.
---

# Source-Driven Development

Every framework-specific code decision must be backed by official documentation. Don't implement from memory — verify, cite, and let the user see sources. Training data goes stale, APIs get deprecated, best practices evolve.

## Contract

Use this skill whenever writing framework-specific or library-specific code where the correct approach depends on the installed version.

Do not use when: logic is version-independent (loops, conditionals, data structures), correctness doesn't depend on a specific version (renaming, moving files), or the user explicitly asks for speed over verification.

## The Process

```
DETECT → FETCH → IMPLEMENT → CITE
```

### Step 1: Detect Stack and Versions

Read the project's dependency file (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.) to identify exact versions. State what you found:

```
STACK DETECTED:
- React 19.1.0 (from package.json)
- Next.js 15.2.0
→ Fetching official docs for the relevant patterns.
```

If versions are missing or ambiguous, ask the user. Don't guess — the version determines which patterns are correct.

### Step 2: Fetch Official Documentation

Fetch the specific page for the feature being implemented. Not the homepage — the relevant page.

**Source hierarchy (in order of authority):**
1. Official documentation (react.dev, docs.djangoproject.com, pkg.go.dev)
2. Official blog / changelog
3. Web standards references (MDN, web.dev)
4. Browser/runtime compatibility (caniuse.com, node.green)

**Never cite as primary sources:** Stack Overflow, blog posts, tutorials, or AI-generated summaries (including your own training data — that is the point).

After fetching, extract key patterns and note any deprecation warnings or migration guidance. When official sources conflict with each other, surface the discrepancy to the user.

### Step 3: Implement Following Documented Patterns

- Use the API signatures from the docs, not from memory
- If the docs show a new way to do something, use the new way
- If the docs deprecate a pattern, don't use the deprecated version
- If the docs don't cover something, flag it as unverified

**When docs conflict with existing project code:**

```
CONFLICT DETECTED:
The codebase uses [old pattern], but [framework] docs for v[X]
recommend [new pattern].
Source: [URL]

Options:
A) Use the modern pattern — consistent with current docs
B) Match existing code — consistent with codebase
→ Which approach do you prefer?
```

Surface the conflict. Don't silently pick one.

### Step 4: Cite Your Sources

Every framework-specific pattern gets a citation. In code comments:

```typescript
// React 19 form handling with useActionState
// Source: https://react.dev/reference/react/useActionState#usage
const [state, formAction, isPending] = useActionState(submitOrder, initialState);
```

**Citation rules:**
- Full URLs, not shortened. Prefer deep links with anchors.
- Quote the relevant passage for non-obvious decisions.
- If you cannot find documentation for a pattern, say so explicitly:

```
UNVERIFIED: No official documentation found for this pattern.
Based on training data — may be outdated. Verify before using in production.
```

Honesty about what you couldn't verify is more valuable than false confidence.

## Red Flags

- Writing framework-specific code without checking the docs for the installed version
- Using "I believe" or "I think" about an API instead of citing the source
- Implementing a pattern without knowing which version it applies to
- Citing Stack Overflow or blog posts instead of official documentation
- Using deprecated APIs because they appear in training data
- Not reading dependency files before implementing
- Delivering code without source citations for framework-specific decisions

## Verification

After implementing:

- [ ] Framework and library versions identified from the dependency file
- [ ] Official documentation fetched for all framework-specific patterns
- [ ] All sources are official documentation (not blog posts or training data)
- [ ] Code follows the current version's documented patterns
- [ ] Non-trivial decisions include source citations with full URLs
- [ ] No deprecated APIs are used (checked against migration guides)
- [ ] Conflicts between docs and existing code were surfaced to the user
- [ ] Anything that could not be verified is explicitly flagged as unverified
