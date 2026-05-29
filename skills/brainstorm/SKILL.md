---
name: brainstorm
description: >-
  Run the VibeRig staged requirement brainstorming workflow from a requirement
  idea or name. Use when the user asks to brainstorm, create, research,
  validate, plan, or specify a requirement. The skill advances one approved
  phase at a time: requirement, research, acceptance, roadmap, then spec. Each
  phase uses a 3W1H lens, explores context, asks one question at a time,
  presents candidate approaches and a phase draft for approval, resolves
  blocking unknowns before writing, writes only the approved
  .vibeRig/requirements/name document, self-reviews it, then recommends the
  next phase.
---

# Brainstorm

Use this skill to turn a rough requirement idea into approved VibeRig result documents through staged collaborative dialogue.

The default behavior is one phase at a time. Do not create directories or write files until the user has approved the current phase draft, unless the user explicitly asks to skip clarification and write a draft.

## Contract

Use this directory shape:

```text
.vibeRig/
└── requirements/
    └── <requirement-name>/
        ├── requirement.md
        ├── research.md
        ├── acceptance.md
        ├── roadmap.md
        └── spec.md
```

Treat `requirement.md` as the root requirement result. Generate downstream files only from approved upstream documents and current phase discussion.

Do not implement code as part of this skill. Stop at result documents.

## Stage Gate

Before writing or updating any result file for the current phase:

1. Explore local project context.
2. Read existing upstream documents for the phase.
3. Build a current-phase `3W1H` understanding from the user request, project context, and upstream documents.
4. Ask clarifying questions one at a time until the phase goal, constraints, affected people/systems, success criteria, and any document-blocking unknowns are resolved.
5. If upcoming decisions involve visual judgment, offer a visual companion in a standalone message before asking visual questions.
6. Propose 2-3 possible approaches with tradeoffs and a recommendation when there is a meaningful choice.
7. Present the current phase draft in reviewable sections.
8. Ask the user to approve, revise, or reject the phase draft before writing.

Only after approval may you resolve/create `.vibeRig/requirements/<requirement-name>/` and write the current phase document.

After writing, run the phase self-review, fix issues inline, report the written file path, and recommend the next phase. Do not continue to the next phase until the user explicitly confirms.

If the user explicitly says to write immediately, first check for document-blocking unknowns. If any exist, ask the single most important blocking question instead of writing. Only write immediately when remaining gaps can be safely converted into approved working decisions in the review draft.

## 3W1H Phase Lens

Use `3W1H` as the thinking and review lens for every phase. It is not a required final-document heading structure. Final files must still follow their phase templates.

For the current phase, clarify:

- `Why`: Why does this phase matter? What problem, value, risk, or decision motivates it?
- `What`: What should this phase produce? What is in scope, out of scope, constrained, or dependent?
- `Who`: Who uses, maintains, validates, reviews, executes, integrates with, or is affected by the result?
- `How`: How should the result be explored, decided, implemented, validated, sequenced, or recovered if it fails?

Apply the lens by phase:

- `requirement`: Focus on requirement value, user/business roles, scope boundaries, success criteria, approved working decisions, and resolved decision records.
- `research`: Focus on risks to validate, source quality, technical facts, candidate paths, impacted systems, and recommendation confidence.
- `acceptance`: Focus on failures to prevent, automated/manual acceptance points, validation owner, pass criteria, boundary cases, risk scenarios, and regression coverage.
- `roadmap`: Focus on why the sequence is chosen, phases, tasks, dependencies, execution roles, parallelism, milestones, validation tasks, and risk mitigation.
- `spec`: Focus on why the selected design is appropriate, modules, APIs, data, state flow, callers/integrations, implementation flow, errors, migration, and tests.

If any `3W1H` dimension is missing and the gap would materially reduce phase quality, ask one most important clarifying question before drafting.

If there is a meaningful decision, use the `3W1H` lens to compare 2-3 options and recommend one.

