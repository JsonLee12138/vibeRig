---
name: brainstorm
description: Run the VibeRig requirement brainstorming workflow from a requirement idea or name. Use when the user asks to brainstorm, create, research, validate, plan, or specify a requirement. The skill first explores project context and clarifies the user's intent through dialogue, one question at a time, then presents candidate approaches and a proposed design for user approval before writing any .vibeRig/requirements/name documents. After approval, it can create or update requirement.md, research.md, acceptance.md, roadmap.md, and spec.md without brainstorming transcripts.
---

# Brainstorm

Use this skill to turn a rough requirement idea into approved VibeRig result documents through collaborative dialogue.

The default behavior is conversation first. Do not create directories or write files until the user has approved the proposed requirement/design, unless the user explicitly asks to skip clarification and write a draft.

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

Treat `requirement.md` as the root requirement result. Generate the other files from it and from technical research after the requirement direction is approved.

Do not implement code as part of this skill. Stop at result documents.

## Core Gate

Before writing or updating any result file:

1. Explore local project context.
2. Ask clarifying questions one at a time until the user's goal, constraints, and success criteria are clear enough.
3. If upcoming decisions involve visual judgment, offer a visual companion in a standalone message before asking visual questions.
4. Propose 2-3 possible approaches with tradeoffs and a recommendation.
5. Present the converged requirement/design in sections and ask the user to confirm each section.
6. Ask the user to approve, revise, or reject the complete design.

Only after approval may you resolve/create `.vibeRig/requirements/<requirement-name>/` and write result documents.

If the user explicitly says to write immediately, create a draft but label uncertain content as assumptions and preserve open questions.

## Mode Parsing

Parse the user request into a requirement name and a mode.

Default mode: `full`.

Supported modes:

| Mode | User wording examples | Output |
|---|---|---|
| `full` | full, all, 全流程, 完整脑暴, 脑暴 `<name>` | `requirement.md`, `research.md`, `acceptance.md`, `roadmap.md`, `spec.md` |
| `requirement` | requirement, 需求, 创建需求, 整理需求 | `requirement.md` |
| `research` | research, 技术调研, 调研 | `research.md` |
| `acceptance` | acceptance, 验收, 测试验收 | `acceptance.md` |
| `roadmap` | roadmap, 路线, 任务拆分, 推进计划 | `roadmap.md` |
| `spec` | spec, 方案, 实现方案, 技术方案 | `spec.md` |

If the user only provides a requirement name, start the dialogue flow for `full`; do not immediately write files.

## Requirement Resolution

Run requirement resolution only after the Core Gate is approved, or when the user explicitly asks to inspect or update an existing requirement.

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
3. Decide whether visual discussion is likely.
   - Visual topics include UI layout, workflow diagrams, architecture diagrams, mockups, information hierarchy, and side-by-side design comparisons.
   - If yes, send a standalone message asking whether the user wants a visual companion for mockups, diagrams, comparisons, or other browser-rendered aids.
   - Do not combine the visual companion offer with context summaries, clarifying questions, or any other content.
   - If the user declines or no visual tool is available, continue text-only.
4. Ask clarifying questions one at a time.
   - Prefer multiple choice questions when it helps the user answer quickly.
   - Focus on purpose, users, constraints, scope boundaries, success criteria, non-goals, compatibility, and risk.
   - Do not bundle a long questionnaire into one response.
   - After each answer, decide whether another single question is needed or whether the design is clear enough.
5. Propose 2-3 approaches.
   - Lead with the recommended option.
   - Explain tradeoffs, risks, and what would be deferred.
6. Present the requirement/design in sections.
   - Scale detail to complexity.
   - Cover goals, non-goals, constraints, major behavior, affected modules or systems, acceptance direction, and open questions.
   - Ask after each section whether it looks right before presenting the next section.
   - If the user requests changes, revise that section and confirm it again.
