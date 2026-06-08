---
name: skill-builder
description: Create or update Agent Skills/Codex skills with reliable trigger descriptions, concise SKILL.md workflows, progressive disclosure, reusable scripts/references/assets, and validation checklists. Use when the user asks to design, create, refine, audit, or troubleshoot a skill, SKILL.md file, or reusable agent workflow package.
---

# Skill Builder

Create skills as focused, reusable workflow packages. A good skill is not a long prompt; it is a small playbook with a precise trigger, clear execution contract, optional reusable resources, and validation evidence.

## Contract

Use this skill when creating, updating, reviewing, or troubleshooting an Agent Skills-compatible `SKILL.md` package.

Do not use this skill for:
- General prompt writing that will not become a reusable skill.
- Creating custom subagent TOML files; use an agent-specific creator skill instead.
- Installing, publishing, or globally syncing skills unless the user explicitly asks.

Stop and ask only when the skill's target job, target location, or required proprietary/source material cannot be inferred safely. Otherwise make conservative assumptions and proceed.

## Input Contract

Prefer these inputs:
- Skill name or intended capability.
- Target directory, such as `skills/`, `.codex/skills/`, or `~/.codex/skills/`.
- Real user requests that should trigger the skill.
- Real user requests that should not trigger the skill.
- Existing docs, code, runbooks, templates, scripts, or previous failures to encode.

If examples are missing, draft 3-5 realistic trigger examples from the user's goal and use them to shape the skill. Do not block on examples unless the domain is high risk or proprietary details are required.

## Output Contract

Produce the skill files directly when the user asks to create or update a skill. Return:
- Changed file paths.
- The trigger intent captured in `description`.
- Any resources intentionally added or omitted.
- Validation performed and remaining gaps.

Do not claim the skill is complete unless the `SKILL.md` frontmatter is valid, the body has no unresolved placeholders, and the skill can be discovered from the requested location.

## Workflow

1. Inspect local conventions.
   - Check nearby skills for naming, directory structure, metadata, and optional `agents/openai.yaml` style.
   - Preserve local conventions unless they conflict with the Agent Skills format.
2. Define the reusable job.
   - State one primary responsibility.
   - Identify clear exclusions so the skill does not become a catch-all workflow.
3. Write the trigger first.
   - Put all activation guidance in frontmatter `description`.
   - Describe user intent, task contexts, symptoms, file types, tools, and risk signals.
   - Include key terms users naturally say.
   - Do not summarize the whole internal workflow in the description.
4. Choose the resource plan.
   - Keep core workflow, critical gotchas, and validation rules in `SKILL.md`.
   - Put detailed API docs, framework variants, schemas, and long examples in one-level `references/` files.
   - Put deterministic or repeatedly rewritten logic in `scripts/`.
   - Put output templates, boilerplate, images, fonts, or copied files in `assets/`.
   - Do not add README, install guides, changelogs, or process notes unless the user explicitly requires them.
5. Write `SKILL.md`.
   - Keep it concise and imperative.
   - Prefer concrete procedures, defaults, and checklists over broad principles.
   - Match specificity to risk: flexible guidance for judgement tasks, exact commands/scripts for fragile operations.
6. Validate.
   - Check frontmatter has `name` and `description`.
   - Confirm `name` matches the directory and uses lowercase hyphenated naming.
   - Confirm no unresolved placeholders remain.
   - Confirm all referenced files exist and are linked directly from `SKILL.md`.
   - Confirm any bundled scripts are non-interactive and have clear usage or `--help`.

## Recommended SKILL.md Shape

Use this structure for development-oriented skills unless local convention suggests a better fit:

```markdown
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
```

## Development Skill Rules

For skills that guide coding agents:
- Require the agent to read the codebase before editing.
- Require following existing project patterns, helper APIs, dependency choices, and test style.
- Protect unrelated user changes; never instruct broad reverts.
- Require an explicit test decision rather than forcing tests for every task.
- Require evidence: commands run, pass/fail state, key errors, skipped checks, and residual risk.
- Prefer scoped changes over opportunistic refactors.
- For high-risk work, use plan-validate-execute: write a short plan or mapping, validate it against the source of truth, then execute.

## Trigger Quality Checks

Before finishing, test the `description` mentally against:
- Should trigger: 3-5 realistic user prompts that need this skill.
- Should not trigger: 3-5 adjacent prompts that should stay with another skill or normal agent behavior.

Revise the description if it is too broad, too vague, or missing words users would naturally say.

## Common Anti-Patterns

- Generic descriptions such as `Helps with coding`.
- A description that contains the whole workflow instead of activation guidance.
- A `SKILL.md` that explains common concepts the model already knows.
- One skill covering unrelated domains such as coding, deployment, design, PRs, and sales.
- Missing input contract, output contract, stop conditions, or validation rules.
- Deep reference chains where `SKILL.md` links to a file that links to another file.
- Rewriting repeated fragile logic in prose instead of providing a tested script.
- Presenting many equal options without a default.
- Claiming completion without verification evidence.