The final output files must contain converged results only. Do not write 3W1H brainstorming notes, conversation history, or internal reasoning into result files unless the labels naturally fit the phase template.

## Guided Phase Order

Run phases in this order:

1. `requirement` -> writes `requirement.md`.
2. `research` -> writes `research.md`.
3. `acceptance` -> writes `acceptance.md`.
4. `roadmap` -> writes `roadmap.md`.
5. `spec` -> writes `spec.md`.

The default first phase is `requirement`. If the user asks for `full` or `全流程`, treat it as a guided sequence across turns, not permission to write all documents in one pass.

Each phase ends with a next-step prompt, for example: "需求已写入。下一步建议进入调研阶段，是否继续？"

## Core Gate

For compatibility, treat the Core Gate as the Stage Gate applied to the current phase. Do not use one approval to write multiple downstream documents.

Before writing or updating any result file:

1. Explore local project context.
2. Read upstream documents required by the current phase.
3. Build a current-phase `3W1H` understanding.
4. Ask clarifying questions one at a time until the current phase is clear enough and document-blocking unknowns are resolved.
5. If upcoming decisions involve visual judgment, offer a visual companion in a standalone message before asking visual questions.
6. Propose 2-3 possible approaches with tradeoffs and a recommendation when there is a meaningful choice.
7. Present the converged phase draft in sections and ask the user to confirm each section.
8. Ask the user to approve, revise, or reject the phase draft.

Only after approval may you resolve/create `.vibeRig/requirements/<requirement-name>/` and write the current result document.

If the user explicitly says to write immediately, first check for document-blocking unknowns. If any exist, ask the single most important blocking question instead of writing. Only write immediately when remaining gaps can be safely converted into approved working decisions in the review draft.

## Mode Parsing

Parse the user request into a requirement name and a mode.

Default mode: `requirement`.

Supported modes:

| Mode | User wording examples | Output |
|---|---|---|
| `full` | full, all, 全流程, 完整脑暴 | Guided sequence: one phase and one approved document at a time |
| `requirement` | requirement, 需求, 创建需求, 整理需求 | `requirement.md` |
| `research` | research, 技术调研, 调研 | `research.md` |
| `acceptance` | acceptance, 验收, 测试验收 | `acceptance.md` |
| `roadmap` | roadmap, 路线, 任务拆分, 推进计划 | `roadmap.md` |
| `spec` | spec, 方案, 实现方案, 技术方案 | `spec.md` |

If the user only provides a requirement name, start the dialogue flow for `requirement`; do not immediately write files.

## Requirement Resolution

Run requirement resolution only after the current Stage Gate is approved, or when the user explicitly asks to inspect or update an existing requirement.

1. Locate the VibeRig root.
   - Prefer the current workspace if it contains `.vibeRig/requirements/`.
   - Otherwise use the git root if available.
   - If `.vibeRig/requirements/` does not exist, create it under the workspace root.
2. Resolve the requirement directory.
   - First try exact match: `.vibeRig/requirements/<user-name>/`.
   - Then try normalized matching: trim whitespace, compare case-insensitively, and treat spaces, hyphens, and underscores as equivalent.
   - If exactly one likely match exists, use it.
   - If multiple likely matches exist, ask the user to choose.
   - If no match exists, create `.vibeRig/requirements/<safe-name>/` and run the requirement creation flow.
3. If the requirement name contains path separators or unsafe filesystem characters, use a safe directory name and preserve the original title in `requirement.md`.

## Dialogue Workflow

1. Parse requirement name and mode.
2. Inspect project context before asking detailed questions.
   - Check local docs, existing `.vibeRig/requirements/`, relevant source structure, configs, and recent commits when useful.
   - If the request spans multiple independent subsystems, flag that scope and help split it before continuing.
