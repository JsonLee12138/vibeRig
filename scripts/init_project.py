#!/usr/bin/env python3
"""Initialize a target project for VibeRig."""

from __future__ import annotations

import argparse
import shlex
import subprocess
from pathlib import Path


CONFIG_TEMPLATE = """project:
  name: {project_name}
  root: .
worktrees:
  root: ./worktrees
  default_base: origin/main
  sync_before_pr: merge
symphony:
  runtime: plugin
  plugin_root: "{plugin_root}"
  workflow_planning: ./WORKFLOW.planning.md
  workflow_implementation: ./WORKFLOW.implementation.md
  setup_command: ./.vibeRig/bin/symphony-setup
  planning_command: ./.vibeRig/bin/symphony-planning
  implementation_command: ./.vibeRig/bin/symphony-implementation
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


def detect_plugin_root() -> Path:
    return Path(__file__).resolve().parents[1]


def write_if_missing(path: Path, content: str) -> bool:
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def write_executable(path: Path, content: str) -> bool:
    previous = path.read_text(encoding="utf-8") if path.exists() else None
    path.write_text(content, encoding="utf-8")
    path.chmod(0o755)
    return previous != content


def project_command(command_name: str, plugin_root: Path) -> str:
    script_name = {
        "symphony-setup": "symphony_setup.sh",
        "symphony-planning": "symphony_run_planning.sh",
        "symphony-implementation": "symphony_run_implementation.sh",
    }[command_name]
    embedded_plugin_root = shlex.quote(str(plugin_root))
    if command_name == "symphony-setup":
        exec_line = 'exec "${PLUGIN_ROOT}/scripts/symphony_setup.sh" "$@"'
    elif command_name == "symphony-planning":
        exec_line = 'exec "${PLUGIN_ROOT}/scripts/symphony_run_planning.sh" "${PROJECT_ROOT}" "$@"'
    else:
        exec_line = 'exec "${PLUGIN_ROOT}/scripts/symphony_run_implementation.sh" "${PROJECT_ROOT}" "$@"'
    return f"""#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${{BASH_SOURCE[0]}}")/../.." && pwd)"
DEFAULT_PLUGIN_ROOT="${{PROJECT_ROOT}}/plugins/vibe-rig"
EMBEDDED_PLUGIN_ROOT={embedded_plugin_root}
PLUGIN_ROOT="${{VIBERIG_PLUGIN_ROOT:-}}"

if [[ -z "${{PLUGIN_ROOT}}" ]]; then
  if [[ -x "${{DEFAULT_PLUGIN_ROOT}}/scripts/{script_name}" ]]; then
    PLUGIN_ROOT="${{DEFAULT_PLUGIN_ROOT}}"
  else
    PLUGIN_ROOT="${{EMBEDDED_PLUGIN_ROOT}}"
  fi
fi

if [[ ! -x "${{PLUGIN_ROOT}}/scripts/{script_name}" ]]; then
  echo "VibeRig plugin command not found: ${{PLUGIN_ROOT}}/scripts/{script_name}"
  echo "Set VIBERIG_PLUGIN_ROOT or install VibeRig at ./plugins/vibe-rig."
  exit 1
fi

{exec_line}
"""


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
    parser.add_argument("--setup-symphony", action="store_true")
    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    project_name = args.project_name or root.name
    plugin_root = detect_plugin_root()

    created: list[str] = []
    for directory in [
        root / ".vibeRig" / "requirements",
        root / ".vibeRig" / "insights",
        root / ".vibeRig" / "bin",
        root / ".codex" / "agents",
        root / "worktrees",
    ]:
        directory.mkdir(parents=True, exist_ok=True)
        created.append(str(directory))

    config = CONFIG_TEMPLATE.format(
        project_name=project_name,
        plugin_root=plugin_root,
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
    for command_name in ["symphony-setup", "symphony-planning", "symphony-implementation"]:
        command_path = root / ".vibeRig" / "bin" / command_name
        if write_executable(command_path, project_command(command_name, plugin_root)):
            created.append(str(command_path))
    if append_gitignore(root / ".gitignore"):
        created.append(str(root / ".gitignore"))

    print("Initialized VibeRig project:")
    print(root)
    print("Created or ensured:")
    for item in created:
        print(f"- {item}")
    if args.setup_symphony:
        subprocess.run([str(root / ".vibeRig" / "bin" / "symphony-setup")], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
