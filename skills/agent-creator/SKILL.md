---
name: agent-creator
description: Create or update Cursor subagent Markdown files under `agents/` or `.cursor/agents/`. Use when the user asks to create, design, review, or refine a Cursor subagent, define agent task boundaries, choose model or readonly/background settings. Do not use for SKILL.md packages; redirect to skill-builder.
---

# Agent Creator

Create Cursor subagents using the official Markdown + YAML frontmatter format. Each agent is a `.md` file with optional frontmatter fields and a prompt body that defines the agent's role, boundaries, and operating rules.

## Contract

Use this skill to create, update, or review one Cursor subagent Markdown file.

Do not use this skill for `SKILL.md` packages; redirect to `skill-builder` mid-task if this comes up. Do not install skills, publish agents, or change global Cursor settings unless the user explicitly asks.

Stop and ask when the target agent job, write location, or `readonly` / `is_background` intent cannot be inferred safely.

## Input Contract

Resolve from user request or nearby repository conventions:

- Agent name and single responsibility.
- Target path: `agents/` for plugin-bundled agents, `.cursor/agents/` for project-level agents outside the plugin.
- Whether the task is create, update, or review.
- Runtime boundary: `readonly: true` for analysis/review agents, omit (default `false`) for editing agents.
- Whether the agent should run non-blocking in background (`is_background: true`).

## Output Contract

Produce or report:

- The Markdown file path created, updated, or reviewed.
- Frontmatter fields used.
- The role boundary captured in the prompt body.
- Validation evidence and any unresolved risks.

Do not claim completion unless the frontmatter is valid YAML, the prompt body is non-empty, and the agent has one clear job.

## Field Schema

| Field | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `name` | string | No | Generated from filename | Display name and identifier (lowercase, hyphens) |
| `description` | string | No | — | Helps Cursor decide when to delegate to this agent |
| `model` | string | No | `inherit` | `inherit` or a specific model ID |
| `readonly` | boolean | No | `false` | Restricts file edits and state-changing commands when `true` |
| `is_background` | boolean | No | `false` | Runs without blocking parent when `true` |

## Workflow

1. Clarify the agent's job, target location, and whether the user wants a new file or an update.
2. Determine frontmatter: set `readonly: true` for analysis/review roles; set `description` to help automatic routing; leave `model` as `inherit` unless the user specifies a model.
3. Write the prompt body using [agent-template.md](./assets/agent-template.md) as starting point. Fill each section and remove sections that do not apply. Always keep `Mission`, `Scope`, and `Output`.
4. Verify: no placeholder content, Mission ≤ 2 sentences, `Not allowed:` list present under Scope.

## Prompt Body Contract

```text
## Mission
State the agent's single primary responsibility (≤ 2 sentences).

## Scope
Allowed:
- ...

Not allowed:
- ...

## Inputs
List what the parent agent should provide.

## Output
Define the result format the parent agent should expect.

## Stop Conditions
Define when the agent should stop and report instead of continuing.
```

## Red Flags

- `readonly` omitted or `false` but `Not allowed:` does not name files/paths the agent must not touch → add explicit exclusions.
- `Mission` is more than two sentences → the agent has more than one job; split it.
- `Output` section is absent or vague ("return the result") → the parent cannot reliably consume it.
- `is_background: true` on an agent that edits files → background agents cannot confirm destructive operations interactively.

## Validation

```bash
# Frontmatter parses as YAML and prompt body is non-empty
head -20 agents/<name>.md

# No stale TOML fields
grep -n "developer_instructions\|sandbox_mode\|mcp_servers" agents/*.md 2>/dev/null && echo "STALE FIELDS" || echo "ok"
```

- [ ] Agent has one clear job (Mission ≤ 2 sentences).
- [ ] `readonly: true` agents have no file-edit instructions in prompt body.
- [ ] `Output` expectations are concrete enough for the parent to summarize.
- [ ] Every listed stop condition is actionable.
