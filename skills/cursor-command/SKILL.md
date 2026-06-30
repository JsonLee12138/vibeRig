---
name: cursor-command
description: Create, audit, or optimize Cursor custom slash commands (.md files in .cursor/commands/ or plugin commands/). Use when the user asks to create a command, write a slash command, add a reusable AI prompt, fix a command that doesn't appear in the / menu, or scaffold commands for a plugin. 触发词：cursor command、slash command、创建命令、写命令、/命令、自定义命令、.cursor/commands。Do not use for Cursor Rules (.mdc), Skills (SKILL.md), or subagents (.cursor/agents/).
---

# Cursor Command Creator

## Contract

Use this skill to create, fix, or optimize Cursor custom slash commands.

Do not use this skill for:
- Cursor Rules (`.mdc` files) — use `cursor-rules` skill instead.
- Skills (`SKILL.md`) — use `skill-creator` skill instead.
- Subagents (`.cursor/agents/*.md`) — use `agent-creator` skill instead.

Stop and ask when: the command's purpose is too vague to write an actionable prompt, or the target path (project / global / plugin) cannot be inferred.

## Input Contract

Required:
- What the command should do (the task the user wants to automate or reuse).

Optional:
- Command name (default: derive from purpose in kebab-case).
- Target location: project (`.cursor/commands/`), global (`~/.cursor/commands/`), or plugin (`commands/`).
- Existing commands directory to audit or extend.

If inputs are missing, infer name and location from context. Note assumptions.

## Output Contract

Return:
- File path(s) created or modified.
- The slash command invocation name (e.g., `/fix-pr-description`).
- Scope (project / global / plugin).
- Validation results.

Do not claim completion until the validation checklist passes and the file has no placeholder body.

## Workflow

### 1. Determine target location

| Scope | Path | When to use |
|---|---|---|
| Project-level | `.cursor/commands/<name>.md` | Shared with team, version-controlled |
| Global | `~/.cursor/commands/<name>.md` | Personal, all projects |
| Plugin | `commands/<name>.md` | Distributed via cursor plugin |

Default: project-level unless the user says "global" or this is a plugin context.

### 2. Choose the command name

- Use **kebab-case** filename; it becomes the slash command: `create-pr.md` → `/create-pr`.
- Name describes the action, not the tool: `review-code.md` not `gpt-review.md`.
- Check for conflicts: `ls .cursor/commands/` before writing.

### 3. Write the command file

See [command format reference](./references/command-format.md) for full spec and frontmatter fields.

Copy the appropriate template from [`assets/command-template.md`](./assets/command-template.md) for standard patterns (review, PR description, bug fix, tests, refactor, deploy check). Fill in the copied template and remove placeholder text before saving.

### 4. Quality checks before saving

- Prompt is **specific and actionable** — not "review the code" but "review for X, Y, Z and output line references".
- Prompt **references context** the agent can use: open file, selection, git diff, `@codebase`.
- Body has **no placeholder text** (no `TODO`, `<your-task-here>`, etc.).
- File is **plain Markdown** — no non-Markdown syntax.

### 5. Common command patterns

| Use case | Recommended body structure |
|---|---|
| Code review | List specific checks → output format with line refs |
| PR description | Input: `git diff main` → sections: What, Why, Testing |
| Bug fix | Describe the symptom → ask for root cause + minimal fix |
| Test generation | File context → coverage goals → test framework |
| Refactor | Target pattern → constraints → no scope creep |
| Deploy/CI | Steps → flags → rollback notes |

## Context Loading

- `references/command-format.md`: read when unsure about frontmatter fields, extension rules, or multi-location discovery.
- `assets/command-template.md`: copy when scaffolding a standard command type.

## Red Flags

- Command name has spaces or uppercase → renames to kebab-case now, space will break `/` discovery.
- Body is a single vague sentence ("help me with this") → expand to specific checks and output format.
- Frontmatter has fields not in the spec (`globs`, `alwaysApply`) → those are rule fields, remove them.
- File placed under `rules/` or `skills/` instead of `commands/` → move to correct directory.

## Validation

```bash
# 1. File exists in the right directory
ls .cursor/commands/*.md 2>/dev/null || ls commands/*.md 2>/dev/null

# 2. Filename is kebab-case (no spaces, no uppercase)
for f in .cursor/commands/*.md; do
  basename "$f" | grep -E '^[a-z0-9][a-z0-9-]*\.md$' && echo "ok: $f" || echo "FAIL: $f"
done

# 3. No placeholder text in body
grep -n "TODO\|<your\|PLACEHOLDER\|\[填写\]" .cursor/commands/*.md
# expected: empty output

# 4. If frontmatter exists, name matches filename
# (manual check: grep "^name:" .cursor/commands/<file>.md)
```

Manual:
- [ ] Filename derives a meaningful `/command-name` when typed in chat.
- [ ] Body is specific enough to get consistent, useful output without extra prompting.
- [ ] No Rules or Skills frontmatter fields (`globs`, `alwaysApply`, `paths`) are present.
- [ ] File extension is `.md` (preferred), `.mdc`, `.markdown`, or `.txt`.
