# skill-builder 调用模板

Fill in all fields from the `insights` output, then pass the entire block to `skill-builder`.

```
Skill name      : <kebab-case from lesson topic>
Target directory: ~/.vb-skills/<skill-name>/
Capability      : <one sentence — what problem this skill solves>

When (trigger conditions from insights — the primary input):
  Exact symptoms / code signals / user phrases that mean "apply this skill":
  - <condition 1>
  - <condition 2>

When NOT (from insights — adjacent situations that belong elsewhere):
  - <situation A>
  - <situation B>

Should-trigger examples (3–5 real prompts derived from When):
  - "<phrase 1>"
  - "<phrase 2>"
  - "<phrase 3>"

Should-NOT-trigger examples (3–5 real prompts derived from When NOT):
  - "<phrase A>"
  - "<phrase B>"
  - "<phrase C>"

Source material:
  - What (generalizable rule): <from insights>
  - How (solution approach, no task names/IDs): <from insights>
  - Verify (commands that confirm correct application): <from insights>
  - Root cause (key line from Linear comments): <for context only, not for SKILL.md body>

Constraints:
  - SKILL.md body MUST have a ## When section as the first section after the intro
  - description frontmatter must be trigger-first (signals only, not workflow summary)
  - body < 200 lines; deterministic multi-line logic → scripts/ inside the skill dir
  - validation section must have runnable commands with exit criteria, not just "confirm X"
  - no Linear keys, dates, issue titles, or person names anywhere in the SKILL.md body
```
