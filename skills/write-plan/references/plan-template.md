# Linear Plan Sync Template

Use this structure for a Linear plan-sync comment or a short user-facing
summary. Do not write it as a local task source of truth unless the user asks
for an exported summary.

```markdown
# Linear Plan Sync: <Requirement Title>

## Source Documents

- Brief: .vibeRig/requirements/<REQ>/brief.md
- Contract: .vibeRig/requirements/<REQ>/contract.json
- Architecture: .vibeRig/requirements/<REQ>/architecture.md
- Acceptance: .vibeRig/requirements/<REQ>/acceptance.md
- Validation: .vibeRig/requirements/<REQ>/validation.md

## Linear Issues

| Issue | Task | Acceptance IDs | Subagent | Validation |
|---|---|---|---|---|

## Gate Policy

## Coverage

## Risks And Follow-Ups
```