3. Build a current-phase `3W1H` map.
   - Identify known `Why`, `What`, `Who`, and `How` facts.
   - Identify missing dimensions that materially affect the current phase.
   - Use the most important missing dimension to choose the next clarifying question.
   - Classify every missing item as either document-blocking or non-blocking.
   - Treat an item as document-blocking when writing without it would create TBD content, unresolved placeholders, ambiguous requirements, unapproved scope, or implementation/acceptance decisions that the team cannot safely act on.
4. Decide whether visual discussion is likely.
   - Visual topics include UI layout, workflow diagrams, architecture diagrams, mockups, information hierarchy, and side-by-side design comparisons.
   - If yes, send a standalone message asking whether the user wants a visual companion for mockups, diagrams, comparisons, or other browser-rendered aids.
   - Do not combine the visual companion offer with context summaries, clarifying questions, or any other content.
   - If the user declines or no visual tool is available, continue text-only.
5. Ask clarifying questions one at a time.
   - Prefer multiple choice questions when it helps the user answer quickly.
   - Focus on purpose, users, affected systems, constraints, scope boundaries, success criteria, non-goals, compatibility, and risk.
   - Do not bundle a long questionnaire into one response.
   - After each answer, update the `3W1H` map and decide whether another single question is needed or whether the phase is clear enough.
   - Continue until no document-blocking unknowns remain.
6. Propose 2-3 approaches.
   - Lead with the recommended option.
   - Explain tradeoffs, risks, deferred work, and how each option affects `Why`, `What`, `Who`, and `How`.
7. Present the current phase draft in sections.
   - Scale detail to complexity.
   - Cover the fields needed by the current phase template.
   - Ensure the draft is supported by the current phase `3W1H` understanding.
   - Convert any non-blocking uncertainty into an explicit recommended working decision before asking for approval.
   - Do not include TBD, 待定, 待确认, unresolved questions, or placeholder sections in the draft.
   - Ask after each section whether it looks right before presenting the next section.
   - If the user requests changes, revise that section and confirm it again.
8. Ask for approval before writing the current document.
   - Summarize the approved sections and ask whether to write the current VibeRig document.
   - If the user requests changes, revise the summary and confirm the affected sections again.
   - If the user approves, continue to the Document Workflow.

## Document Workflow

1. Resolve or create the requirement directory.
2. Read existing result files that may affect the requested mode.
3. If `requirement.md` is missing and the requested phase is not `requirement`, stop and recommend the requirement phase first.
4. Run only the requested current phase.
5. Before writing, verify that the phase draft preserves the relevant `Why`, `What`, `Who`, and `How` information.
6. Verify the approved draft has no document-blocking unknowns, TBD content, unresolved questions, or empty placeholder sections. If it does, stop and ask the single most important blocking question before writing.
7. Run document self-review and fix issues inline.
8. Ask the user to review the written file before treating the phase as complete.
9. Report the generated or updated file path and the recommended next phase. Do not report unresolved blockers after writing; unresolved blockers must be handled before writing.

## Phase Rules

### Requirement

Create or refine `requirement.md` as a converged requirement result based on the approved dialogue summary. Include goals, non-goals, candidate requirements, boundary decisions, business rules, dependencies, constraints, source links, and resolved decision records.

Use `3W1H` to ensure the requirement captures why it matters, what is in and out of scope, who benefits or is affected, and how success will be recognized.

If the user explicitly asked to skip clarification and no source material exists beyond the requirement name, still ask one blocking clarification question if the name is insufficient to produce an actionable requirement. Otherwise create a useful draft from the name and local project context, converting inferred non-blocking choices into recommended working decisions for approval before writing.

Read `references/requirement-template.md` before writing this file.

### Research

Generate `research.md` before using research conclusions in later phases. Confirm the research scope and source map before writing.

Use `3W1H` to ensure the research captures why the investigation is needed, what questions and candidate paths are being evaluated, who or what systems are affected, and how evidence supports the recommendation.

Route sources as follows:

