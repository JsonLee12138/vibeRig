<!-- inject:viberig:start -->
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
