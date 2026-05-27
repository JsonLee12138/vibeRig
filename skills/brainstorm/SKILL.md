---
name: brainstorm
description: Run the VibeRig requirement brainstorming workflow from a requirement name. Use when the user asks to brainstorm, create, research, validate, plan, or specify a requirement under .vibeRig/requirements/name. The skill locates or creates the requirement directory, supports full and phase-specific modes, reads or writes requirement.md, performs technical research with DeepWiki MCP for GitHub repositories and Browser for ordinary URLs, and writes converged result documents requirement.md, research.md, acceptance.md, roadmap.md, and spec.md without brainstorming transcripts.
---

# Brainstorm

Use this skill to turn one VibeRig requirement name into formal requirement result documents.

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

Treat `requirement.md` as the root requirement result. Generate the other files from it and from technical research.

Do not implement code as part of this skill. Stop at result documents.

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

If the user only provides a requirement name, run `full`.

## Requirement Resolution

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

## Workflow

1. Parse requirement name and mode.
2. Resolve or create the requirement directory.
3. Read existing result files that may affect the requested mode.
4. If `requirement.md` is missing, create it before any other phase.
5. Run the requested phase or phases:
   - `full`: requirement, research, acceptance, roadmap, spec.
   - `requirement`: requirement only.
   - `research`: requirement if missing, then research.
   - `acceptance`: requirement if missing, then acceptance.
   - `roadmap`: requirement if missing, then roadmap.
   - `spec`: requirement if missing, then spec.
6. Run cross-document review for generated files. In `full`, review all five documents together.
7. Report the generated or updated file paths and any unresolved blockers.

## Phase Rules

### Requirement

Create or refine `requirement.md` as a converged requirement result. Include goals, non-goals, candidate requirements, boundary questions, business rule assumptions, dependencies, constraints, source links, and open questions.

If no source material exists beyond the requirement name, still create a useful draft from the name and local project context. Mark inferred content as assumptions.

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
- Label assumptions explicitly.
- Include rejected options only when they explain an important tradeoff.
- Preserve existing human-authored decisions unless the requirement changed or the user asks to rewrite.
- Do not silently invent facts. If a missing dependency changes confidence, write an assumption or open question.
- Keep each document useful as a standalone review artifact.

## Review

Before finishing, read `references/review-rubric.md` and fix issues found in the generated documents.

For `full`, ensure:

- `research.md` supports the recommended direction in `spec.md`.
- `acceptance.md` covers major requirements from `requirement.md`.
- `roadmap.md` includes mitigations or validation tasks for high-risk findings.
- Output files contain results only, not the brainstorming process.