- GitHub repository URL: use DeepWiki MCP to investigate the repository.
- Ordinary URL: use Browser to open and inspect the page and relevant linked pages.
- Local code or docs: inspect relevant files, tests, configs, and project docs.
- Pasted notes: extract facts, constraints, approved working decisions, risks, and unknowns that must be resolved before writing.

Read `references/source-routing.md` and `references/research-template.md` before writing this file.

### Acceptance

Generate `acceptance.md` from `requirement.md` and `research.md` when available. Include automated acceptance, manual acceptance, boundary cases, risk scenarios, regression scenarios, and out-of-scope checks.

Use `3W1H` to ensure acceptance captures why each major risk or behavior must be verified, what will be checked, who or what performs the check, and how pass/fail will be determined.

Use stable IDs for acceptance points so `write-plan` can map tasks to them later. Do not invent task IDs in `acceptance.md`; task-to-acceptance and task-to-manual-check mapping belongs in `plan.md` and `tasks.yaml` after task splitting.

Read `references/acceptance-template.md` before writing this file.

### Roadmap

Generate `roadmap.md` from `requirement.md`, `research.md`, and `acceptance.md` when available. Include phases, task breakdown, dependencies, milestones, validation tasks, and risk mitigations.

Use `3W1H` to ensure the roadmap captures why the sequence is chosen, what work is included or deferred, who should execute or review each part, and how progress, validation, and risk handling will work.

Read `references/roadmap-template.md` before writing this file.

### Spec

Generate `spec.md` from `requirement.md`, `research.md`, and `roadmap.md` when available. Include final implementation direction, module design, API/data design, process/state flow, errors, compatibility, migration, and test strategy.

Use `3W1H` to ensure the spec captures why this design is selected, what is being designed, who calls, integrates, maintains, or is affected by it, and how the implementation, error handling, migration, and tests should work.

Read `references/spec-template.md` before writing this file.

## Output Rules

- Write only converged results. Do not write brainstorming transcripts, process logs, or internal reasoning.
- Do not include "I considered..." or chronological exploration notes in output files.
- Do not write documents before the user approves the current phase draft, unless the user explicitly requests immediate drafting.
- Use `3W1H` to improve completeness, but do not force final documents to use `Why`, `What`, `Who`, and `How` headings.
- Do not write TBD, TODO, 待定, 待确认, unknown, open question, unresolved blocker, or empty placeholder sections into result files.
- If a missing answer would materially affect scope, acceptance, implementation, sequencing, ownership, data, compatibility, or risk, ask the user before drafting or writing.
- Non-blocking uncertainty may appear only as an approved working decision with rationale and a review trigger; it must not be framed as content still waiting for confirmation.
- Include rejected options only when they explain an important tradeoff.
- Preserve existing human-authored decisions unless the requirement changed or the user asks to rewrite.
- Do not silently invent facts. If a missing dependency changes confidence, stop and ask before writing.
- Keep each document useful as a standalone review artifact.

## Review

After writing the current document and before asking the user to review it, read `references/review-rubric.md` and fix issues found in the generated document.

Always check and fix:

- Placeholders such as TBD, TODO, empty sections, and unresolved template text.
- Any 待定, 待确认, open question, unresolved blocker, or unknown content that should have been clarified before writing.
- Contradictions within a file or across generated files.
- Scope creep or requirements that should be split into a separate requirement.
- Ambiguous statements that could be interpreted more than one way.
- Missing phase-relevant `Why`, `What`, `Who`, or `How` information.

For downstream phases, ensure:

- `research.md` supports the recommended direction in `spec.md`.
- `acceptance.md` covers major requirements from `requirement.md`.
- `roadmap.md` includes mitigations or validation tasks for high-risk findings.
- Output files contain results only, not the brainstorming process.

Only run cross-document checks for documents that already exist.

After the self-review passes, ask the user to inspect the written file. If they request changes, update the file, rerun the self-review, and ask for review again.
