# Codex Rendering Rules

Render an [agent-spec.template.json](../assets/agent-spec.template.json) into a Codex custom subagent using [codex-agent-template.toml](../assets/codex-agent-template.toml).

## File

| | |
|---|---|
| Format | TOML |
| Project location | `.codex/agents/<name>.toml` |
| User location | `~/.codex/agents/<name>.toml` |
| Required fields | `name`, `description`, `developer_instructions` |

## Field mapping

- `name` → `name`, snake_case, matches filename when practical.
- `description` → `description`, human-facing, specific about when Codex should pick this agent.
- `mission` / `scope_allowed` / `scope_not_allowed` / `inputs` / `output` / `stop_conditions` / `escalation` / `skill_dependencies` → assembled into the `developer_instructions` string, same section structure as the template (`## Mission`, `## Scope`, ...).
- `model` → `model`. Omit the field entirely when the spec value is `"inherit"` — Codex has no `inherit` keyword, it simply falls back to the parent session's model when the key is absent.
- `permission` → `sandbox_mode`: `"read-only"` for read-only, `"workspace-write"` for write.
- `mcp_servers` (non-empty) → one `[mcp_servers.<name>]` table per server, using the fields from the spec entry's `config` (e.g. `command`, `args`, `url`).

## Field ordering (critical)

Write every top-level scalar key — including the multi-line `developer_instructions` — before any `[table]` header. Place `mcp_servers` and `skills.config` at the **end** of the file.

If `mcp_servers` is placed above `developer_instructions`, Codex reads `developer_instructions` as `mcp_servers.<name>.developer_instructions` and the agent silently loses its instructions. The file still parses with no error — this fails silently, not loudly.

Wrong (table before the scalar key — `developer_instructions` is swallowed by `[mcp_servers.example.env]`):

```toml
name = "example_agent"
sandbox_mode = "read-only"

[mcp_servers.example]
command = "/usr/local/bin/npx"

[mcp_servers.example.env]
EXAMPLE_MODEL = "example-model"

# BUG: parsed as mcp_servers.example.env.developer_instructions, not top-level
developer_instructions = """
## Mission
This text never reaches Codex as the agent's instructions.
"""
```

Correct (every top-level scalar key first, `[mcp_servers.*]` tables last):

```toml
name = "example_agent"
sandbox_mode = "read-only"

developer_instructions = """
## Mission
Own one narrow responsibility.
"""

# Table blocks LAST. Anything below this point belongs to a table, not the top level.
[mcp_servers.example]
command = "/usr/local/bin/npx"

[mcp_servers.example.env]
EXAMPLE_MODEL = "example-model"
```

## Do not

- Add custom fields (`[skills]`, `recommended_skills`, `scope`, `inputs`, `outputs`, `boundaries`) — Codex ignores or errors on them.
- Touch global `[agents]` settings (`max_threads`, `max_depth`, `job_max_runtime_seconds`) in the per-agent file — those live in `config.toml` and are out of scope unless the user explicitly asks.
- Use `[[skills.config]]` hard-binding by default — prefer instruction-level guidance in `developer_instructions` for portability across platforms.

## Validation

```bash
grep -En "^\[skills\]|^recommended_skills|^scope\s*=|^inputs\s*=|^outputs\s*=|^boundaries" *.toml && echo "INVALID FIELDS FOUND" || echo "ok"
```

- `mcp_servers` / `skills.config` tables appear after `developer_instructions` in file order.
- `sandbox_mode = "workspace-write"` only when the role is genuinely expected to edit files, with excluded paths named in `Not allowed:`.
