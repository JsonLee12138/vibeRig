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

Also read `.vibeRig/project.yaml` for Linear project/team ids, docs root, gate policy, and default subagent routing.

If required files are missing, stop and tell the user which `brainstorm` phase must run first. Do not synthesize missing requirement facts inside this skill.

## Output Contract

Create or update Linear artifacts:

- One parent Linear issue for the requirement or feature.
- Linear sub-issues or linked issues for implementation tasks.
- Linear issue descriptions that reference local docs and acceptance IDs instead of copying full documents.
- Linear labels, status, assignee, and project linkage when available.

Optionally update local docs only to add stable Linear references, such as issue keys or URLs. Do not create a local task file as a long-term source of truth.

## Language Policy

Linear issue titles, descriptions, sub-issue names, plan-sync comments, and chat summaries should follow the user's current working language as closely as possible.

- If the user is chatting in Chinese, write the human-facing Linear content in Chinese.
- If the user is chatting in English, write the human-facing Linear content in English.
- If the requirement docs are in a different language from the current user conversation, prefer the current conversation language and preserve exact technical identifiers from the docs.
- Do not translate stable IDs, file paths, commands, branch names, labels that already exist in Linear, acceptance IDs, issue keys, schema field names, or code symbols.
- If the user explicitly requests a language, use that language for all newly created or updated human-facing Linear text.

## Linear Issue Template

Each Linear task should include:

```markdown
## Task
<short task goal>

## Source Docs
- .vibeRig/requirements/<requirement-id>/brief.md#...
- .vibeRig/requirements/<requirement-id>/architecture.md#...
- .vibeRig/requirements/<requirement-id>/acceptance.md#...

## Acceptance References
- AC-...

## Validation
- <command/manual gate from validation.md or project.yaml>

## Subagent
Recommended: <subagent capability>

## Proof Packet
Post final validation as a Linear comment with commands, logs/CI links, changed files, commit/branch, AC coverage, and residual risks.
```

## Workflow

1. Resolve the target project root and `.vibeRig/project.yaml`.
2. Resolve the requirement directory and validate all required Docs as Code inputs exist.
3. Validate `contract.json` against `contract.schema.json` and `acceptance.json` against `acceptance.schema.json` when a local JSON Schema validator is available. If validation cannot run, report the skipped check.
4. Check consistency:
   - every goal/non-goal in `brief.md` has contract coverage or is explicitly out of scope
   - every acceptance item has source, precondition, action, expected result, evidence, and validation mode
   - every implementation task maps to at least one acceptance ID
   - validation gates match `.vibeRig/project.yaml`
   - risks from `research.md` or `architecture.md` are represented in tasks or validation
5. Use `subagent-routing` to choose recommended subagent capabilities for research follow-up, implementation, QA, review, and integration tasks.
6. Use the `linear` skill/plugin to create or update the parent issue and child issues with concrete Linear app tools:
   - `_list_issue_statuses` to resolve valid workflow states for the target team
   - `_list_issue_labels` and `_create_issue_label` to reuse or create VibeRig labels
   - `_list_issues` to detect existing parent/child issues before creating duplicates
   - `_save_issue` to create or update the parent issue and each child issue; use `parentId` for sub-issues, `project` for project linkage, `team` for creation, and `blockedBy`/`blocks` for dependencies
7. Apply the Language Policy before writing any human-facing Linear title, description, or comment. Keep technical identifiers unchanged.
8. Keep Linear descriptions concise. Link to local doc paths and stable section/AC ids; do not paste full local documents into issues.
9. Add a final Linear comment with `_save_comment` summarizing the plan sync: source docs revision, issue list, acceptance coverage, validation gates, and unresolved risks.
10. Report Linear issue URLs/keys and any local docs updated with references.

## Validation

Before reporting plan sync complete, verify:

- All required Docs as Code files exist.
- `contract.json` and `acceptance.json` were schema-validated or the skipped validation reason is reported.
- Each Linear task maps to at least one acceptance ID and validation expectation.
- Existing Linear issues were checked to avoid duplicates.
- `_save_issue` and `_save_comment` ran successfully when Linear tools were available.
- Any local docs updates only add stable Linear references.

## Hard Rules

- Do not write `.vibeRig/requirements/{requirement-id}/tasks.yaml`.
- Do not call local VibeRig dashboard import, refresh, or task-engine APIs.
- Do not render Linear markdown exports as a separate source of truth.
- Do not put full requirement documents into Linear issues. Local docs remain the durable contract.
- Do not force English Linear issue content when the user is working in another language. Match the user's current working language for human-facing issue text and comments.
- If Linear tools are unavailable, produce a concise issue-draft summary in the chat and stop before pretending issues were created.
- Do not claim plan sync is complete when `_save_issue` or `_save_comment` was skipped despite available Linear tools.
- Main agent may use context-mode for summarizing docs and history. Subagents must not use context-mode.