7. Ask for approval before writing documents.
   - Summarize the approved sections and ask whether to write the requested VibeRig documents.
   - If the user requests changes, revise the summary and confirm the affected sections again.
   - If the user approves, continue to the Document Workflow.

## Document Workflow

1. Resolve or create the requirement directory.
2. Read existing result files that may affect the requested mode.
3. If `requirement.md` is missing, create it before any other phase.
4. Run the requested phase or phases:
   - `full`: requirement, research, acceptance, roadmap, spec.
   - `requirement`: requirement only.
   - `research`: requirement if missing, then research.
   - `acceptance`: requirement if missing, then acceptance.
   - `roadmap`: requirement if missing, then roadmap.
   - `spec`: requirement if missing, then spec.
5. Run document self-review and fix issues inline.
6. Ask the user to review the written files before treating brainstorming as complete.
7. Report the generated or updated file paths and any unresolved blockers.

## Phase Rules

### Requirement

Create or refine `requirement.md` as a converged requirement result based on the approved dialogue summary. Include goals, non-goals, candidate requirements, boundary questions, business rule assumptions, dependencies, constraints, source links, and open questions.

If the user explicitly asked to skip clarification and no source material exists beyond the requirement name, create a useful draft from the name and local project context. Mark inferred content as assumptions.

Read `references/requirement-template.md` before writing this file.

### Research

Generate `research.md` before using research conclusions in later phases. Route sources as follows:

- GitHub repository URL: use DeepWiki MCP to investigate the repository.
- Ordinary URL: use Browser to open and inspect the page and relevant linked pages.
- Local code or docs: inspect relevant files, tests, configs, and project docs.
- Pasted notes: extract facts, constraints, assumptions, risks, and unknowns.

Read `references/source-routing.md` and `references/research-template.md` before writing this file.

### Acceptance

Generate `acceptance.md` from `requirement.md` and `research.md` when available. Include automated acceptance, manual acceptance, boundary cases, risk scenarios, regression scenarios, and out-of-scope checks.

Read `references/acceptance-template.md` before writing this file.

### Roadmap

Generate `roadmap.md` from `requirement.md`, `research.md`, and `acceptance.md` when available. Include phases, task breakdown, dependencies, milestones, validation tasks, and risk mitigations.

Read `references/roadmap-template.md` before writing this file.

### Spec

Generate `spec.md` from `requirement.md`, `research.md`, and `roadmap.md` when available. Include final implementation direction, module design, API/data design, process/state flow, errors, compatibility, migration, and test strategy.

Read `references/spec-template.md` before writing this file.

## Output Rules

- Write only converged results. Do not write brainstorming transcripts, process logs, or internal reasoning.
- Do not include "I considered..." or chronological exploration notes in output files.
- Do not write documents before the user approves the requirement/design summary, unless the user explicitly requests immediate drafting.
- Label assumptions explicitly.
- Include rejected options only when they explain an important tradeoff.
- Preserve existing human-authored decisions unless the requirement changed or the user asks to rewrite.
- Do not silently invent facts. If a missing dependency changes confidence, write an assumption or open question.
- Keep each document useful as a standalone review artifact.

## Review

After writing documents and before asking the user to review them, read `references/review-rubric.md` and fix issues found in the generated documents.

Always check and fix:

- Placeholders such as TBD, TODO, empty sections, and unresolved template text.
- Contradictions within a file or across generated files.
- Scope creep or requirements that should be split into a separate requirement.
- Ambiguous statements that could be interpreted more than one way.

For `full`, ensure:

- `research.md` supports the recommended direction in `spec.md`.
- `acceptance.md` covers major requirements from `requirement.md`.
- `roadmap.md` includes mitigations or validation tasks for high-risk findings.
- Output files contain results only, not the brainstorming process.

After the self-review passes, ask the user to inspect the written files. If they request changes, update the files, rerun the self-review, and ask for review again.
