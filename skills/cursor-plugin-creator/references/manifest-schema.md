# Cursor Plugin Manifest Schema Reference

## plugin.json — Full Schema

```json
{
  "name": "my-plugin",              // REQUIRED. kebab-case, alphanumeric + hyphens + periods only
  "description": "...",             // Brief overview, shown in marketplace
  "version": "1.0.0",              // Semantic version
  "author": {
    "name": "Your Name",           // Required if author object present
    "email": "you@example.com"     // Optional
  },
  "homepage": "https://...",
  "repository": "https://github.com/owner/repo",
  "license": "MIT",
  "keywords": ["tag1", "tag2"],    // For marketplace discovery

  "logo": "assets/logo.png",       // Relative path OR absolute URL

  // Explicit component paths (override auto-discovery when set)
  "rules": ["rules/my-rule.mdc"],
  "skills": ["skills/my-skill"],
  "agents": ["agents/my-agent.md"],
  "commands": ["commands/my-cmd.md"],

  // Hook and MCP references
  "hooks": "hooks/hooks.json",
  "mcpServers": "mcp.json"
}
```

## Auto-Discovery Rules

When manifest fields are omitted, the parser scans default folders:

| Component | Discovery Path | File Pattern |
|---|---|---|
| Skills | `skills/` | subdirectories containing `SKILL.md` |
| Rules | `rules/` | `*.md`, `*.mdc`, `*.markdown` |
| Agents | `agents/` | `*.md`, `*.mdc`, `*.markdown` |
| Commands | `commands/` | `*.md`, `*.mdc`, `*.markdown`, `*.txt` |
| Root Skill | `SKILL.md` at plugin root | single-skill plugins only |
| MCP | `mcp.json` at plugin root | always auto-discovered |

**Precedence**: explicit manifest paths override folder scanning.

## Component Frontmatter

### Rules (`rules/*.mdc`)
```yaml
---
description: "What this rule does and when it activates"
alwaysApply: false        # true = applies to every request (use with caution)
globs: ["**/*.ts", "**/*.tsx"]   # optional file patterns
---
Rule body content here.
```

### Skills (`skills/<name>/SKILL.md`)
```yaml
---
name: skill-name
description: "Activation intent and trigger conditions"
---
Skill workflow content.
```

### Agents (`agents/*.md`)
```yaml
---
name: agent-name
description: "What this agent does"
---
Agent behavioral instructions.
```

### Commands (`commands/*.md`)
```yaml
---
name: command-name          # optional
description: "..."          # optional
---
Command instructions.
```

## Hooks Schema (`hooks/hooks.json`)

```json
{
  "hooks": [
    {
      "event": "sessionStart",          // or sessionEnd, preToolUse, postToolUse, tabOpen, tabClose, workspaceOpen
      "script": "scripts/on-start.sh"  // relative path to hook script
    }
  ]
}
```

Supported events:
- Agent lifecycle: `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`
- Tab operations: `tabOpen`, `tabClose`
- Workspace: `workspaceOpen`

## MCP Servers Schema (`mcp.json`)

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "some-mcp-package"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

## Marketplace Schema (`marketplace.json`) {#marketplace}

Place at repository root for multi-plugin repos.

```json
{
  "name": "my-marketplace",           // Marketplace identifier
  "owner": {
    "name": "Organization Name",      // Required
    "email": "org@example.com"        // Optional
  },
  "plugins": [                        // Max 500 entries
    {
      "name": "plugin-a",             // Required, must match plugin's own name
      "source": "packages/plugin-a"  // Path relative to repo root
    },
    {
      "name": "plugin-b",
      "source": {
        "path": "packages/plugin-b",
        "branch": "stable"            // Optional branch override
      }
    }
  ],
  "metadata": {
    "description": "...",
    "version": "1.0.0",
    "pluginRoot": "packages/"         // Optional prefix for all plugin paths
  }
}
```

## Name Validation

Valid examples: `my-plugin`, `cursor.tools`, `org-name.feature-pack`

Invalid: `MyPlugin` (uppercase), `my_plugin` (underscore), `/absolute` (leading slash), `../relative` (traversal)

Regex: `/^[a-z0-9][a-z0-9.\-]*$/`

## Submission

1. Host plugin in a public Git repository.
2. Commit the logo to the repo and use a relative path (preferred over absolute URL).
3. Submit at: **cursor.com/marketplace/publish**
