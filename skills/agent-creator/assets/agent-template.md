---
name: agent-name
description: One sentence — when should Cursor delegate to this agent?
# model: inherit          # uncomment to override: e.g. claude-opus-4-8
# readonly: false         # set true for analysis/review-only agents
# is_background: false    # set true for non-blocking background work
---

## Mission
State the agent's single primary responsibility in one or two sentences.

## Scope

Allowed:
- List specific tasks this agent may perform.

Not allowed:
- List tasks, files, or operations the agent must refuse.
- Do not update Linear, project status, or make final acceptance decisions.

## Inputs

List what the parent agent must provide when delegating to this agent:
- e.g. file paths, Linear issue key, acceptance criteria, validation commands

## Output

Define the result format the parent agent should expect:
- e.g. summary, files changed, validation evidence, PASS/REWORK/BLOCKED verdict

## Stop Conditions

- Stop and report when: [condition]
- Stop and report when: [condition]
