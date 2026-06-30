---
name: cursor-plugin-creator
description: Scaffold or publish a Cursor plugin package. Use when the user asks to create, build, or structure a Cursor plugin — including plugin.json manifest, rules (.mdc), skills (SKILL.md), agents, commands, hooks, or MCP server config. Also use when reviewing an existing plugin layout, debugging auto-discovery issues, or preparing a marketplace submission. Do not use for general Cursor IDE configuration, .cursorignore, or cursor keybindings unrelated to the plugin format.
---

# Cursor Plugin Creator

Scaffold a complete, distributable Cursor plugin — manifest, components, and submission-ready layout — following the official plugin format.

## Contract

Single responsibility: create or fix one Cursor plugin package in a specified directory.

Do not use this skill to configure Cursor settings, manage `.cursor/rules` outside a plugin, or write general agent skills unrelated to Cursor distribution.

Stop and ask when:
- The target plugin directory cannot be inferred from context.
- The plugin name conflicts with an existing `.cursor-plugin/plugin.json` in the same repo.
- The user requests a multi-plugin marketplace repo but doesn't name all plugins.

## Input Contract

Resolve from user request or codebase context:
- Plugin name (kebab-case, alphanumeric and hyphens only).
- Target directory (default: repo root or a subdirectory per user's intent).
- Which components to include: rules, skills, agents, commands, hooks, MCP servers.
- Whether this is a single-plugin or multi-plugin repository.

## Output Contract

Produce:
- Created or modified file paths.
- The `name` field used in `plugin.json`.
- Components scaffolded and any intentionally omitted.
- Auto-discovery vs explicit manifest paths — which was chosen and why.
- Submission checklist pass/fail status.

Do not claim completion unless `plugin.json` is valid, all referenced paths exist, and the submission checklist passes.

## Workflow

### 1. Determine layout and plugin name

```bash
# Check if a plugin.json already exists
find . -name "plugin.json" -path "*/.cursor-plugin/*" 2>/dev/null
```

Use kebab-case for `name`. Confirm with user if name is ambiguous.

### 2. Create required directory structure

```
<plugin-root>/
├── .cursor-plugin/
│   └── plugin.json          ← Required manifest
├── rules/                   ← .mdc files (optional)
├── skills/                  ← subdirs with SKILL.md (optional)
├── agents/                  ← .md agent configs (optional)
├── commands/                ← .md/.txt action files (optional)
├── hooks/
│   └── hooks.json           ← event triggers (optional)
├── mcp.json                 ← MCP server definitions (optional)
├── assets/                  ← logo, static files (optional)
└── scripts/                 ← hook utilities (optional)
```

Only create subdirectories for components the user requests. Do not scaffold empty dirs.

### 3. Write plugin.json

See [manifest schema reference](./references/manifest-schema.md) for all fields.

Minimum required manifest:
```json
{
  "name": "my-plugin"
}
```

Full manifest with all optional fields: see reference. Use explicit paths in manifest only when auto-discovery would pick up wrong files. Prefer auto-discovery for clean single-purpose plugins.

### 4. Author each component

| Component | Location | Format | Required frontmatter |
|---|---|---|---|
| Rules | `rules/*.mdc` | MDC | `description`, `alwaysApply` (bool), optional `globs` |
| Skills | `skills/<name>/SKILL.md` | Markdown | `name`, `description` |
| Agents | `agents/*.md` | Markdown | `name`, `description` |
| Commands | `commands/*.md` | Markdown | `name`, `description` (optional) |
| Hooks | `hooks/hooks.json` | JSON | see reference |
| MCP Servers | `mcp.json` | JSON | `mcpServers` key |

Write the body of each component to fulfill its stated purpose. Do not leave placeholder bodies.

### 5. For multi-plugin repos

If the user wants multiple plugins in one repo, create `marketplace.json` at the repo root. See [marketplace schema reference](./references/manifest-schema.md#marketplace).

```json
{
  "name": "my-marketplace",
  "owner": { "name": "Your Name" },
  "plugins": [
    { "name": "plugin-a", "source": "packages/plugin-a" },
    { "name": "plugin-b", "source": "packages/plugin-b" }
  ]
}
```

Maximum 500 plugins per marketplace.json.

### 6. Submission checklist

Run before reporting completion:

```bash
# Validate plugin.json exists
test -f .cursor-plugin/plugin.json && echo "ok" || echo "MISSING plugin.json"

# Name is lowercase kebab-case
node -e "const p=require('./.cursor-plugin/plugin.json'); /^[a-z0-9][a-z0-9.\-]*$/.test(p.name) ? console.log('name ok') : console.log('INVALID name:', p.name)"

# All paths referenced in manifest actually exist
# (run manually for each path listed in plugin.json)

# No absolute paths or .. traversal in manifest
grep -E '"\.\.|^/' .cursor-plugin/plugin.json && echo "INVALID path" || echo "paths ok"

# Logo is committed and path is relative
grep '"logo"' .cursor-plugin/plugin.json | grep -v 'http' | head -1
```

Checklist items:
- [ ] `plugin.json` has unique lowercase kebab-case `name`
- [ ] `description` present and explains purpose clearly
- [ ] All component frontmatter is valid (name + description fields)
- [ ] Logo committed to repo with relative path, or absolute URL
- [ ] README.md exists with usage and configuration instructions
- [ ] No `..` or absolute paths in manifest
- [ ] All referenced paths exist on disk
- [ ] Tested locally (open plugin dir in Cursor and confirm components load)
- [ ] For multi-plugin repos: `marketplace.json` at root with unique plugin names

## Common Mistakes

- **Empty `alwaysApply`**: Rules with `alwaysApply: true` and no `globs` apply to every file in every request — use `false` unless the rule must always be active.
- **Missing SKILL.md frontmatter `name`**: skills without `name` are not discoverable.
- **Root SKILL.md + skills/ dir**: if both exist, root `SKILL.md` is treated as a single-skill plugin; the `skills/` dir is ignored. Choose one pattern.
- **Manifest absolute paths**: paths in `plugin.json` must be relative to the plugin root.
- **Hooks without scripts/**: hooks referencing shell scripts require those scripts to exist in `scripts/`.
