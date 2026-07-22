# Approved Tool Skill Packet

Fill every field from the user's direct tool request or the approved `vb-wiki` promotion proposal, then pass the entire block to `skill-builder`. This packet authorizes exactly one target skill.

```text
Explicit authorization: <verbatim current-conversation approval>
Candidate ID          : <vb-wiki candidate id, or direct-request>
Packet SHA-256        : <vb-wiki immutable packet hash, or not-applicable>
Source event          : <acceptance event id, or direct-request>
Wiki commit           : <sha, or not-applicable for direct request>
Action                : create | refine
Target skill          : <exact-approved-kebab-case-package-name>
Target directory      : ~/.vb-skills/<target-skill>/

Capability:
  <one independently invocable action this tool performs>

Why wiki is insufficient:
  <the execution gap that passive knowledge cannot fill>

When:
  - <user intent, task context, symptom, or code signal>

When NOT:
  - <adjacent request that only needs wiki knowledge or another skill>

Inputs:
  - <required input>

Outputs:
  - <artifact or state change>

Reusable mechanism:
  - <stable workflow, script, template, API/tool orchestration, or combination>

Verification:
  - <runnable check and pass condition>

Safety boundaries:
  - <authority limit, stop rule, destructive-action boundary>

Should-trigger examples:
  - <at least 3 realistic prompts>

Should-NOT-trigger examples:
  - <at least 3 realistic adjacent prompts>

Evidence:
  - <wiki page, file, documentation, or accepted-work source>

Constraints:
  - Create or refine exactly this one skill; do not mine additional candidates.
  - Keep the SKILL.md trigger-first, concise, and reusable.
  - Put deterministic repeated logic in scripts/ and reusable templates in assets/.
  - Do not place Issue keys, dates, person names, or task-specific narrative in the skill body.
  - Leave no unresolved placeholders outside clearly marked examples/templates.
```
