#!/usr/bin/env python3
"""Initialize a target project for VibeRig."""

from __future__ import annotations

import argparse
import os
from pathlib import Path


CONFIG_TEMPLATE = """project:
  name: {project_name}
  root: .
worktrees:
  root: ./worktrees
  default_base: origin/main
  sync_before_pr: merge
symphony:
  runtime: plugin-submodule
  workflow_planning: ./WORKFLOW.planning.md
  workflow_implementation: ./WORKFLOW.implementation.md
  dashboard_ports:
    planning_start: 49170
    implementation_start: 49180
ports:
  preview_start: 49200
  strategy: find-next-free
context_mode:
  required: false
  install_method: codex-plugin-marketplace
  marketplace: mksglu/context-mode
  status_file: ./.vibeRig/context-mode.md
insights:
  enabled: true
  trigger: post_acceptance
  auto_apply_project_notes: true
  auto_apply_workflow_rules: false
  auto_apply_skill_updates: false
  auto_apply_user_preferences: false
linear:
  project_slug: "{linear_project_slug}"
  planning_states:
    - Planning
  implementation_states:
    - Todo
    - In Progress
    - Rework
commands:
  install: "{install_command}"
  dev: "{dev_command}"
  test: "{test_command}"
"""


PLANNING_WORKFLOW = """# VibeRig Planning Workflow

Process parent issues in the Planning state.

1. Run VibeRig brainstorm for the requirement.
2. Run VibeRig write-plan.
3. Validate .vibeRig/requirements/<requirement>/tasks.yaml.
4. Render Linear child issues from tasks.yaml.
5. Move the parent issue to Planned or Human Review.
6. After the review gate passes, run the VibeRig insights planning retrospective.

Constraints:
- Do not implement business code.
- Use .vibeRig/requirements/<requirement>/ for planning artifacts.
- Child issue contracts must be self-contained enough to run without an unmerged planning worktree.
- Learning candidates must come only from accepted planning outcomes.
"""


IMPLEMENTATION_WORKFLOW = """# VibeRig Implementation Workflow

Process child issues in implementation states.

1. Read the task contract.
2. Confirm dependencies are complete.
3. Fetch origin/main.
4. Create a branch and worktree under ./worktrees.
5. Run the implementation subagent for the task scope.
6. Run validation.
7. Run acceptance and code review subagents.
8. Open a PR or write a handoff.
9. After validation, acceptance review, and code review pass, run the VibeRig insights post-acceptance finalizer.

Stop if the task contract is missing, dependencies are incomplete, base sync fails, scope is exceeded, or validation has no executable or manual fallback.

At task start, read confirmed learnings from .vibeRig/insights/confirmed.md when present, but do not write new learnings during implementation.
"""


GITIGNORE_SNIPPET = """
# VibeRig local worktrees and runtime state
worktrees/
.vibeRig/runtime.json
.vibeRig/context-mode.md
"""


CANDIDATES_TEMPLATE = """# VibeRig Learning Candidates

Candidates here are proposed from accepted work only. Do not treat them as
confirmed project policy until they are reviewed or explicitly auto-applied by
the VibeRig learning policy.
"""


CONFIRMED_TEMPLATE = """# VibeRig Confirmed Learnings

Confirmed learnings are safe to use during development. Implementation agents
may read this file before starting work, but should not edit it during active
implementation.
"""


CONTEXT_MODE_STATUS_TEMPLATE = """# Context Mode Status

Context-mode is an optional VibeRig evidence source.

Expected installation path:

```sh
codex plugin marketplace add mksglu/context-mode
```

Status: not checked
"""


def write_if_missing(path: Path, content: str) -> bool:
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def append_gitignore(path: Path) -> bool:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    needed = []
    for line in ["worktrees/", ".vibeRig/runtime.json"]:
        if line not in existing.splitlines():
            needed.append(line)
    if not needed:
        return False
    prefix = "" if not existing or existing.endswith("\n") else "\n"
    path.write_text(existing + prefix + GITIGNORE_SNIPPET.lstrip(), encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root", nargs="?", default=".")
    parser.add_argument("--project-name")
    parser.add_argument("--linear-project-slug", default="")
    parser.add_argument("--install-command", default="")
    parser.add_argument("--dev-command", default="")
    parser.add_argument("--test-command", default="")
    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    project_name = args.project_name or root.name

    created: list[str] = []
    for directory in [
        root / ".vibeRig" / "requirements",
        root / ".vibeRig" / "insights",
        root / ".codex" / "agents",
        root / "worktrees",
    ]:
        directory.mkdir(parents=True, exist_ok=True)
        created.append(str(directory))

    config = CONFIG_TEMPLATE.format(
        project_name=project_name,
        linear_project_slug=args.linear_project_slug,
        install_command=args.install_command,
        dev_command=args.dev_command,
        test_command=args.test_command,
    )
    if write_if_missing(root / ".vibeRig" / "config.yaml", config):
        created.append(str(root / ".vibeRig" / "config.yaml"))
    if write_if_missing(root / ".vibeRig" / "insights" / "candidates.md", CANDIDATES_TEMPLATE):
        created.append(str(root / ".vibeRig" / "insights" / "candidates.md"))
    if write_if_missing(root / ".vibeRig" / "insights" / "confirmed.md", CONFIRMED_TEMPLATE):
        created.append(str(root / ".vibeRig" / "insights" / "confirmed.md"))
    if write_if_missing(root / ".vibeRig" / "context-mode.md", CONTEXT_MODE_STATUS_TEMPLATE):
        created.append(str(root / ".vibeRig" / "context-mode.md"))
    if write_if_missing(root / "WORKFLOW.planning.md", PLANNING_WORKFLOW):
        created.append(str(root / "WORKFLOW.planning.md"))
    if write_if_missing(root / "WORKFLOW.implementation.md", IMPLEMENTATION_WORKFLOW):
        created.append(str(root / "WORKFLOW.implementation.md"))
    if append_gitignore(root / ".gitignore"):
        created.append(str(root / ".gitignore"))

    print("Initialized VibeRig project:")
    print(root)
    print("Created or ensured:")
    for item in created:
        print(f"- {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
