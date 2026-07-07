---
name: agent-creator
description: Create or update custom subagent files for Codex (`.codex/agents/*.toml`), Claude Code (`.claude/agents/*.md`), and/or Cursor (`.cursor/agents/*.md`). Use when the user asks to create, design, review, or refine a subagent/custom agent for any of these platforms, define agent task boundaries, choose model/permission settings, add preferred skill dependency guidance, or port an existing subagent to another platform.
---

# Agent Creator

Create subagents from one provider-agnostic spec, then render that spec into each target platform's native format. Never write a platform's native file by hand from scratch — always go through the intermediate JSON spec first, so the same role boundary and instructions stay consistent across Codex, Claude Code, and Cursor.

## Capability Matrix

| Capability | Codex | Claude Code | Cursor |
|---|---|---|---|
| File format | TOML | Markdown + YAML frontmatter | Markdown + YAML frontmatter |
| Project location | `.codex/agents/<name>.toml` | `.claude/agents/<name>.md` | `.cursor/agents/<name>.md` |
| `model` field | Yes | Yes | Yes (default `inherit`) |
| Per-agent MCP servers | Yes — `mcp_servers` tables | Yes — `mcpServers` list | **No** — always inherits the parent's MCP servers; see [cursor-platform.md](./references/cursor-platform.md) for the `.cursor/mcp.json` workaround |
| Tool/write restriction | `sandbox_mode` | `tools` / `disallowedTools` | `readonly` boolean only |

Full per-platform field mapping, ordering rules, and gotchas live in their own reference file — read the one for each target you're rendering before writing that file:

- [references/codex-platform.md](./references/codex-platform.md)
- [references/claude-platform.md](./references/claude-platform.md)
- [references/cursor-platform.md](./references/cursor-platform.md)

## Contract

Use this skill to create, update, review, or port one subagent definition across Codex, Claude Code, and/or Cursor.

Do not use this skill for normal `SKILL.md` packages; redirect to `skill-builder` mid-task if this comes up during execution. Do not install skills, publish agents, or change global settings (Codex `config.toml` `[agents]`, Claude Code `settings.json`) unless the user explicitly asks.

Stop and ask when:
- The target platform(s) cannot be inferred from the request or the repo (see Step 2) — do not guess and render to the wrong directory.
- The user requests write/edit permission but the described agent responsibility is read-only or analytical — confirm intent before rendering.
- Skill dependencies are relevant but no skill identifiers are given and `find-skills` returns ambiguous candidates.
- Rendering to Cursor requires MCP servers, which means writing to the shared `.cursor/mcp.json` — confirm the server list and merge plan with the user before writing, since that file affects every agent in the project, not just this one (see [cursor-platform.md](./references/cursor-platform.md)).

## Input Contract

Resolve these inputs from the user request or nearby repository conventions:

- Agent name and single responsibility.
- Target platform(s): Codex, Claude Code, Cursor, or more than one.
- Target path, defaulting to the project-level directory for each target (see the Capability Matrix above); use the user-level directory only when the user asks for a global agent.
- Whether the task is create, update, review, or port-to-another-platform.
- Permission boundary: read-only versus write/edit.
- Model preference, defaulting to `inherit`.
- Useful preferred skills, if the agent's job has repeatable capabilities.
- MCP servers the agent needs, if any (renders directly for Codex and Claude Code; for Cursor, renders into `.cursor/mcp.json` instead — see [cursor-platform.md](./references/cursor-platform.md)).

If preferred skills are relevant but unspecified, use `find-skills` to propose candidates and ask the user before adding them.

## Output Contract

Produce or report:

- The path to the intermediate JSON spec (scratchpad, not committed).
- Each native file path created, updated, or reviewed, one per target.
- The role boundary captured (Mission / Scope / Output).
- Model and permission settings applied per target.
- MCP servers rendered per target, including any `.cursor/mcp.json` entries added or merged for Cursor.
- Preferred skill guidance added or intentionally omitted.
- Validation evidence and any unresolved risks.

Do not claim completion unless every rendered file uses only that platform's supported fields and the agent has one clear job.

## Workflow

