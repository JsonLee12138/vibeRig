#!/usr/bin/env python3
"""Initialize a target project for the Linear-native VibeRig workflow."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


DEFAULT_DOCS_ROOT = ".vibeRig/requirements"
DEFAULT_WORKTREES_ROOT = ".worktrees"
DEFAULT_PR_REQUIRED = "true"
DEFAULT_PR_PROVIDER = "auto"


def quote_yaml(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def yaml_list(values: list[str], indent: int = 2) -> str:
    prefix = " " * indent
    if not values:
        return f"{prefix}[]"
    return "\n".join(f"{prefix}- {quote_yaml(value)}" for value in values)


def git_remote_url(root: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return ""
    return result.stdout.strip()


def project_yaml_template(
    *,
    project_name: str,
    docs_root: str,
    worktrees_root: str,
    linear_team_id: str,
    linear_project_id: str,
    linear_project_document_id: str,
    linear_project_document_title: str,
    ci_required: str,
    required_commands: list[str],
    manual_checks: list[str],
    repo_url: str,
    pr_required: str,
    pr_provider: str,
    pr_base_branch: str,
    pr_draft: str,
) -> str:
    return f"""version: 1
project:
  name: {quote_yaml(project_name)}
  root: "."
  repo_url: {quote_yaml(repo_url)}
docs:
  root: {quote_yaml(docs_root)}
workspace:
  worktrees_root: {quote_yaml(worktrees_root)}
pull_request:
  required: {quote_yaml(pr_required)}
  provider: {quote_yaml(pr_provider)}
  base_branch: {quote_yaml(pr_base_branch)}
  draft: {quote_yaml(pr_draft)}
linear:
  team_id: {quote_yaml(linear_team_id)}
  project_id: {quote_yaml(linear_project_id)}
  project_document_id: {quote_yaml(linear_project_document_id)}
  project_document_title: {quote_yaml(linear_project_document_title)}
gate_policy:
  ci_required: {quote_yaml(ci_required)}
  required_commands:
{yaml_list(required_commands, indent=4)}
  manual_checks:
{yaml_list(manual_checks, indent=4)}
subagents:
  default_research: "researcher"
  default_planning: "planner"
  default_implementation: "implementation"
  default_qa: "qa"
  default_review: "code_review"
  default_integration: "integrator"
context_mode:
  main_agent_only: true
"""


def write_if_missing(path: Path, content: str) -> bool:
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def ensure_project_yaml(path: Path, content: str) -> bool:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return True

    existing = path.read_text(encoding="utf-8")
    updated = existing
    if "\ndocs:" not in f"\n{updated}":
        updated += "\ndocs:\n  root: \".vibeRig/requirements\"\n"
    if "\nworkspace:" not in f"\n{updated}":
        updated += "\nworkspace:\n  worktrees_root: \".worktrees\"\n"
    if "\npull_request:" not in f"\n{updated}":
        updated += (
            "\npull_request:\n"
            "  required: \"true\"\n"
            "  provider: \"auto\"\n"
            "  base_branch: \"\"\n"
            "  draft: \"false\"\n"
        )
    if "\nlinear:" not in f"\n{updated}":
        updated += (
            "\nlinear:\n"
            "  team_id: \"\"\n"
            "  project_id: \"\"\n"
            "  project_document_id: \"\"\n"
            "  project_document_title: \"VibeRig Project Registration\"\n"
        )
    if "\ngate_policy:" not in f"\n{updated}":
        updated += "\ngate_policy:\n  ci_required: \"project_decides\"\n  required_commands: []\n  manual_checks: []\n"
    if "\nsubagents:" not in f"\n{updated}":
        updated += (
            "\nsubagents:\n"
            "  default_research: \"researcher\"\n"
            "  default_planning: \"planner\"\n"
            "  default_implementation: \"implementation\"\n"
            "  default_qa: \"qa\"\n"
            "  default_review: \"code_review\"\n"
            "  default_integration: \"integrator\"\n"
        )
    if "\ncontext_mode:" not in f"\n{updated}":
        updated += "\ncontext_mode:\n  main_agent_only: true\n"
    if updated == existing:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root", nargs="?", default=".")
    parser.add_argument("--project-name")
    parser.add_argument("--docs-root", default=DEFAULT_DOCS_ROOT)
    parser.add_argument("--worktrees-root", default=DEFAULT_WORKTREES_ROOT)
    parser.add_argument("--pr-required", default=DEFAULT_PR_REQUIRED)
    parser.add_argument("--pr-provider", default=DEFAULT_PR_PROVIDER)
    parser.add_argument("--pr-base-branch", default="")
    parser.add_argument("--pr-draft", default="false")
    parser.add_argument("--linear-team-id", default="")
    parser.add_argument("--linear-project-id", default="")
    parser.add_argument("--linear-project-document-id", default="")
    parser.add_argument("--linear-project-document-title", default="VibeRig Project Registration")
    parser.add_argument("--ci-required", default="project_decides")
    parser.add_argument("--required-command", action="append", default=[])
    parser.add_argument("--manual-check", action="append", default=[])
    parser.add_argument("--install-command", default="")
    parser.add_argument("--dev-command", default="")
    parser.add_argument("--test-command", default="")

    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    project_name = args.project_name or root.name
    docs_root = args.docs_root.strip("/") or DEFAULT_DOCS_ROOT
    worktrees_root = args.worktrees_root.strip("/") or DEFAULT_WORKTREES_ROOT
    docs_path = root / docs_root
    worktrees_path = root / worktrees_root
    project_yaml_path = root / ".vibeRig" / "project.yaml"

    required_commands = list(args.required_command)
    for command in [args.install_command, args.dev_command, args.test_command]:
        if command and command not in required_commands:
            required_commands.append(command)

    content = project_yaml_template(
        project_name=project_name,
        docs_root=docs_root,
        worktrees_root=worktrees_root,
        linear_team_id=args.linear_team_id,
        linear_project_id=args.linear_project_id,
        linear_project_document_id=args.linear_project_document_id,
        linear_project_document_title=args.linear_project_document_title,
        ci_required=args.ci_required,
        required_commands=required_commands,
        manual_checks=list(args.manual_check),
        repo_url=git_remote_url(root),
        pr_required=args.pr_required,
        pr_provider=args.pr_provider,
        pr_base_branch=args.pr_base_branch,
        pr_draft=args.pr_draft,
    )

    created_or_updated: list[str] = []
    docs_path.mkdir(parents=True, exist_ok=True)
    created_or_updated.append(str(docs_path))
    worktrees_path.mkdir(parents=True, exist_ok=True)
    created_or_updated.append(str(worktrees_path))
    if ensure_project_yaml(project_yaml_path, content):
        created_or_updated.append(str(project_yaml_path))

    print("Initialized Linear-native VibeRig project:")
    print(root)
    print("Created or ensured:")
    for item in created_or_updated:
        print(f"- {item}")
    print("Next steps:")
    print("- Use the Linear plugin/skill to select or create the Linear Project.")
    print("- Create or update the Linear Project Document for project registration.")
    print("- Keep requirement contracts under .vibeRig/requirements/.")
    print("- Keep VibeRig task worktrees under .worktrees/.")
    print("- Submit a pull request before moving task work to human acceptance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
