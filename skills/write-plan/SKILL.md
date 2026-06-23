---
name: write-plan
description: Convert VibeRig Docs as Code requirement contracts into Linear issues and sub-issues. Use after brainstorm has produced brief, contract, architecture, acceptance, and validation documents, or when the user asks to map a VibeRig requirement into Linear tasks, acceptance references, validation gates, and subagent assignments.
---

# Write Plan

Use this skill after `brainstorm` has produced a planning-ready requirement contract under `.vibeRig/requirements/{requirement-id}/`.

`write-plan` no longer creates `tasks.yaml` and no longer feeds a local task engine. Linear is the task source of truth.

## Contract

Use this skill to convert one planning-ready VibeRig requirement directory into Linear parent/child issues and task references.

Do not use this skill to invent missing requirement facts, execute implementation, create proof packets, or run final acceptance. Use `brainstorm` to finish missing docs and `task-runner` for execution.

Stop when required requirement files are missing, schema validation reveals blocking contradictions, Linear tools are unavailable for a requested sync, or multiple Linear projects/issues match without a safe choice.

## Input Contract

Resolve a requirement directory under:

```text
.vibeRig/requirements/<requirement-id>/
```

Required inputs:

- `brief.md`
- `contract.schema.json`
- `contract.json`
- `architecture.md`
- `acceptance.schema.json`
- `acceptance.json`
- `acceptance.md`
- `validation.md`

Optional inputs:

- `research.md`
- `diagrams/*.mmd`
- existing Linear issue keys or ids recorded in docs

Also read `.vibeRig/project.yaml` for Linear project/team ids, docs root, output language, gate policy, and default subagent routing.

If required files are missing, stop and tell the user which `brainstorm` phase must run first. Do not synthesize missing requirement facts inside this skill.

## Output Contract

Create or update Linear artifacts:

- One parent Linear issue for the requirement or feature.
- Linear sub-issues or linked issues for implementation tasks.
- Linear issue descriptions that reference local docs and acceptance IDs instead of copying full documents.
- Linear labels, status, assignee, and project linkage when available.

Optionally update local docs only to add stable Linear references, such as issue keys or URLs. Do not create a local task file as a long-term source of truth.

## Language Policy

Linear issue titles, descriptions, sub-issue names, plan-sync comments, and chat summaries must use `.vibeRig/project.yaml` `output.language`.

- Linear issue titles and sub-issue titles must be human-readable in `output.language`; do not leave newly created titles in another language just because source docs or the current chat use that language.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- If requirement docs are in a different language from `output.language`, write new human-facing Linear text in `output.language` and preserve exact technical identifiers from the docs.
- Do not translate stable IDs, file paths, commands, branch names, labels that already exist in Linear, acceptance IDs, issue keys, schema field names, or code symbols.
- If the user explicitly requests a one-off language, use that language for the current output and recommend updating `project.yaml` if the change should become durable.

## Linear Issue Template

Read [references/linear-child-issue-template.md](./references/linear-child-issue-template.md) when composing Linear sub-issues. Each task must include: goal, source doc paths, AC references, validation command/gate, recommended subagent, and a proof packet placeholder.

## Task Sizing Guidelines

Size every task before creating it. Prefer S and M tasks — agents and humans perform best on focused, well-scoped work.

| Size | Files touched | Scope | Example |
|------|--------------|-------|---------|
| XS | 1 | Single function or config change | Add a validation rule |
| S | 1–2 | One endpoint or component | New API route |
| M | 3–5 | One feature slice | User registration flow |
| L | 5–8 | Multi-component feature | Search with filtering and pagination |
| XL | 8+ | **Too large — break down further** | — |

Break down further when: the task would take more than one focused session, acceptance criteria need more than 3 bullet points, it touches two independent subsystems, the title contains "and" / "、" / "与" connecting concerns (a sign it is two tasks), or the title names more than 2 distinct concerns — that is always multiple tasks.

## Task Dependency Order

Before writing tasks, map the dependency graph from `architecture.md`:

```
Database schema → Models/Types → API endpoints → Frontend client → UI components
```

Implementation order follows the dependency graph bottom-up. Build foundations first so later tasks have a stable base.

**Vertical slicing (preferred):** Build one complete user-facing path per task rather than all-DB then all-API then all-UI. Each task should deliver working, testable functionality.

**No shell tasks:** Do not create scaffold-only or UI-restoration tasks that span multiple features without delivering independently verifiable behavior. A task that cannot produce a standalone Proof Packet (no AC, no runnable validation command) is not a valid task. Merge its work into the relevant feature tasks instead.

## Workflow

1. Resolve the target project root and `.vibeRig/project.yaml`.
2. Resolve the requirement directory and validate all required Docs as Code inputs exist.
3. Map the dependency graph from `architecture.md` before writing tasks (see Task Dependency Order above).
4. Validate `contract.json` against `contract.schema.json` and `acceptance.json` against `acceptance.schema.json` when a local JSON Schema validator is available. If validation cannot run, report the skipped check.
5. Check consistency:
   - every goal/non-goal in `brief.md` has contract coverage or is explicitly out of scope
   - every acceptance item has source, precondition, action, expected result, evidence, and validation mode
   - every implementation task maps to at least one acceptance ID
   - validation gates match `.vibeRig/project.yaml`
   - risks from `research.md` or `architecture.md` are represented in tasks or validation
