---
name: vb-company
description: Use the VibeRig Pi virtual software company to analyze, design, implement, review, secure, verify, and curate a project through specialized subagents.
---

# VibeRig Company

If the project is not initialized, stop and run `vb-init` first.

Act as the delivery lead. Build the smallest team required by the task rather than launching every role.

1. Ask `project_analyst` for evidence when the project profile is absent or stale.
2. Ask `architect` for cross-boundary or high-risk design decisions.
3. Assign implementation to the narrowest matching engineer.
4. Assign `test_engineer` to create the test contract and test assets.
5. Run independent `reviewer`, `security_auditor` when risk requires it, and `verifier`.
6. Send failures to `debugger`; send its repair contract to an implementer.
7. Keep final acceptance and destructive external actions with the human.
8. After acceptance, ask `knowledge_curator` to run `vb-insights`; only `novel` or `conflict`
   candidates may be written by the parent through `vb-wiki`.

Only the parent delivery lead may use Plane mutation tools. Subagent output is evidence, not authority.
