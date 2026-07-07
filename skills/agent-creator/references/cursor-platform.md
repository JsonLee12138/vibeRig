# Cursor Rendering Rules

Render an [agent-spec.template.json](../assets/agent-spec.template.json) into a Cursor subagent using [cursor-agent-template.md](../assets/cursor-agent-template.md).

## File

| | |
|---|---|
| Format | Markdown with YAML frontmatter |
| Project location | `.cursor/agents/<name>.md` |
| User location | `~/.cursor/agents/<name>.md` |
| Required fields | None — `name` and `description` are optional (Cursor generates `name` from the filename), but set both explicitly for parity with the Codex/Claude renders of the same spec. |

## Field mapping

- `name` → `name`, lowercase-hyphen.
- `description` → `description`, shown in the Task tool tooltip; specific about when to delegate.
- `model` → `model`: `inherit` (default) or a specific model ID.
- `permission` → `readonly`: `true` for read-only, `false` for write. This is the only tool restriction Cursor exposes for subagents — coarse boolean, no allow/deny list like Codex or Claude.
- `is_background` → only set when the user explicitly wants non-blocking execution.
- `mission` / `scope_allowed` / `scope_not_allowed` / `inputs` / `output` / `stop_conditions` / `escalation` / `skill_dependencies` → Markdown body, same `## Mission` / `## Scope` / ... structure as the template.

## MCP servers: no per-agent scoping — use project `.cursor/mcp.json` instead

Cursor subagents always inherit the parent agent's tools, including MCP tools, and there is no field to scope MCP servers to one subagent. Never write `mcp_servers` or `mcpServers` into the subagent frontmatter — Cursor does not read it there.

If the spec's `mcp_servers` is non-empty and `cursor` is a render target, give the role access by registering the servers in the shared MCP config instead of the agent file:

1. **Location**: `.cursor/mcp.json` at the project root for project-scoped servers, or `~/.cursor/mcp.json` for user-level. Match the scope of the subagent file you're rendering (project agent → project `mcp.json`; user agent → user `mcp.json`).
2. **Schema**: top-level `"mcpServers"` object keyed by server name.
   - stdio server: `{"type": "stdio", "command": "...", "args": [...], "env": {...}}`
   - remote server: `{"url": "...", "headers": {...}}`
3. **Merge, don't overwrite**: read the existing file if present (scaffold `{"mcpServers": {}}` if absent), add or update only the entries for the servers this spec needs, and preserve every other existing entry untouched.
4. **This is a shared, project-wide change** — every Cursor agent and session in the project gets these servers, not just the one subagent being created. Treat it like any other change to shared configuration: tell the user which servers you're about to add to `.cursor/mcp.json` and confirm before writing, especially if the file already exists with unrelated entries.
5. **Note the dependency in the agent body** instead of the frontmatter — add a line under `## Skill Dependencies` (or a short `## MCP Servers` note) listing which project-level MCP servers this role relies on, so a reader knows where the capability actually comes from.

## Do not

- Add `mcp_servers` or `mcpServers` to the subagent frontmatter — invalid/ignored field.
- Overwrite unrelated entries in an existing `.cursor/mcp.json` when merging in new servers.
- Write to `.cursor/mcp.json` without telling the user first — it's shared config, not scoped to this subagent.

## Validation

```bash
grep -En "^mcp_servers|^mcpServers" .cursor/agents/*.md 2>/dev/null && echo "UNSUPPORTED MCP FIELD FOUND" || echo "ok"
python3 -c "import json; json.load(open('.cursor/mcp.json'))" 2>/dev/null && echo "mcp.json valid json" || echo "no .cursor/mcp.json or invalid — check if this render needed one"
```

- No `mcp_servers`/`mcpServers` key anywhere in the rendered `.md` frontmatter.
- If MCP servers were needed, `.cursor/mcp.json` was merged (not overwritten) and the user confirmed the change before it was written.
- The agent body names which MCP servers the role depends on, if any.
