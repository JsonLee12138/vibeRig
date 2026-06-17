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

- Existing `.vibeRig/project.yaml` for docs root and output language.
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

## Language Policy

Read `.vibeRig/project.yaml` when present and use `output.language` for every human-readable requirement document produced by this skill.

- Write document titles, section headings, table headers, prose, acceptance text, risks, decisions, and validation explanations in `output.language`.
- If `output.language` is missing, infer the language from the user's current working language, state the fallback, and recommend reconciling `project.yaml` through `init-viberig`.
- Do not translate stable IDs, file paths, commands, branch names, Linear keys, schema field names, JSON keys, code symbols, labels that already exist in external systems, or Mermaid identifiers when translating would break references.
- `contract.json` and `acceptance.json` keep machine-readable field names unchanged, but their human-readable string values should use `output.language`.

## Workflow

Run one approved stage at a time unless the user explicitly asks for a full draft. Even in full-draft mode, stop for document-blocking unknowns.

0. Intent Clarification (when the ask is underspecified)
   - Check if the requirement is missing any of: who it's for, why now, what success looks like, what the binding constraint is.
   - If underspecified, run clarification before drafting any file:
     - State a hypothesis + confidence number (0–100%) in one sentence: "I think you want X. Confidence: ~40% — missing: why now and what success looks like."
     - Ask one question at a time, each with your best guess attached. Wait for a response before the next question.
     - When the user gives convention-signaling answers ("scalable", "clean", "modern"), probe: "If you didn't have to justify this to anyone, what would you actually want?"
     - Continue until you can predict the user's reaction to the next three questions you'd ask.
   - Produce a confirmed statement of intent (Outcome / User / Why now / Success / Constraint / Out of scope) before proceeding to Stage 1.
   - Skip this stage only when: the requirement is already concrete with all dimensions stated, or the user explicitly asks for speed over verification.

1. Intake Brief
   - Output: `brief.md`
   - Read `references/brief-template.md` first and follow its structure exactly; downstream `write-plan` parses these sections.
   - Capture goals, non-goals, users/stakeholders, success signals, constraints, risks, and decision records.
   - Ask only blocking questions. Convert non-blocking gaps into explicit working assumptions for user approval.
2. Evidence Research
   - Output: `research.md`
   - Read `references/research-template.md` first and follow its structure exactly.
   - Gather only facts that affect architecture, acceptance, risk, implementation path, or validation.
   - Separate facts, inferences, hypotheses, confidence, and source links.
   - Use a research subagent when specialized investigation would improve accuracy.
3. Structured Contract
   - Output: `contract.schema.json` and `contract.json`
   - Read `references/contract-template.md` first for the required field set and ID conventions.
   - Use stable IDs for goals, rules, entities, workflows, constraints, open risks, and decisions.
   - Prefer schema-valid JSON over prose when downstream planning needs machine-readable structure.
4. Architecture And Flow
   - Output: `architecture.md` and optional `diagrams/*.mmd`
   - Read `references/architecture-template.md` first and follow its structure exactly.
   - Document selected approach, affected modules, data/state flow, boundaries, failure modes, migration notes, and integration points.
   - Use Mermaid diagrams for state, sequence, or flow when they clarify execution or acceptance.
   - **Mandatory adversarial review**: after the `architecture.md` draft is ready, spawn an independent adversarial subagent with the sole mandate to attack the design. Brief it with: "Find every flaw, hidden assumption, missing failure mode, scalability cliff, security hole, and integration gap. Do NOT validate what works—your ONLY job is to disprove." Incorporate valid findings into `architecture.md` and record rejected findings with the rejection reason. Do not proceed to Stage 5 until this review is complete.
5. Acceptance Matrix
   - Output: `acceptance.schema.json`, `acceptance.json`, and `acceptance.md`
   - Read `references/acceptance-template.md` first; `write-plan` maps these AC IDs into Linear issues.
   - Each acceptance item must include stable ID, source requirement/rule, precondition, action, expected result, evidence, validation mode, and risk covered.
6. Adversarial Review
   - Output: updates to the relevant files only.
   - Score the draft against `references/review-rubric.md` before reporting the stage as done.
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
   - when `.vibeRig/project.yaml` exists, read `docs.root` and `output.language` before writing requirement documents
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

Subagents must not update Linear. The main agent owns context gathering, file writes, and final stage approval.

## Red Flags

- A stage file was written without first presenting the draft for user approval → reverse to the approval step.
- `write-plan` was called directly from inside `brainstorm` instead of being invoked as a separate skill → brainstorm only prepares the docs; write-plan owns Linear writes.
- `research.md` or `diagrams/` were skipped for a complex requirement → record the omission and reason; `write-plan` will fail without `architecture.md` and `acceptance.md`.
- A fact in `contract.json` or `acceptance.json` was invented to fill a gap instead of being blocked → stop and ask the single most important blocking question.
- `architecture.md` was drafted and Stage 4 was marked complete without invoking the adversarial review subagent → the review is mandatory; skipping it lets untested assumptions reach Linear as facts.
- An acceptance criterion in `acceptance.json` lacks a `validation_mode` or `evidence` field → untestable criteria cause `task-runner` to fail validation at execution time; fix before proceeding to `write-plan`.
- Multiple stages were written in a single pass without presenting intermediate drafts → each stage requires its own draft-and-approve cycle; batch-writing removes the user's ability to redirect before effort is wasted.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "I'll write the file now and show the user afterward" | The Stage Gate requires approval before writing. Writing first removes the user's ability to redirect before effort is spent. |
| "The requirement is simple, I can skip the adversarial review stage" | Skipping adversarial review is how untestable acceptance criteria reach Linear. A 5-minute score against the rubric catches ambiguity before it costs a full task cycle. |
| "I'll infer the missing product decision from context" | Inferred product decisions that are wrong generate invalid contracts that fail late, during task execution. Ask the blocking question instead. |
| "The architecture is obvious, adversarial review is overkill" | The bugs that hurt most hide in architectures that seem straightforward. An adversarial subagent costs one exchange; a missed failure mode costs a full task cycle. |
| "The user described the requirement in detail, so research is unnecessary" | Even precise requirements have implicit integration constraints, runtime risks, and gaps the user doesn't know to mention. `research.md` surfaces what affects architecture and acceptance. |
| "I'll skip schema validation since the JSON looks right" | JSON that looks right can still violate required fields or AC-id consistency. Run validation or explicitly document why it was skipped. |

## Verification Checklist

```bash
# Confirm required docs exist
for f in brief.md contract.json architecture.md acceptance.json acceptance.md validation.md; do
  [ -f ".vibeRig/requirements/<req-id>/$f" ] && echo "ok: $f" || echo "MISSING: $f"
done
```

- [ ] `brief.md` has goals, non-goals, success signals, constraints, and decisions.
- [ ] `contract.json` validates against `contract.schema.json` or skipped validation is documented with reason.
- [ ] `architecture.md` covers affected modules, data/state flow, errors, and integration boundaries.
- [ ] Adversarial architecture subagent was invoked for Stage 4; valid findings incorporated; rejected findings recorded with reason.
- [ ] `acceptance.json` validates against `acceptance.schema.json` or skipped validation is documented with reason.
- [ ] `acceptance.md` contains stable AC IDs matching `acceptance.json`.
- [ ] Every AC item has `evidence` and `validation_mode` fields specified.
- [ ] `validation.md` names required commands, manual checks, CI/gate policy references, and evidence expectations.
- [ ] Human-readable docs use `output.language` from `.vibeRig/project.yaml`.
