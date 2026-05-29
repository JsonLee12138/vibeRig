---
name: brainstorm
description: >-
  Run the VibeRig staged requirement brainstorming workflow from a requirement
  idea or name. Use when the user asks to brainstorm, create, research,
  validate, plan, or specify a requirement. The skill advances one approved
  phase at a time across requirement, research, acceptance, roadmap, and spec.
  Requirement or research may be the first phase depending on the user's entry
  point. Each phase and each review block uses a 3W1H lens, asks one question at
  a time, presents candidate approaches and a phase draft for approval, resolves
  blocking unknowns before writing, writes only the approved
  .vibeRig/requirements/name document(s), self-reviews them, then recommends the
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
        ├── acceptance-human.md
        ├── roadmap.md
        └── spec.md
```

Treat `requirement.md` as the root requirement result when it exists. If the user starts from technical research, generate `research.md` first with explicit requirement assumptions, then use the approved research to help create `requirement.md`.

Do not implement code as part of this skill. Stop at result documents.

## Document Audience Contract

- `requirement.md`: human-facing. Use concise numbered sections and numbered requirement points. Each point should be easy for a user to approve, reject, or revise.
- `research.md`: human-facing technical research. Support both requirement-first and research-first flows. Use concise numbered conclusions, facts, options, risks, and recommendation points.
- `acceptance.md`: AI-facing acceptance contract. Make it complete, explicit, and stable enough for `write-plan` and implementation agents.
- `acceptance-human.md`: human-facing acceptance brief. Use the same numbered order and the same acceptance IDs as `acceptance.md`. Every item must have a one-to-one match in `acceptance.md`; no acceptance point may exist in only one of the two files.
- `roadmap.md`: dual audience. Start with a concise human-facing numbered summary, then include detailed sequencing, dependencies, validation, and risk handling for AI planning.
- `spec.md`: dual audience. Start with a concise human-facing numbered summary, then include detailed implementation design for AI implementation and human review.

## Stage Gate

Before writing or updating any result file for the current phase:

1. Explore local project context.
2. Read existing upstream documents for the phase.
3. Run the `3W1H Workflow` for the current phase until the current block is clear enough to draft.
4. Ask clarifying questions one at a time until the phase goal, constraints, affected people/systems, success criteria, and any document-blocking unknowns are resolved.
5. If upcoming decisions involve visual judgment, offer a visual companion in a standalone message before asking visual questions.
6. Propose 2-3 possible approaches with tradeoffs and a recommendation when there is a meaningful choice.
7. Present the current phase draft through the `3W1H Workflow` block confirmation step before moving to the next block.
8. Ask the user to approve, revise, or reject the phase draft before writing.

Only after approval may you resolve/create `.vibeRig/requirements/<requirement-name>/` and write the current phase document(s).

After writing, run the phase self-review, fix issues inline, report the written file path(s), and recommend the next phase. Do not continue to the next phase until the user explicitly confirms.

If the user explicitly says to write immediately, first check for document-blocking unknowns. If any exist, ask the single most important blocking question instead of writing. Only write immediately when remaining gaps can be safely converted into approved working decisions in the review draft.

## 3W1H Workflow

Run this workflow for every phase and every review block. `3W1H` is a workflow, not just a completeness checklist. It is not a required final-document heading structure. Final files must still follow their phase templates.

### Dimensions

For the current phase or block, clarify:

- `Why`: Why does this phase matter? What problem, value, risk, or decision motivates it?
- `What`: What should this phase produce? What is in scope, out of scope, constrained, or dependent?
- `Who`: Who uses, maintains, validates, reviews, executes, integrates with, or is affected by the result?
- `How`: How should the result be explored, decided, implemented, validated, sequenced, or recovered if it fails?

### Phase Focus

- `requirement`: Focus on requirement value, user/business roles, scope boundaries, success criteria, approved working decisions, and resolved decision records.
- `research`: Focus on risks to validate, source quality, technical facts, candidate paths, impacted systems, and recommendation confidence.
- `acceptance`: Focus on failures to prevent, automated/manual acceptance points, validation owner, pass criteria, boundary cases, risk scenarios, and regression coverage.
- `roadmap`: Focus on why the sequence is chosen, phases, tasks, dependencies, execution roles, parallelism, milestones, validation tasks, and risk mitigation.
- `spec`: Focus on why the selected design is appropriate, modules, APIs, data, state flow, callers/integrations, implementation flow, errors, migration, and tests.

### Steps

1. Scope the block.
   - Identify the current phase, target document(s), audience, upstream documents, and the smallest reviewable block to discuss next.
2. Build the `3W1H` map.
   - Capture known `Why`, `What`, `Who`, and `How` facts from the user request, project context, and upstream documents.
   - Track the source of each important fact: user-confirmed, existing document, local code, research evidence, or working assumption.
3. Classify gaps.
   - Mark each missing item as document-blocking or non-blocking.
   - Treat an item as document-blocking when writing without it would create TBD content, unresolved placeholders, ambiguous requirements, unapproved scope, or implementation/acceptance decisions that the team cannot safely act on.
   - If a blocking gap exists, ask only the single most important clarifying question, then update the map before asking another.
4. Compare options when there is a meaningful decision.
   - Present 2-3 options and compare each option across `Why`, `What`, `Who`, and `How`.
   - Lead with the recommended option and state the tradeoff or deferred work.
5. Draft the current block.
   - Convert the current `3W1H` map into a concise reviewable block that matches the target document template.
   - Keep internal reasoning out of the draft; include only converged result content and approved working decisions.
6. Confirm the block with the user.
   - Ask whether the block's `Why`, `What`, `Who`, and `How` are correct.
   - If the user revises any dimension, update the map and redraft the block before continuing.
7. Run document review after writing.
   - Verify the written document preserves the phase-relevant `Why`, `What`, `Who`, and `How`.
   - Fix missing dimensions, mismatched summaries, unclear ownership, vague pass criteria, and unapproved assumptions before reporting completion.

When presenting a phase draft, do not dump all sections at once. Walk the user through the workflow block by block, confirm the block's `Why`, `What`, `Who`, and `How`, then continue.

The final output files must contain converged results only. Do not write 3W1H brainstorming notes, conversation history, or internal reasoning into result files unless the labels naturally fit the phase template.

## Guided Phase Order

Default phase flow:

1. `requirement` -> writes `requirement.md`.
2. Optional `research` -> writes or refreshes `research.md`.
3. `acceptance` -> writes `acceptance.md` and `acceptance-human.md`.
4. `roadmap` -> writes `roadmap.md`.
5. `spec` -> writes `spec.md`.

Research-first entry flow:

1. `research` -> writes `research.md` with explicit requirement assumptions.
2. `requirement` -> writes `requirement.md` by confirming, revising, or rejecting the assumptions from `research.md`.
3. Optional `research` refresh -> update `research.md` if the confirmed requirement changed assumptions, scope, constraints, or technical risk.
4. `acceptance` -> writes `acceptance.md` and `acceptance-human.md`.
5. `roadmap` -> writes `roadmap.md`.
6. `spec` -> writes `spec.md`.

Research may run before requirement, after requirement, both before and after, or be skipped when the current context is already sufficient for the requested phase. If research ran before requirement, recommend a post-requirement research refresh after `requirement.md` is approved, but do not require it; the user may proceed directly to acceptance when the prior research is still sufficient.

The default first phase is `requirement`. If the user asks to investigate technology, compare options, or research before defining the requirement, start with `research`. After a research-first phase completes, recommend `requirement` next and use `research.md` as input; do not skip requirement confirmation just because research already exists.

If the user asks for `full` or `全流程`, treat it as a guided sequence across turns, not permission to write all documents in one pass.

Each phase ends with a next-step prompt. If a research-first flow just produced `requirement.md`, the prompt should offer an optional research refresh and a direct path to acceptance, for example: "需求已写入。建议可选补充调研以校准已确认需求；如果当前调研已足够，也可以直接进入验收。要继续哪一步？"

Default next-step example after requirement-first work: "需求已写入。下一步建议进入调研阶段，是否继续？"

## Core Gate

For compatibility, treat the Core Gate as the Stage Gate applied to the current phase. Do not use one approval to write multiple downstream documents.

Before writing or updating any result file:

1. Explore local project context.
2. Read upstream documents required by the current phase.
3. Run the `3W1H Workflow` for the current phase.
4. Ask clarifying questions one at a time until the current phase is clear enough and document-blocking unknowns are resolved.
5. If upcoming decisions involve visual judgment, offer a visual companion in a standalone message before asking visual questions.
6. Propose 2-3 possible approaches with tradeoffs and a recommendation when there is a meaningful choice.
7. Present the converged phase draft in blocks and ask the user to confirm each block through the `3W1H` lens.
8. Ask the user to approve, revise, or reject the phase draft.

Only after approval may you resolve/create `.vibeRig/requirements/<requirement-name>/` and write the current result document(s).

If the user explicitly says to write immediately, first check for document-blocking unknowns. If any exist, ask the single most important blocking question instead of writing. Only write immediately when remaining gaps can be safely converted into approved working decisions in the review draft.

## Mode Parsing

Parse the user request into a requirement name and a mode.

Default mode: `requirement`.

Supported modes:

| Mode | User wording examples | Output |
|---|---|---|
| `full` | full, all, 全流程, 完整脑暴 | Guided sequence: one approved phase at a time |
| `requirement` | requirement, 需求, 创建需求, 整理需求 | `requirement.md` |
| `research` | research, 技术调研, 调研 | `research.md` |
| `acceptance` | acceptance, 验收, 测试验收 | `acceptance.md` and `acceptance-human.md` |
| `roadmap` | roadmap, 路线, 任务拆分, 推进计划 | `roadmap.md` |
| `spec` | spec, 方案, 实现方案, 技术方案 | `spec.md` |

If the user only provides a requirement name, start the dialogue flow for `requirement`; do not immediately write files. If the user only provides a technology or repository/topic to investigate, start the dialogue flow for `research`.

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
3. Run `3W1H Workflow` steps 1-3.
   - Scope the current block.
   - Build the `Why`, `What`, `Who`, and `How` map.
   - Classify gaps as document-blocking or non-blocking.
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
6. Run `3W1H Workflow` step 4 when there is a meaningful decision.
   - Lead with the recommended option.
   - Explain tradeoffs, risks, deferred work, and how each option affects `Why`, `What`, `Who`, and `How`.
7. Run `3W1H Workflow` steps 5-6 for each draft block.
   - Scale detail to complexity.
   - Cover the fields needed by the current phase template.
   - Ensure the draft is supported by the current phase `3W1H` understanding.
   - Convert any non-blocking uncertainty into an explicit recommended working decision before asking for approval.
   - Do not include TBD, 待定, 待确认, unresolved questions, or placeholder sections in the draft.
   - Ask after each block whether the `Why`, `What`, `Who`, and `How` look right before presenting the next block.
   - If the user requests changes, revise that block and confirm it again.
8. Ask for approval before writing the current document(s).
   - Summarize the approved blocks and ask whether to write the current VibeRig document(s).
   - If the user requests changes, revise the summary and confirm the affected blocks again.
   - If the user approves, continue to the Document Workflow.

## Document Workflow

1. Resolve or create the requirement directory.
2. Read existing result files that may affect the requested mode.
3. If `requirement.md` is missing and the requested phase is neither `requirement` nor `research`, stop and recommend the requirement phase first.
4. Run only the requested current phase.
5. Before writing, verify that the phase draft preserves the relevant `Why`, `What`, `Who`, and `How` information.
6. Verify the approved draft has no document-blocking unknowns, TBD content, unresolved questions, or empty placeholder sections. If it does, stop and ask the single most important blocking question before writing.
7. Run document self-review and fix issues inline.
8. Ask the user to review the written file(s) before treating the phase as complete.
9. Report the generated or updated file path(s) and the recommended next phase. Do not report unresolved blockers after writing; unresolved blockers must be handled before writing.

## Phase Rules

### Requirement

Create or refine `requirement.md` as a concise, human-facing requirement result based on the approved dialogue summary. Include goals, non-goals, numbered requirement points, boundary decisions, business rules, dependencies, constraints, source links, and resolved decision records.

If `research.md` exists before `requirement.md`, read it first. Convert its requirement assumptions, recommended direction, constraints, and risks into candidate requirement points, then confirm those points with the user through the `3W1H` lens before writing `requirement.md`.

Use `3W1H` to ensure the requirement captures why it matters, what is in and out of scope, who benefits or is affected, and how success will be recognized.

If the user explicitly asked to skip clarification and no source material exists beyond the requirement name, still ask one blocking clarification question if the name is insufficient to produce an actionable requirement. Otherwise create a useful draft from the name and local project context, converting inferred non-blocking choices into recommended working decisions for approval before writing.

Read `references/requirement-template.md` before writing this file.

### Research

Generate `research.md` before using research conclusions in later phases. Confirm the research scope and source map before writing. This phase may run before `requirement.md` exists when the user wants technology research first.

Use `3W1H` to ensure the research captures why the investigation is needed, what questions and candidate paths are being evaluated, who or what systems are affected, and how evidence supports the recommendation.

If research runs before requirement creation, keep requirement assumptions clearly labeled as assumptions in `research.md`; do not treat them as approved requirements until the requirement phase confirms them.

Route sources as follows:

- GitHub repository URL: use DeepWiki MCP to investigate the repository.
- Ordinary URL: use Browser to open and inspect the page and relevant linked pages.
- Local code or docs: inspect relevant files, tests, configs, and project docs.
- Pasted notes: extract facts, constraints, approved working decisions, risks, and unknowns that must be resolved before writing.

Read `references/source-routing.md` and `references/research-template.md` before writing this file.

### Acceptance

Generate `acceptance.md` and `acceptance-human.md` from `requirement.md` and `research.md` when available. `acceptance.md` is the complete AI-facing contract. `acceptance-human.md` is the concise human-facing brief.

Use `3W1H` to ensure acceptance captures why each major risk or behavior must be verified, what will be checked, who or what performs the check, and how pass/fail will be determined.

Use stable IDs for acceptance points so `write-plan` can map tasks to them later. The same IDs and the same numbered order must appear in both acceptance files. Do not invent task IDs in `acceptance.md`; task-to-acceptance and task-to-manual-check mapping belongs in `plan.md` and `tasks.yaml` after task splitting.

Read `references/acceptance-template.md` before writing these files.

### Roadmap

Generate `roadmap.md` from `requirement.md`, `research.md`, and `acceptance.md` when available. Start with a concise numbered human summary, then include phases, task breakdown, dependencies, milestones, validation tasks, and risk mitigations.

Use `3W1H` to ensure the roadmap captures why the sequence is chosen, what work is included or deferred, who should execute or review each part, and how progress, validation, and risk handling will work.

Read `references/roadmap-template.md` before writing this file.

### Spec

Generate `spec.md` from `requirement.md`, `research.md`, and `roadmap.md` when available. Start with a concise numbered human summary, then include final implementation direction, module design, API/data design, process/state flow, errors, compatibility, migration, and test strategy.

Use `3W1H` to ensure the spec captures why this design is selected, what is being designed, who calls, integrates, maintains, or is affected by it, and how the implementation, error handling, migration, and tests should work.

Read `references/spec-template.md` before writing this file.

## Output Rules

- Write only converged results. Do not write brainstorming transcripts, process logs, or internal reasoning.
- Do not include "I considered..." or chronological exploration notes in output files.
- Do not write documents before the user approves the current phase draft, unless the user explicitly requests immediate drafting.
- Use `3W1H` to improve completeness, but do not force final documents to use `Why`, `What`, `Who`, and `How` headings.
- Follow the document audience contract: requirement and research are concise human-facing documents; acceptance writes both AI-facing and human-facing documents; roadmap and spec start with human-facing numbered summaries before detailed content.
- Do not write TBD, TODO, 待定, 待确认, unknown, open question, unresolved blocker, or empty placeholder sections into result files.
- If a missing answer would materially affect scope, acceptance, implementation, sequencing, ownership, data, compatibility, or risk, ask the user before drafting or writing.
- Non-blocking uncertainty may appear only as an approved working decision with rationale and a review trigger; it must not be framed as content still waiting for confirmation.
- Include rejected options only when they explain an important tradeoff.
- Preserve existing human-authored decisions unless the requirement changed or the user asks to rewrite.
- Do not silently invent facts. If a missing dependency changes confidence, stop and ask before writing.
- Keep each document useful as a standalone review artifact.
- Keep numbered human-facing points stable enough for the user to discuss as "1, 2, 3" in follow-up turns.

## Review

After writing the current document(s) and before asking the user to review them, read `references/review-rubric.md` and fix issues found in the generated document(s).

Always check and fix:

- Placeholders such as TBD, TODO, empty sections, and unresolved template text.
- Any 待定, 待确认, open question, unresolved blocker, or unknown content that should have been clarified before writing.
- Contradictions within a file or across generated files.
- Scope creep or requirements that should be split into a separate requirement.
- Ambiguous statements that could be interpreted more than one way.
- Missing phase-relevant `Why`, `What`, `Who`, or `How` information.
- Missing or mismatched human-facing numbered summaries required by the document audience contract.

For downstream phases, ensure:

- `research.md` supports the recommended direction in `spec.md` when research exists.
- `acceptance.md` covers major requirements from `requirement.md`.
- `acceptance-human.md` exists after the acceptance phase and maps one-to-one to `acceptance.md` by ID and numbered order.
- `roadmap.md` includes mitigations or validation tasks for high-risk findings.
- Output files contain results only, not the brainstorming process.

Only run cross-document checks for documents that already exist.

After the self-review passes, ask the user to inspect the written file(s). If they request changes, update the file(s), rerun the self-review, and ask for review again.
