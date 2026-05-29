#!/usr/bin/env python3
"""Initialize a target project for VibeRig."""

from __future__ import annotations

import argparse
import re
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
viberig:
  service_url: http://127.0.0.1:49160
  service_port: 49160
  autostart: true
  user_entry: panel
  task_engine: local
ports:
  preview_start: 49200
  strategy: find-next-free
context_mode:
  required: false
  install_method: codex-plugin-marketplace
  marketplace: mksglu/context-mode
  status_file: ./.vibeRig/context-mode.md
runner:
  codex:
    adapter: codex-cli-mcp
    mcp_command: npx -y codex-mcp-server
    mcp_tool: codex
    enable_features:
      - hooks
    sandbox: workspace-write
    full_auto: false
    mcp_initialize_timeout_ms: 60000
    mcp_tool_timeout_ms: 600000
    turn_timeout_ms: 600000
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


VIBERIG_CONFIG_SNIPPET = """viberig:
  service_url: http://127.0.0.1:49160
  service_port: 49160
  autostart: true
  user_entry: panel
  task_engine: local
"""


CODEX_CLI_MCP_CONFIG_SNIPPET = """runner:
  codex:
    adapter: codex-cli-mcp
    mcp_command: npx -y codex-mcp-server
    mcp_tool: codex
    enable_features:
      - hooks
    sandbox: workspace-write
    full_auto: false
    mcp_initialize_timeout_ms: 60000
    mcp_tool_timeout_ms: 600000
    turn_timeout_ms: 600000
"""


def detect_plugin_root() -> Path:
    return Path(__file__).resolve().parents[1]


def write_if_missing(path: Path, content: str) -> bool:
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def ensure_config(path: Path, content: str) -> bool:
    if not path.exists():
        path.write_text(content, encoding="utf-8")
        return True
    existing = path.read_text(encoding="utf-8")
    updated = existing
    if "\nviberig:" not in f"\n{updated}":
        prefix = "" if updated.endswith("\n") else "\n"
        updated = updated + prefix + VIBERIG_CONFIG_SNIPPET
    elif "task_engine:" not in updated:
        updated = updated.replace("  user_entry: panel\n", "  user_entry: panel\n  task_engine: local\n", 1)
    if "\nrunner:" not in f"\n{updated}":
        prefix = "" if updated.endswith("\n") else "\n"
        updated = updated + prefix + CODEX_CLI_MCP_CONFIG_SNIPPET
    if updated == existing:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def ensure_codex_hooks_config(path: Path) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("[features]\nhooks = true\n", encoding="utf-8")
        return True

    existing = path.read_text(encoding="utf-8")
    lines = existing.splitlines(keepends=True)
    section_start: int | None = None
    section_end = len(lines)
    for index, line in enumerate(lines):
        if re.match(r"^\s*\[features\]\s*(?:#.*)?$", line):
            section_start = index
            continue
        if section_start is not None and index > section_start and re.match(r"^\s*\[.*\]\s*(?:#.*)?$", line):
            section_end = index
            break

    if section_start is None:
        separator = "\n" if existing and not existing.endswith("\n") else ""
        updated = existing + separator + ("\n" if existing else "") + "[features]\nhooks = true\n"
    else:
        hook_line_index: int | None = None
        for index in range(section_start + 1, section_end):
            if re.match(r"^\s*hooks\s*=", lines[index]):
                hook_line_index = index
                break
        if hook_line_index is None:
            lines.insert(section_start + 1, "hooks = true\n")
        elif not re.match(r"^\s*hooks\s*=\s*true\s*(?:#.*)?$", lines[hook_line_index]):
            newline = "\n" if lines[hook_line_index].endswith("\n") else ""
            lines[hook_line_index] = "hooks = true" + newline
        updated = "".join(lines)

    if updated == existing:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def write_executable(path: Path, content: str) -> bool:
    previous = path.read_text(encoding="utf-8") if path.exists() else None
    path.write_text(content, encoding="utf-8")
    path.chmod(0o755)
    return previous != content


def project_command(command_name: str, plugin_root: Path) -> str:
    script_path = {
        "viberig": "api/server.py",
    }[command_name]
    embedded_plugin_root = shlex.quote(str(plugin_root))
    exec_line = 'exec python3 "${PLUGIN_ROOT}/api/server.py" "$@"'
    return f"""#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${{BASH_SOURCE[0]}}")/../.." && pwd)"
DEFAULT_PLUGIN_ROOT="${{PROJECT_ROOT}}/plugins/vibe-rig"
EMBEDDED_PLUGIN_ROOT={embedded_plugin_root}
PLUGIN_ROOT="${{VIBERIG_PLUGIN_ROOT:-}}"

if [[ -z "${{PLUGIN_ROOT}}" ]]; then
  if [[ -x "${{DEFAULT_PLUGIN_ROOT}}/{script_path}" ]]; then
    PLUGIN_ROOT="${{DEFAULT_PLUGIN_ROOT}}"
  else
    PLUGIN_ROOT="${{EMBEDDED_PLUGIN_ROOT}}"
  fi
fi

if [[ ! -x "${{PLUGIN_ROOT}}/{script_path}" ]]; then
  echo "VibeRig plugin command not found: ${{PLUGIN_ROOT}}/{script_path}"
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
    parser.add_argument("--skip-global-service", action="store_true")
    parser.add_argument("--no-autostart", action="store_true")
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
        linear_project_slug=args.linear_project_slug,
        install_command=args.install_command,
        dev_command=args.dev_command,
        test_command=args.test_command,
    )
    if ensure_config(root / ".vibeRig" / "config.yaml", config):
        created.append(str(root / ".vibeRig" / "config.yaml"))
    if ensure_codex_hooks_config(root / ".codex" / "config.toml"):
        created.append(str(root / ".codex" / "config.toml"))
    if write_if_missing(root / ".vibeRig" / "insights" / "candidates.md", CANDIDATES_TEMPLATE):
        created.append(str(root / ".vibeRig" / "insights" / "candidates.md"))
    if write_if_missing(root / ".vibeRig" / "insights" / "confirmed.md", CONFIRMED_TEMPLATE):
        created.append(str(root / ".vibeRig" / "insights" / "confirmed.md"))
    if write_if_missing(root / ".vibeRig" / "context-mode.md", CONTEXT_MODE_STATUS_TEMPLATE):
        created.append(str(root / ".vibeRig" / "context-mode.md"))
    for command_name in ["viberig"]:
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
    if not args.skip_global_service:
        service_script = plugin_root / "api" / "server.py"
        ensure_cmd = ["python3", str(service_script), "ensure"]
        if not args.no_autostart:
            ensure_cmd.append("--install-autostart")
        subprocess.run(ensure_cmd, check=True)
        subprocess.run(
            [
                "python3",
                str(service_script),
                "register",
                str(root),
                "--project-name",
                project_name,
                "--plugin-root",
                str(plugin_root),
            ],
            check=True,
        )
        print("VibeRig panel: http://127.0.0.1:49160")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
