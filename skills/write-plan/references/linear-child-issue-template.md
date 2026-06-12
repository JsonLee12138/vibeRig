# Linear Issue Template

Render the filled issue title, headings, table labels, and prose in `.vibeRig/project.yaml` `output.language`. Keep stable IDs, local paths, commands, branch names, Linear keys, acceptance IDs, schema keys, and code symbols unchanged.

```markdown
## Task

<short task goal>

## Source Docs

- .vibeRig/requirements/<requirement-id>/brief.md#...
- .vibeRig/requirements/<requirement-id>/architecture.md#...
- .vibeRig/requirements/<requirement-id>/acceptance.md#...
- .vibeRig/requirements/<requirement-id>/validation.md#...

## Acceptance References

- AC-...

## Validation

- <command/manual gate>

## Subagent

Recommended: <capability>

## Proof Packet

Post final validation as a Linear comment. Include commands, results, CI/log
links, changed files, commit/branch/PR, acceptance coverage, uncovered items,
manual checks, subagent handoff notes, and residual risks.
```
