---
name: brainstorm
description: Run the VibeRig staged requirement discovery workflow. Use when the user asks to brainstorm, research, validate, specify, contract, or structure a requirement. Produces local Docs as Code under .vibeRig/requirements/{requirement-id}/ and may use specialized subagents through subagent-routing.
---

# Brainstorm

Use this skill to turn a rough requirement idea into a local Docs as Code requirement contract.

The local docs are engineering contracts, not Linear issues. Linear is used later by `write-plan` to manage execution tasks through `_save_issue` and `_save_comment`.

## Contract

Use this skill to discover, structure, and write one VibeRig requirement contract under `.vibeRig/requirements/{requirement-id}/`.

Do not use this skill for Linear issue creation, implementation execution, human acceptance, or post-acceptance retrospectives. Use `write-plan`, `task-runner`, `human-acceptance`, or `insights` for those phases.

Stop and ask when a blocking product decision, missing source material, legal/security uncertainty, or architecture choice would make the generated contract misleading.

## Input Contract

Required:

- Requirement idea, feature goal, bug scenario, or planning prompt.
- Target project or workspace.

Optional:

- Existing `.vibeRig/requirements/<requirement-id>/` docs.
- Research links, stakeholder notes, constraints, diagrams, or acceptance examples.
- Desired requirement id.

If the requirement id is missing, generate a safe slug from the requirement title and keep the human title in `brief.md`.

## Output Contract

Use this directory shape:

```text
.vibeRig/
└── requirements/
    └── <requirement-id>/
        ├── brief.md
        ├── research.md
        ├── contract.schema.json
        ├── contract.json
        ├── architecture.md
        ├── acceptance.schema.json
        ├── acceptance.json
        ├── acceptance.md
        ├── validation.md
        └── diagrams/
            ├── main-flow.mmd
            └── states.mmd
```

`research.md` and `diagrams/*.mmd` are optional when the requirement is simple, but `write-plan` requires the brief, contract, architecture, acceptance, and validation files.

Do not generate `tasks.yaml`, local dashboard data, local runner config, or proof packets in this skill.

## Workflow

Run one approved stage at a time unless the user explicitly asks for a full draft. Even in full-draft mode, stop for document-blocking unknowns.

1. Intake Brief
   - Output: `brief.md`
   - Capture goals, non-goals, users/stakeholders, success signals, constraints, risks, and decision records.
   - Ask only blocking questions. Convert non-blocking gaps into explicit working assumptions for user approval.
2. Evidence Research
   - Output: `research.md`
   - Gather only facts that affect architecture, acceptance, risk, implementation path, or validation.
   - Separate facts, inferences, hypotheses, confidence, and source links.
   - Use a research subagent when specialized investigation would improve accuracy.
3. Structured Contract
   - Output: `contract.schema.json` and `contract.json`
   - Use stable IDs for goals, rules, entities, workflows, constraints, open risks, and decisions.
   - Prefer schema-valid JSON over prose when downstream planning needs machine-readable structure.
4. Architecture And Flow
   - Output: `architecture.md` and optional `diagrams/*.mmd`
   - Document selected approach, affected modules, data/state flow, boundaries, failure modes, migration notes, and integration points.
   - Use Mermaid diagrams for state, sequence, or flow when they clarify execution or acceptance.
5. Acceptance Matrix
   - Output: `acceptance.schema.json`, `acceptance.json`, and `acceptance.md`
   - Each acceptance item must include stable ID, source requirement/rule, precondition, action, expected result, evidence, validation mode, and risk covered.
6. Adversarial Review
   - Output: updates to the relevant files only.
   - Use QA/security/reviewer subagents when useful.
   - Check ambiguity, missing negative cases, unsupported assumptions, untestable criteria, and architecture/acceptance mismatch.
7. Linear Issue Synthesis Readiness
   - Output: no Linear writes in this skill unless the user explicitly asks to combine stages.
   - Confirm that `write-plan` can map acceptance items into Linear issues using local doc references.
   - If the user explicitly asks to combine stages, invoke `write-plan` instead of calling Linear issue tools directly from `brainstorm`.

## Stage Gate

Before writing or updating files for a stage:

1. Inspect existing local docs and project context.
2. Build a compact fact map: confirmed facts, source-backed facts, inferences, assumptions, and blockers.
3. Ask the single most important blocking question when one exists.
4. When choices matter, present 2-3 options with a recommendation and tradeoffs.
5. Present a concise stage draft for approval.
6. Write only after approval, unless the user explicitly requested a draft and no blocker exists.
7. Self-review the written file against the stage contract and fix concrete issues before reporting.

Do not write brainstorming transcript, internal reasoning, or conversation logs into the result files. Write converged decisions and evidence only.

## Requirement Resolution

1. Locate the VibeRig root:
   - prefer the current workspace if it contains `.vibeRig/project.yaml` or `.vibeRig/requirements/`
   - otherwise use the git root
   - if neither exists, create `.vibeRig/requirements/` under the workspace root
2. Resolve the requirement id:
   - prefer a stable id supplied by the user
   - otherwise generate a safe slug from the requirement title
   - keep the human title inside `brief.md`
3. If the id resembles a Linear key, keep it; otherwise do not force alignment with Linear issue keys.

## Subagent Use

Use `subagent-routing` whenever a specialized perspective improves the result:

- researcher for evidence research
- architect for architecture review
- QA/security/compliance for adversarial review
- planner for acceptance matrix consistency

Subagents must not use context-mode and must not update Linear. The main agent owns context gathering, file writes, and final stage approval.

## Validation

Before handing off to `write-plan`, confirm:

- `brief.md` has goals, non-goals, success signals, constraints, and decisions.
- `contract.json` validates against `contract.schema.json` or validation was explicitly skipped with reason.
- `architecture.md` covers affected modules, data/state flow, errors, and integration boundaries.
- `acceptance.json` validates against `acceptance.schema.json` or validation was explicitly skipped with reason.
- `acceptance.md` contains stable AC IDs matching `acceptance.json`.
- `validation.md` names required commands, manual checks, CI/gate policy references, and evidence expectations.
