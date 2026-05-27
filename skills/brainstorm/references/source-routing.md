# Source Routing

Use this guide when generating `research.md` or when another phase needs fresh evidence.

## Source Map

Build a compact source map from `requirement.md`:

- GitHub repositories
- ordinary web URLs
- local file paths or module names
- API names, package names, or framework names
- pasted technical notes
- explicit business constraints
- open questions

Use the source map internally to decide what to inspect. Do not write the full exploration log into result documents.

## GitHub Repositories

When `requirement.md` contains a GitHub repository URL:

1. Extract `owner/repo`.
2. Use DeepWiki MCP before generic browsing.
3. Ask focused questions about:
   - architecture and package structure
   - relevant modules for the requirement
   - public APIs and extension points
   - existing implementation patterns
   - tests and examples
   - constraints, risks, and integration points
4. Record only useful conclusions and evidence in `research.md`.

If DeepWiki is unavailable or cannot answer, fall back to local repository inspection if the repo exists locally, then to web browsing only if needed.

## Ordinary URLs

When `requirement.md` contains a non-GitHub URL:

1. Use Browser to open the page.
2. Read the page title, main content, code examples, API sections, limitations, and linked pages directly relevant to the requirement.
3. Follow only links needed to understand constraints or implementation options.
4. Capture concise evidence in `research.md`, not a browsing transcript.

## Local Project Context

When the requirement points to local code or the current project likely contains relevant implementation:

1. Use `rg --files` and `rg` to find docs, modules, tests, configs, routes, schemas, and feature names.
2. Prefer existing project patterns over new abstractions.
3. Inspect tests and examples when they clarify behavior.
4. Use recent commits only when they are likely to explain current design decisions.

## Pasted Notes Only

When there are no external sources:

1. Extract explicit facts.
2. Separate assumptions from facts.
3. Identify missing technical facts and validation tasks.
4. Continue if useful output is possible.

## Evidence Quality

Classify findings as:

- Fact: directly supported by source material.
- Inference: likely conclusion based on source material.
- Assumption: plausible but not verified.
- Open question: needs user, product, QA, or engineering confirmation.
