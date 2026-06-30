---
name: cursor-rules
description: Create, audit, or optimize Cursor Rules (.mdc files in .cursor/rules/). Use when writing new .mdc rules, fixing rules that do not trigger, reviewing frontmatter (description/globs/alwaysApply), validating glob patterns, restructuring a rules directory, or comparing rule types (Project/User/Team/AGENTS.md). 触发词：cursor rule、写规则、.mdc、创建规则、优化规则、校验规则、rules不生效。
---

# Cursor Rules

## Contract

Use this skill to create, optimize, and validate Cursor Rules (`.mdc` files).

Do not use this skill for:
- Writing ESLint / Prettier / linter config — delegate those to dedicated config skills.
- Configuring the deprecated `.cursorrules` flat file (Cursor has migrated to `.cursor/rules/`).
- Cursor IDE settings or keybindings unrelated to rules.

Stop and ask when the target project context (tech stack, file layout) is needed to write accurate `globs` and cannot be inferred.

## Input Contract

Required:
- What the rule should enforce (coding convention, workflow, architecture constraint).

Optional:
- Existing `.mdc` files to audit or optimize.
- Tech stack / file structure for precise `globs`.
- Whether the rule is project-scoped or should apply globally.

If inputs are missing, infer a sensible `globs` from the stack context and note the assumption.

## Output Contract

Return:
- Complete `.mdc` file(s) with all frontmatter fields set and no placeholders.
- Target file path (e.g. `.cursor/rules/react-components.mdc`).
- For audits: validation result against the checklist below + specific fix recommendations.

Do not claim completion unless all checklist items in Validation pass.

## Workflow

### Create

1. Choose trigger type based on scope (see `references/syntax.md` — Trigger Type table).
2. Prefer `globs` over `alwaysApply: true` — avoid injecting rules into unrelated sessions.
3. Write a `description` that gives the AI a clear semantic signal for Intelligent mode; test: "would this description tell the AI exactly when to activate?"
4. Write rule body — concise, actionable directives; use examples. See `references/content-guide.md` for what to include/exclude.
5. Copy an appropriate template from `assets/rule-templates.md` if the rule type matches a common pattern.
6. Validate before delivering.

### Optimize

Read the existing `.mdc` file, then check:
- Over 500 lines? → split into focused rules.
- `alwaysApply: true` but content targets specific files? → convert to `globs`.
- `description` vague or empty? → rewrite with concrete task context.
- Duplicates another rule? → merge or extract shared content.
- Contains full style guide or linter docs? → trim to linter-gap items only.

### Audit

Run against all Validation checks and report each failure with a specific fix.

## Context Loading

Read when needed:
- `references/syntax.md`: read when setting frontmatter fields, writing glob patterns, or explaining rule types.
- `references/content-guide.md`: read when deciding what to include/exclude in rule body.
- `assets/rule-templates.md`: copy a template when creating a rule that matches React, API, Git, DB, or general patterns.

## Validation

```bash
# 1. File uses .mdc extension (not .md)
[[ "$file" == *.mdc ]] && echo "ok" || echo "FAIL: wrong extension"

# 2. Frontmatter exists
head -1 "$file" | grep -q "^---" && echo "ok" || echo "FAIL: no frontmatter"

# 3. At least one activation field set
grep -E "^(alwaysApply: true|globs:|description:)" "$file" | grep -v "description: $" | wc -l
# must be >= 1

# 4. No placeholder text in non-example sections
grep -n "\[TODO\]\|\[填写\]\|<your" "$file"
# must be empty
```

Manual checks:
- [ ] `globs` uses comma-separated strings, not YAML arrays
- [ ] Rule body < 500 lines
- [ ] No full style guide / linter documentation inlined
- [ ] `description` describes when to activate, not what the rule contains
- [ ] File path is under `.cursor/rules/` (not project root)