6. Use `subagent-routing` to choose recommended subagent capabilities for each implementation task.
7. Apply task sizing (see guidelines above): size every task as XS/S/M/L/XL before creating it. Break down any XL task. Aim for S and M tasks.
8. Use the `linear` skill/plugin to create or update the parent issue and child issues with concrete Linear app tools:
   - `_list_issue_statuses` to resolve valid workflow states for the target team
   - `_list_issue_labels` and `_create_issue_label` to reuse or create VibeRig labels
   - `_list_issues` to detect existing parent/child issues before creating duplicates
   - `_save_issue` to create or update the parent issue and each child issue; use `parentId` for sub-issues, `project` for project linkage, `team` for creation, and `blockedBy`/`blocks` for dependencies
9. Apply the Language Policy before writing any human-facing Linear title, description, or comment. Issue titles must use `output.language`. Keep technical identifiers unchanged.
10. Keep Linear descriptions concise. Link to local doc paths and stable section/AC ids; do not paste full local documents into issues.
11. Add a final Linear comment with `_save_comment` summarizing the plan sync. Read `references/plan-template.md` first and follow its structure: source docs revision, issue list, acceptance coverage, validation gates, and unresolved risks.
12. Report Linear issue URLs/keys and any local docs updated with references.

## Red Flags

- A Linear issue was created without checking for existing issues with `_list_issues` → duplicate issues corrupt the plan; always check first.
- A Linear issue description contains the full local doc instead of a reference path → descriptions must link to paths, not paste documents.
- `_save_issue` was skipped and a chat summary was substituted for Linear output → if Linear tools are available, use them; a chat summary is not a plan sync.
- A task was created without mapping to at least one AC id → every sub-issue must trace to acceptance criteria.
- `subagent-routing` was called without reading the requirement docs first → subagent selection requires knowing the task's domain and risk; select after reading docs, not before.
- An implementation task was created without a recommended subagent capability field → `task-runner` uses this field for routing; omitting it forces re-analysis at execution time.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "I'll create the issues and check for duplicates afterward" | Creating duplicates is a destructive Linear operation. The check must come before creation — `_list_issues` is the gate. |
| "The description is easier to understand with the full doc pasted in" | Full docs in Linear descriptions diverge from local docs the moment either is edited. Reference the path; the local doc is the contract. |
| "Schema validation is slow, I'll skip it and trust the JSON looks right" | JSON that looks right can still violate required fields or AC-id consistency. Run validation or explicitly document why it was skipped. |
| "I'll pick a generic subagent since the specific capability doesn't matter much" | Capability matching matters for execution quality. Use the most specific available capability; fall back to generic only when nothing closer is available and record the routing risk. |
| "I'll create a UI scaffold task first so the feature tasks can plug in logic later" | Scaffold tasks produce no verifiable behavior and cannot produce a Proof Packet. Merge UI work into each feature task as a vertical slice. |
| "I'll add a Checkpoint / QA / integration sub-issue to make quality and wiring explicit" | `agent-sop` runs QA per task; Linear task status is the checkpoint signal; vertical slicing eliminates integration work. These are execution-protocol concerns, not Linear planning tasks. |

## Verification Checklist

```bash
# Confirm required docs exist before plan sync
for f in brief.md contract.json architecture.md acceptance.json acceptance.md validation.md; do
  [ -f ".vibeRig/requirements/<req-id>/$f" ] && echo "ok: $f" || echo "MISSING: $f"
done
```

- [ ] All required Docs as Code files exist.
- [ ] `contract.json` and `acceptance.json` were schema-validated or the skipped validation reason is reported.
- [ ] Each Linear task maps to at least one acceptance ID and validation expectation.
- [ ] Each Linear sub-issue includes a recommended subagent capability field.
- [ ] Existing Linear issues were checked with `_list_issues` before creation.
- [ ] `_save_issue` and `_save_comment` ran successfully when Linear tools were available.
- [ ] No sub-issue is a scaffold/shell task — every sub-issue has a standalone validation command and can produce its own Proof Packet.
- [ ] No sub-issue title names more than 2 distinct concerns connected by "and" / "、" / "与".
- [ ] No Checkpoint, QA, or integration sub-issues were created — these are handled by the execution protocol and Linear status.
- [ ] Any local docs updates only add stable Linear references, not full document content.
- [ ] Linear issue descriptions reference doc paths, not pasted doc content.

## Hard Rules

- Do not create Checkpoint, QA, or integration sub-issues. QA is built into `agent-sop`; Linear task status is the checkpoint signal; integration work signals that feature tasks were not properly vertically sliced.
- Do not write `.vibeRig/requirements/{requirement-id}/tasks.yaml`.
- Do not call local VibeRig dashboard import, refresh, or task-engine APIs.
- Do not render Linear markdown exports as a separate source of truth.
- Do not put full requirement documents into Linear issues. Local docs remain the durable contract.
- Do not force English Linear issue content. Use `.vibeRig/project.yaml` `output.language` for human-facing issue text and comments.
- If Linear tools are unavailable, produce a concise issue-draft summary in the chat and stop before pretending issues were created.
- Do not claim plan sync is complete when `_save_issue` or `_save_comment` was skipped despite available Linear tools.
- Subagents must not update Linear or status unless explicitly routed by the main agent through this workflow.