1. **Clarify the job.** Get the agent's mission, scope boundary, permission level, model, and any MCP/skill needs from the user.
2. **Resolve target platform(s).** Check the request for explicit signals (a named platform, a `.codex/agents/`, `.claude/agents/`, or `.cursor/agents/` path, or a caller convention like `update-team`'s Codex-only usage). If none of these resolve it and more than one platform's agent directory already exists in the repo, ask which target(s) to render. Default to Codex only when the repo already has `.codex/agents/` and no other agent directory, and the request gives no other signal.
3. **Write the intermediate spec.** Copy [agent-spec.template.json](./assets/agent-spec.template.json) to a scratch path, fill every field from step 1, and set `targets` to the resolved platform list. This JSON is the single source of truth — do not diverge between platform files after this point.
4. **Use `find-skills`** to identify useful skills when skill dependencies are relevant, and confirm selections with the user before adding them to `skill_dependencies`.
5. **Render each target** from the spec using its dedicated template and reference file:
   - Codex → [codex-agent-template.toml](./assets/codex-agent-template.toml) + [codex-platform.md](./references/codex-platform.md)
   - Claude Code → [claude-agent-template.md](./assets/claude-agent-template.md) + [claude-platform.md](./references/claude-platform.md)
   - Cursor → [cursor-agent-template.md](./assets/cursor-agent-template.md) + [cursor-platform.md](./references/cursor-platform.md) — if `mcp_servers` is non-empty, this also means merging entries into `.cursor/mcp.json` (confirm with the user first; see Contract).
6. **Verify** each rendered file contains no fields unsupported by that platform, and that the role boundary (`Mission`/`Scope`/`Output`) is present and identical in substance across targets.

## Field Rules

- Use `name` as the shared identifier across all rendered targets; prefer snake_case for Codex, lowercase-hyphen for Claude Code and Cursor.
- Make `description` human-facing and specific about when to delegate to this agent.
- Keep the Mission narrow — one or two sentences. If it needs more, the job is two agents.
- Every `Scope` must have a `Not allowed:` list. This is the boundary enforcement; without it any adjacent task can bleed into the role at runtime.
- Use `extra_sections` (optional) only for domain content that doesn't fit Mission/Scope/Inputs/Output — a review framework, severity table, or fixed workflow steps. Render each entry as its own `##` heading between `Scope` and `Inputs`, identically across all rendered targets. Omit the field when the role needs nothing beyond the standard sections.
- Set read-only permission for exploration, review, or analysis-only agents; write/edit permission only when the agent is expected to modify files.
- Do not raise global settings (Codex `[agents]` `max_depth`, etc.) unless the user explicitly asks.
- Do not add custom/unsupported fields to any platform file — see the Capability Matrix and each platform's reference file for what it actually accepts.

## Skill Dependency Guidance

Use `find-skills` before adding preferred skills unless the user already gave exact skill identifiers. Present candidates with: skill identifier, short reason it fits this agent, and whether it's required or optional. After confirmation, list them in the spec's `skill_dependencies` and let them render into each target's `Skill Dependencies` section. Do not install missing skills during creation. Do not use Codex's `[[skills.config]]` hard-binding by default — this skill favors instruction-level guidance for portability across platforms.

## Red Flags

Observable signs of a quality problem — fix before finishing:

- A native file was written directly, skipping the JSON spec → the platforms will drift apart on the next update.
- `Scope` has no `Not allowed:` list.
- Mission is more than two sentences → split into two agents.
- Write/edit permission is set but `Not allowed:` doesn't name files or paths the agent must not touch.
- `Output` is absent or vague ("return the result").
- Cursor file contains `mcp_servers` / `mcpServers` — Cursor has no per-agent MCP scoping; this field is silently ignored or invalid.
- `.cursor/mcp.json` was overwritten instead of merged, dropping unrelated existing servers.
- Codex file has `mcp_servers` placed before `developer_instructions` (see [codex-platform.md](./references/codex-platform.md) for the silent-failure mechanism).
- `Skill Dependencies` lists skills the user did not confirm.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "I'll just write the Claude file directly, it's simpler" | Without the JSON spec, the next edit only updates one platform and the others silently drift out of sync. |
| "Cursor probably supports per-agent MCP too, I'll add it" | It doesn't — check the Capability Matrix, don't assume feature parity across platforms. Use `.cursor/mcp.json` instead. |
| "I'll just overwrite .cursor/mcp.json with what this agent needs" | That file is shared by every agent and session in the project. Merge in new entries and confirm with the user first — never overwrite it. |
| "The Mission is clear, I don't need a Scope section" | Mission says what the agent does. Scope says what it must refuse. Without `Not allowed:`, adjacent tasks bleed in at runtime. |
| "workspace-write / readonly:false is fine, the agent is smart enough" | Smart is not a safety boundary. Name the excluded paths explicitly in `Not allowed:`. |
| "I'll add a few extra skills just in case" | Only list skills the user confirmed. Unconfirmed skills mislead the runtime about actual capabilities. |
| "This file has no unsupported fields, I can see that visually" | Run the validation grep — visual review misses subtle cases like Codex's table-ordering bug. |

## Validation

Before finishing, verify per rendered target:

```bash
# Codex: no custom/unsupported fields, and no field-ordering bug
grep -En "^\[skills\]|^recommended_skills|^scope\s*=|^inputs\s*=|^outputs\s*=|^boundaries" *.toml && echo "INVALID FIELDS FOUND" || echo "ok"

# Cursor: must never declare per-agent MCP scoping
grep -En "^mcp_servers|^mcpServers" .cursor/agents/*.md 2>/dev/null && echo "UNSUPPORTED MCP FIELD FOUND" || echo "ok"

# Cursor: .cursor/mcp.json, if written, must be valid and merged
python3 -c "import json; json.load(open('.cursor/mcp.json'))" 2>/dev/null && echo "mcp.json valid" || echo "no .cursor/mcp.json in this render — expected only if the spec needed MCP servers"
```

- The intermediate JSON spec exists and every rendered file traces back to it (no hand-written divergence).
- The agent has one clear job (Mission is ≤2 sentences) on every target it was rendered to.
- Read-only agents have no file-edit instructions in the body; editing agents have explicit path exclusions in `Not allowed:`.
- `model` is set consistently with the spec across all rendered targets (or correctly omitted where the platform default already matches).
- MCP servers render as native fields for Codex/Claude Code; for Cursor they're merged into `.cursor/mcp.json` (with user confirmation) and referenced from the agent body instead.
- Every listed skill dependency was confirmed by the user before being added.
