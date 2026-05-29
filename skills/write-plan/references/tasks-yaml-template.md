# tasks.yaml Template

```yaml
requirement_id: VB-123
title: Example requirement
source_docs:
  requirement: .vibeRig/requirements/VB-123/requirement.md
  research: null # optional; set to .vibeRig/requirements/VB-123/research.md when present
  acceptance: .vibeRig/requirements/VB-123/acceptance.md
  acceptance_human: null # optional; set to .vibeRig/requirements/VB-123/acceptance-human.md when present
  roadmap: .vibeRig/requirements/VB-123/roadmap.md
  spec: .vibeRig/requirements/VB-123/spec.md
  plan: .vibeRig/requirements/VB-123/plan.md
base_policy:
  default_base: origin/main
  worktree_root: ./worktrees
  require_fetch_before_worktree: true
  require_base_sha_record: true
  require_sync_before_pr: true
agents:
  task_splitter: planning_task_splitter
  implementation_default: implementation_engineer
  acceptance_default: acceptance_reviewer
  code_review_default: code_reviewer
tasks:
  - id: T1
    title: Add backend API support
    type: backend
    suggested_agent: backend_implementer
    acceptance_agent: acceptance_reviewer
    review_agent: code_reviewer
    priority: 1
    depends_on: []
    parallelizable: true
    branch: viberig/VB-123-T1
    worktree_hint: ./worktrees/VB-123-T1
    scope:
      include:
        - server/**
      exclude:
        - web/**
    acceptance_refs:
      - AC-A1
      - AC-M1
    validation:
      - go test ./...
      - "[AC-M1] Manual: verify the new API behavior in the target environment and record the observed response."
    review:
      ai_review_required: true
      human_runtime_check: optional
    linear:
      parent: VB-123
      labels:
        - viberig
        - generated
        - backend
```
