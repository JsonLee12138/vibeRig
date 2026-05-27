# Post-Acceptance Retrospective

Use this flow only after the accepted-work gate passes.

## Required Gate

At least one accepted signal must be present:

- validation passed and acceptance reviewer passed
- code reviewer passed and PR was created
- PR merged
- Linear child issue moved to Done or accepted
- human handoff accepted

Do not run this retrospective for active implementation or speculative planning.

## Evidence Bundle

Expected fields:

```yaml
requirement_id: VB-123
task_id: T1
status: accepted
gate:
  validation_passed: true
  acceptance_passed: true
  code_review_passed: true
  pr_created: true
sources:
  task_contract: .vibeRig/requirements/VB-123/tasks.yaml
  acceptance: .vibeRig/requirements/VB-123/acceptance.md
  spec: .vibeRig/requirements/VB-123/spec.md
  plan: .vibeRig/requirements/VB-123/plan.md
git:
  branch: symphony/VB-123-T1
  base_sha: <sha>
  head_sha: <sha>
  changed_files: []
validation:
  commands: []
  result: passed
review:
  acceptance_notes: ""
  code_review_notes: ""
context_mode:
  available: false
```

## Finalizer Prompt

```text
Review only accepted work.

Use the provided evidence:
- task contract
- acceptance criteria
- implementation diff
- validation results
- review notes
- context-mode events if available

Extract durable learnings only if they are proven by the accepted outcome.

Do not learn from:
- failed attempts that were abandoned
- transient environment issues
- unmerged code
- one-off task details
- speculative preferences

Classify each candidate as:
project_note, workflow_rule, skill_update, or user_preference.

Auto-apply only low-risk high-confidence project notes.
For workflow rules, skill updates, and user preferences, produce a proposal unless the policy explicitly allows automatic application.

If there is no durable learning, output:
Nothing to save.
```
