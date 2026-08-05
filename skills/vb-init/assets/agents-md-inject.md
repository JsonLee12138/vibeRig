<!-- inject:viberig:start -->
## VibeRig Project Context

- Treat this root `AGENTS.md` as a map, not the complete project handbook.
- Before editing, read `.vibeRig/project.yaml`, the active Work Item, `.vibeRig/context-routes.yaml`, and the nearest directory-level `AGENTS.md` for every path you may change.
- Load only contracts, ADRs, test guidance and Runbooks selected by matched routes. Do not read the entire `docs/` or `.vibeRig/requirements/` tree.
- Existing project PRDs, specs, ADRs, task trackers and Runbooks remain authoritative. VibeRig stores references and execution state; do not create a parallel source of truth.
- Resolve local execution through `.vibeRig/environments.yaml`. Disposable local and configured sandbox credentials may be used without exposing their values; production access remains separately gated.
- Completion requires current Evidence for every required Verification Graph node. Code generation, low-fidelity substitution or a Subagent completion statement is insufficient.
- Operational changes must update and exercise the matching `.vibeRig/runbooks.yaml` entry; unaffected work must not create empty Runbooks.

## VibeRig Output Language

- Read `.vibeRig/project.yaml` before creating or updating VibeRig human-facing records.
- Use `.vibeRig/project.yaml` `output.language` for VibeRig issue titles, issue descriptions, comments, requirement documents, validation notes, proof packets, human acceptance records, retrospectives, and final summaries.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `.vibeRig/project.yaml` through `vb-init`.
- Do not translate stable IDs, file paths, commands, branch names, PR URLs, commit hashes, Linear keys, acceptance IDs, schema field names, code symbols, or existing external labels/status names.

## Output

Choose one primary format per reply. Up to two lines of context (purpose, assumption, or constraint) are allowed; do not append full prose or extra code blocks.

Evaluate in order, stop at first match:

**1. Structure / relationships / flow / state → Mermaid diagram**

| Trigger | Diagram type |
|---|---|
| DB table relationships, schema design | `erDiagram` |
| API call chains, auth, microservice interactions | `sequenceDiagram` |
| Business flows, CI/CD, ETL, retry/fallback | `flowchart` |
| State machines, lifecycle | `stateDiagram-v2` |
| Domain models, class inheritance, module deps | `classDiagram` |
| System/deployment architecture | `flowchart` / `architecture-beta` |
| Branch strategy, release flows | `gitGraph` |
| Requirement breakdown, brainstorming | `mindmap` |
| Technology selection, priority matrix | `quadrantChart` |

When also generating a code file: ① diagram in chat first, ② code to file. No code blocks in chat.

**2. Multi-dimensional comparison → Table**

**3. Ordered steps / task progress → Checklist**

**4. Reasoning / tradeoffs / explanation → 3W1H**

| **What** | Conclusion first |
|---|---|
| **Why** | Rationale, tradeoff basis |
| **How** | How to implement |
| **When** | Applicable boundary |

**5. Fallback → One sentence**
<!-- inject:viberig:end -->
