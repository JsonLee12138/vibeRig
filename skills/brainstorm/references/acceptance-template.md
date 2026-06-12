# Acceptance Matrix Template

Write both `acceptance.json` and `acceptance.md`. Pair `acceptance.json` with
`acceptance.schema.json`.

Use `.vibeRig/project.yaml` `output.language` for human-readable string values in
`acceptance.json` and for the title, headings, table headers, and prose in
`acceptance.md`. Keep JSON keys, AC IDs, source IDs, file paths, commands, and
code symbols unchanged.

## acceptance.json

```json
{
  "requirement_id": "REQ-001",
  "items": [
    {
      "id": "AC-001",
      "source": "G-001",
      "precondition": "",
      "action": "",
      "expected": "",
      "evidence": "",
      "mode": "automated",
      "risk_covered": ""
    }
  ]
}
```

## acceptance.md

```markdown
# Acceptance Matrix: <Requirement Title>

| ID | Source | Precondition | Action | Expected | Evidence | Mode | Risk |
|---|---|---|---|---|---|---|---|
```
