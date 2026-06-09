# VibeRig

VibeRig is a Codex plugin for Linear-native software delivery. It turns rough requirements into local Docs as Code contracts, maps accepted planning output into Linear issues, routes execution through suitable Codex subagents, and records proof, acceptance, and learning back into Linear.

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md)

## Contents

1. [Prerequisites](#prerequisites)
2. [Install](#install)
3. [Update](#update)
4. [Manual Usage](#manual-usage)
5. [Built-In Skills And Subagents](#built-in-skills-and-subagents)
6. [Workflow](#workflow)

## Prerequisites

- Codex with plugin support enabled.
- Linear plugin installed and authenticated. VibeRig uses Linear to create and update projects, documents, issues, comments, and status transitions.

## Install

Add the VibeRig marketplace and install the plugin:

```sh
codex plugin marketplace add JsonLee12138/vibeRig --ref main
codex plugin add vibe-rig@viberig
```

Current selector format is `PLUGIN@MARKETPLACE`. In this repository, the marketplace is `viberig` and the plugin is `vibe-rig`.

## Update

Refresh the marketplace snapshot:

```sh
codex plugin marketplace upgrade viberig
```

Then reinstall the plugin if your Codex installation does not refresh installed plugin caches automatically:

```sh
codex plugin remove vibe-rig
codex plugin add vibe-rig@viberig
```

Restart Codex after updating so newly installed skills are loaded.

## Manual Usage

Use VibeRig by asking Codex to run the relevant skill in a target project.

Typical prompts:

- `Use init-viberig for this repo.`
- `Use brainstorm for this requirement: ...`
- `Use write-plan for .vibeRig/requirements/<requirement-id>.`
- `Use task-runner for Linear issue ABC-123.`
- `Use human-acceptance: all ACs are accepted for ABC-123.`
- `Use insights for the accepted Linear work.`

Project-local files created or used by VibeRig:

```text
.vibeRig/
  project.yaml
  requirements/
.worktrees/
  <issue-key>-<short-slug>/
```

Linear is the task and status surface. Local requirement documents are contracts, not issues.

## Built-In Skills And Subagents

Skills:

- `init-viberig`: initializes `.vibeRig/project.yaml`, `.vibeRig/requirements/`, `.worktrees/`, Linear project registration, gate policy, PR policy, and default routing.
- `brainstorm`: turns a rough idea into local Docs as Code requirement contracts.
- `write-plan`: creates or updates Linear issues and sub-issues from local acceptance criteria.
- `task-runner`: executes a Linear task in the current Codex session, delegates to a suitable subagent, validates, submits a PR, and writes a Linear proof packet.
- `human-acceptance`: records explicit human acceptance or rejection; on full acceptance it merges the PR, cleans the task worktree, updates Linear final status, and triggers insights.
- `insights`: generates conservative post-acceptance learning candidates.
- `subagent-routing`: chooses and briefs specialized subagents while keeping context-mode and Linear updates in the main agent.
- `agent-creator`: helps create or update project-local Codex custom subagents.
- `agent-sop`: runs staged implementation, validation, QA, and rework orchestration.
- `blocker-resume`: inspects blocked Linear work and either resumes through task execution or asks for the missing decision.

Bundled subagent prompt entries:

- `Agent Creator`
- `Agent SOP`
- `Brainstorm`
- `Subagent Routing`
- `Task Runner`

Specialized implementation, QA, review, research, or integration subagents are project/user agents. VibeRig routes to them through `subagent-routing`; subagents must not use context-mode, update Linear, or make final acceptance decisions.

## Workflow

1. Initialize the project with `init-viberig`.
2. Discover and structure a requirement with `brainstorm`; review the generated files under `.vibeRig/requirements/<requirement-id>/`.
3. Convert accepted planning output into Linear issues with `write-plan`.
4. Execute a Linear issue with `task-runner`; VibeRig defaults to a project-local `.worktrees/<issue-key>-<short-slug>/` worktree, validates the result, submits or updates a PR, writes the proof packet to Linear, and moves the issue to a human-acceptance/review state.
5. Manually call `human-acceptance` after reviewing the work. Full acceptance merges the PR, removes the task worktree when safe, updates the final Linear status, and runs post-acceptance insights.
6. Apply any proposed skill or workflow updates only after explicit user confirmation.
