---
name: agent-creator
description: Create or update Codex custom subagent TOML files under `.codex/agents/` or `~/.codex/agents/`. Use when the user asks to create, design, review, or refine a Codex subagent/custom agent, define agent task boundaries, choose model/sandbox settings, or add preferred skill dependency guidance for runtime use.
---

# Agent Creator

Create Codex custom agents using the official custom agent TOML schema. Keep the file compatible with Codex by writing only supported top-level config keys, and put role boundaries, operating rules, and preferred skill dependencies inside `developer_instructions`.

## Contract

Use this skill to create, update, or review one Codex custom subagent TOML file.

Do not use this skill for normal `SKILL.md` packages; use `skill-builder` for skill creation or skill edits. Do not install skills, publish agents, or change global Codex settings unless the user explicitly asks.

Stop and ask when the target agent job, write location, destructive permission, or required credentials cannot be inferred safely.

## Input Contract

Resolve these inputs from the user request or nearby repository conventions:

- Agent name and single responsibility.
- Target path, defaulting to `.codex/agents/` for project-local agents or `~/.codex/agents/` only when the user asks for a global agent.
- Whether the task is create, update, or review.
- Runtime boundary, including read-only versus editing behavior.
- Useful preferred skills, if the agent's job has repeatable capabilities.

If preferred skills are relevant but unspecified, use `find-skills` to propose candidates and ask the user before adding them to `developer_instructions`.

## Output Contract

Produce or report:

- The TOML file path created, updated, or reviewed.
- The official Codex fields used.
- The role boundary captured in `developer_instructions`.
- Preferred skill guidance added or intentionally omitted.
- Validation evidence and any unresolved risks.

Do not claim completion unless the TOML uses supported fields only and the agent has one clear job.

## Workflow

1. Clarify the agent's job, target location, and whether the user wants a new file or an update.
2. Generate or review only official custom agent fields:
   - `name`
   - `description`
   - `developer_instructions`
   - `nickname_candidates`
   - `model`
   - `model_reasoning_effort`
   - `sandbox_mode`
   - `mcp_servers`
   - other supported Codex `config.toml` keys when clearly needed
3. Define the role boundary inside `developer_instructions`.
4. Use `find-skills` to identify useful skills for the agent's job when skill dependencies are relevant.
5. Ask the user which recommended skills should be listed as preferred skills.
6. Add selected skill guidance only inside the `Skill Dependencies` section of `developer_instructions`.
7. Create or update the TOML file, then check that it contains no custom schema fields.

## Field Rules

- Use `name` as the Codex agent identifier; prefer snake_case.
- Match the filename to the agent name when practical, using hyphenated filenames if that is the local convention.
- Make `description` human-facing and specific about when to use the agent.
- Keep `developer_instructions` narrow, operational, and enforceable.
- Set `sandbox_mode = "read-only"` for exploration, review, documentation research, or analysis-only agents.
- Use `sandbox_mode = "workspace-write"` only when the agent is expected to edit project files.
- Leave `model`, `model_reasoning_effort`, and MCP settings unset when inheritance from the parent session is sufficient.
- Do not raise global `[agents]` settings such as `max_depth` unless the user explicitly asks.
- Do not add custom fields such as `[skills]`, `recommended_skills`, `scope`, `inputs`, `outputs`, or `boundaries` to the TOML.

## Developer Instructions Contract

Write `developer_instructions` with these sections when applicable:

```text
## Mission
State the agent's single primary responsibility.

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

## Escalation
Define what must be handed back to the parent agent.

## Skill Dependencies
Preferred skills for this agent:
- owner/repo@skill-name: Explain when to use it.

Skill resolution policy:
- Treat listed skills as preferred capabilities, not mandatory startup dependencies.
- Do not install skills during agent creation.
- When a task requires a listed skill and it is not available locally, use find-skills to locate it.
- Runtime installation is allowed only at project level.
- Never perform global skill installation from this subagent.
- If the skill cannot be installed or found, report the limitation and continue best-effort.
```

Omit sections that do not apply, but keep `Mission`, `Scope`, and `Output` for every agent.

## Skill Dependency Guidance

Use `find-skills` before adding preferred skills unless the user already gave exact skill identifiers. Present candidate skills with:

- skill identifier
- short reason it fits this agent
- whether it is required for core work or optional for better execution

After the user confirms selections, list them in `developer_instructions` under `Skill Dependencies`. Do not install missing skills during creation unless the user explicitly asks. Do not write `[[skills.config]]` by default; this skill favors instruction-level compatibility over hard binding.

## TOML Template

```toml
name = "agent_name"
description = "Use for a narrow, specific subagent responsibility."
sandbox_mode = "read-only"

developer_instructions = """
## Mission
Own one narrow responsibility.

## Scope
Allowed:
- Do the assigned work.

Not allowed:
- Do adjacent work outside this role.
- Spawn additional agents unless the parent explicitly asks.

## Inputs
Expect the parent agent to provide the task, relevant files or context, and expected output.

## Output
Return concise findings, file references when relevant, validation performed, and remaining risks.

## Stop Conditions
Stop and report when the task is complete, blocked, out of scope, or requires approval.

## Escalation
Hand back destructive operations, broad scope changes, missing credentials, production impact, or unclear requirements.

## Skill Dependencies
Preferred skills for this agent:
- owner/repo@skill-name: Use when the task needs that capability.

Skill resolution policy:
- Treat listed skills as preferred capabilities, not mandatory startup dependencies.
- Do not install skills during agent creation.
- When a task requires a listed skill and it is not available locally, use find-skills to locate it.
- Runtime installation is allowed only at project level.
- Never perform global skill installation from this subagent.
- If the skill cannot be installed or found, report the limitation and continue best-effort.
"""
```

## Validation

Before finishing, verify:

- The agent has one clear job.
- Read-only agents cannot edit code.
- Editing agents are scoped to small, defensible changes.
- `developer_instructions` includes explicit allowed and not-allowed work.
- Output expectations are concrete enough for the parent agent to summarize.
- Skill dependencies are only instructions, not custom TOML fields.
- Missing skills are resolved at runtime, project-level only, never globally by default.
