---
name: <skill-name>
description: Use when <specific user intents, task contexts, symptoms, file types, tools, or risk signals>. Include key terms, but do not summarize the whole workflow.
---

# <Skill Name>

## Contract
Use this skill to <single responsibility>.
Do not use this skill for <clear exclusions>.
Stop and report when <blocking conditions>.

## Input Contract
Required:
- <file/path/tool/context>
- <acceptance criteria or target behavior>

Optional:
- <logs, diffs, screenshots, configs>

If required inputs are missing, <inspect, infer, or stop>.

## Output Contract
Return or produce:
- <artifact/change/report>
- <verification evidence>
- <residual risks or skipped checks>

Do not claim completion unless <minimum evidence> exists.

## Workflow
1. Inspect current state and local patterns.
2. Identify scope, constraints, and protected files.
3. Choose the path; read only the needed reference files.
4. Execute the smallest scoped change or analysis.
5. Validate with tests, scripts, build, lint, smoke checks, or manual checks.
6. If validation fails, loop through error, hypothesis, fix, and rerun.
7. Report concise evidence.

## Context Loading
Read only when needed:
- `references/<topic>.md`: read when <condition>.
- `assets/<template>/`: use when creating <artifact>.

Avoid loading all references at once.

## Scripts
Available scripts:
- `scripts/<name>.py`: <purpose>. Run `python scripts/<name>.py --help`.

Prefer executing scripts over reimplementing their logic.

## Validation
Minimum checks:
- <unit test/lint/build/typecheck/smoke/manual>

If a check cannot run, report why and what risk remains.

## Common Mistakes
- <bad shortcut> -> <correct behavior>.
