# Claude Code Rendering Rules

Render an [agent-spec.template.json](../assets/agent-spec.template.json) into a Claude Code subagent using [claude-agent-template.md](../assets/claude-agent-template.md).

## File

| | |
|---|---|
| Format | Markdown with YAML frontmatter |
| Project location | `.claude/agents/<name>.md` |
| User location | `~/.claude/agents/<name>.md` |
| Required fields | `name`, `description` |

## Field mapping

- `name` → `name`, lowercase-hyphen, unique across `.claude/agents/` and `~/.claude/agents/`.
- `description` → `description`, specific enough that Claude knows when to delegate.
- `model` → `model`: `sonnet` / `opus` / `haiku` / `fable` / a full model ID / `inherit`. Safe to omit — `inherit` is the default.
- `permission` → `tools` / `disallowedTools`:
  - `"read-only"` → `tools: Read, Grep, Glob` (add `Bash` only if the role needs read-only shell inspection, and say so explicitly in `Scope`).
  - `"write"` → omit `tools` entirely to inherit everything, or list an explicit write-capable set if the user wants a tighter allowlist than full inheritance.
- `mcp_servers` (non-empty) → `mcpServers` list. Each entry is either a bare string referencing an already-configured server, or an inline `server-name: {type, command/url, ...}` block scoped to this subagent only.
- `mission` / `scope_allowed` / `scope_not_allowed` / `inputs` / `output` / `stop_conditions` / `escalation` / `skill_dependencies` → Markdown body, same `## Mission` / `## Scope` / ... structure as the template.

## Do not

- Set `permissionMode: bypassPermissions` unless the user explicitly asks for it — it skips permission prompts entirely, including writes to `.git`, `.claude`, and other protected directories.
- List tools the role doesn't need — `tools` is an allowlist, not documentation.
- Preload skills via the `skills` frontmatter field unless the user wants their full content injected at startup; default to instruction-level guidance in `Skill Dependencies` for portability across platforms.

## Validation

- `tools` (when present) contains only what the role's `Scope` says it's allowed to do.
- `mcpServers` entries (when present) match servers actually needed by the role, not speculative additions.
- Read-only agents have no file-edit instructions in the body; write agents name excluded paths in `Not allowed:`.
