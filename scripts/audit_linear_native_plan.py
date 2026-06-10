#!/usr/bin/env python3
"""Audit the repository against the Linear-native VibeRig redesign plan."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    evidence: str


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def exists(path: str) -> bool:
    return (ROOT / path).exists()


def contains(path: str, *needles: str) -> bool:
    text = read(path)
    return all(needle in text for needle in needles)


def not_contains(path: str, *needles: str) -> bool:
    text = read(path)
    return all(needle not in text for needle in needles)


def no_matching_file(name: str) -> bool:
    ignored_parts = {".git", ".worktrees", "__pycache__"}
    for path in ROOT.rglob(name):
        if ignored_parts.intersection(path.parts):
            continue
        return False
    return True


def build_checks() -> list[Check]:
    manifest = json.loads(read(".codex-plugin/plugin.json"))
    interface = manifest.get("interface", {})
    prompts = interface.get("defaultPrompt", [])

    removed_paths = [
        ".mcp.json",
        "api",
        "dashboard",
        "schemas/tasks.schema.json",
        "scripts/validate_tasks.py",
        "scripts/render_linear_children.py",
        "scripts/check_context_mode.py",
        "scripts/generate_insights_report.py",
        "scripts/apply_learning_candidates.py",
        "scripts/find_free_port.py",
        "scripts/record_runtime_port.py",
        "tests/test_viberig_codex_runner.py",
        "tests/test_viberig_task_engine.py",
    ]

    checks = [
        Check(
            "plugin is skill-only",
            "mcpServers" not in manifest and manifest.get("skills") == "./skills/",
            ".codex-plugin/plugin.json has no mcpServers and points at ./skills/",
        ),
        Check(
            "manifest advertises Linear-native workflow",
            "linear" in manifest.get("keywords", []) and "subagents" in manifest.get("keywords", []),
            ".codex-plugin/plugin.json keywords include linear and subagents",
        ),
        Check(
            "manifest has VibeRig default prompts",
            all(
                prompt in prompts
                for prompt in [
                    "Brainstorm a VibeRig requirement",
                    "Create Linear issues from this VibeRig requirement",
                    "Run the next VibeRig Linear task",
                    "Generate accepted-work insights",
                ]
            ),
            "interface.defaultPrompt includes brainstorm, Linear issue creation, task run, and insights prompts",
        ),
        Check(
            "removed local runtime paths are absent",
            all(not exists(path) for path in removed_paths),
            "MCP file, api, dashboard, local task scripts, and old runner/task-engine tests are absent",
        ),
        Check(
            "tasks.yaml is not a repository artifact",
            no_matching_file("tasks.yaml") and no_matching_file("tasks-yaml-template.md"),
            "no tasks.yaml or tasks-yaml-template.md outside ignored folders",
        ),
        Check(
            "init script writes Linear-native project config",
            contains(
                "scripts/init_project.py",
                "DEFAULT_DOCS_ROOT = \".vibeRig/requirements\"",
                "DEFAULT_WORKTREES_ROOT = \".worktrees\"",
                "DEFAULT_PR_REQUIRED = \"true\"",
                "linear_project_id",
                "linear_project_document_id",
                "worktrees_root: {quote_yaml(worktrees_root)}",
                "pull_request:",
                "subagents:",
                "main_agent_only: true",
            ),
            "scripts/init_project.py writes docs root, worktrees root, PR policy, Linear ids, subagents, and main-agent-only context-mode",
        ),
        Check(
            "project worktrees stay inside ignored .worktrees directory",
            contains(".gitignore", ".worktrees/")
            and contains(
                "skills/task-runner/SKILL.md",
                "workspace.worktrees_root",
                "<project-root>/.worktrees/<issue-key>-<short-slug>",
            ),
            "task worktrees default to <project-root>/.worktrees/ and the directory is gitignored",
        ),
        Check(
            "init skill uses project.yaml plus Linear Project Document",
            contains(
                "skills/init-viberig/SKILL.md",
                "Use the `linear` skill/plugin",
                "_list_teams",
                "_get_team",
                "_search",
                "_list_projects",
                "_save_project",
                "_list_documents",
                "_save_document",
                "Use both `.vibeRig/project.yaml` and the Linear Project Document",
                "partial local initialization",
            ),
            "init-viberig requires concrete Linear project/document search and save tools",
        ),
        Check(
            "brainstorm uses staged Docs as Code",
            contains(
                "skills/brainstorm/SKILL.md",
                "brief.md",
                "contract.schema.json",
                "acceptance.schema.json",
                "Adversarial Review",
                "diagrams/*.mmd",
            ),
            "brainstorm emits brief, schemas, acceptance, adversarial review, and Mermaid diagrams",
        ),
        Check(
            "write-plan maps local contracts to Linear issues",
            contains(
                "skills/write-plan/SKILL.md",
                "Linear is the task source of truth",
                "Language Policy",
                "user's current working language",
                "Do not translate stable IDs",
                "_list_issue_statuses",
                "_list_issue_labels",
                "_create_issue_label",
                "_list_issues",
                "_save_issue",
                "_save_comment",
                "Do not write `.vibeRig/requirements/{requirement-id}/tasks.yaml`",
            ),
            "write-plan creates/updates Linear issues with concrete Linear tools and user-language policy",
        ),
        Check(
            "task-runner uses subagents and forbids old runners",
            contains(
                "skills/task-runner/SKILL.md",
                "Every Linear task execution must declare and use a suitable subagent",
                "Default to an isolated git worktree",
                "<project-root>/.worktrees/",
                "<project-root>/.worktrees/<issue-key>-<short-slug>",
                "Worktree Policy",
                "Pull Request Policy",
                "submit the PR",
                "PR URL",
                "Linear Status Policy",
                "Human Acceptance",
                "stop before implementation and report the missing capability",
                "_get_issue",
                "_list_issues",
                "_list_comments",
                "_save_comment",
                "_save_issue",
                "Do not call `codex-cli-mcp`",
                "Do not call VibeRig dashboard/task-engine MCP tools or HTTP routes",
            ),
            "task-runner requires subagent delegation, worktree preflight, PR submission, human acceptance boundary, and concrete Linear tools",
        ),
        Check(
            "human-acceptance is manual, merges accepted PRs, finalizes Linear, learns, and archives docs",
            exists("skills/human-acceptance/SKILL.md")
            and contains(
                "skills/human-acceptance/SKILL.md",
                "Manual Trigger Only",
                "Do not use this skill automatically",
                "Git And PR Requirements",
                "merge the linked PR",
                "move the Linear issue to `Done`",
                "before running insights",
                "invoke `skill-builder`",
                "Requirement Document Archival",
                ".vibeRig/archive/requirements/",
                "Archive only docs tied to the accepted issue or requirement",
                "Do not overwrite existing archived requirement docs",
                "git worktree remove <path>",
                "Do not merge PRs for partial, rejected, blocked, or unverified acceptance",
                "Do not remove worktrees outside the configured project `.worktrees/` directory",
                "_get_issue",
                "_list_comments",
                "_list_issue_statuses",
                "_save_comment",
                "_save_issue",
                "post-acceptance insights",
            ),
            "human-acceptance records explicit user sign-off, merges accepted PRs, writes Linear terminal status before insights, routes skill updates through skill-builder, archives accepted docs, and cleans task worktrees",
        ),
        Check(
            "blocker and insights use concrete Linear tools",
            contains(
                "skills/blocker-resume/SKILL.md",
                "_list_projects",
                "_search",
                "_list_issues",
                "_get_issue",
                "_list_comments",
                "_save_comment",
                "_save_issue",
            )
            and contains(
                "skills/insights/SKILL.md",
                "_get_issue",
                "_list_comments",
                "_save_comment",
                "_save_document",
            ),
            "blocker-resume and insights read/write Linear through concrete app tools",
        ),
        Check(
            "subagent-routing enforces boundaries",
            contains(
                "skills/subagent-routing/SKILL.md",
                "Every Linear task execution must use a subagent",
                "must not use context-mode tools",
                "must not update Linear or project status",
                "must not make final acceptance decisions",
            ),
            "subagent-routing forbids context-mode, Linear updates, and final acceptance for subagents",
        ),
        Check(
            "proof packets stay in Linear comments",
            contains(
                "skills/task-runner/SKILL.md",
                "Proof packets are Linear comments",
                "Do not duplicate the proof packet into `.vibeRig/`",
            )
            and contains(
                "skills/insights/SKILL.md",
                "Do not write proof packets into `.vibeRig/`",
            ),
            "task-runner and insights keep proof packets out of local long-term directories",
        ),
        Check(
            "tests cover local Linear-native initialization",
            contains(
                "tests/test_init_project.py",
                "test_plugin_is_skill_only_without_viberig_mcp_server",
                "test_init_writes_linear_native_project_yaml_and_keeps_codex_config_unmanaged",
                "test_existing_project_yaml_is_migrated_with_required_sections",
            ),
            "tests validate skill-only manifest, project.yaml output, and migration sections",
        ),
        Check(
            "old architecture references are only negative guardrails",
            not_contains(
                "README.md",
                "SQLite",
                "codex-cli-mcp",
                ".vibeRig/proof",
            )
            and not_contains(
                "README.zh-CN.md",
                "SQLite",
                "codex-cli-mcp",
                ".vibeRig/proof",
            ),
            "README files no longer recommend SQLite, codex-cli-mcp, or local proof directories",
        ),
    ]

    return checks


def main() -> int:
    checks = build_checks()
    failed = [check for check in checks if not check.passed]
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"{status} {check.name}: {check.evidence}")

    if failed:
        print(f"\n{len(failed)} check(s) failed.", file=sys.stderr)
        return 1

    print("\nLinear-native redesign local audit passed.")
    print("External Linear API effects are governed by the Linear skill/plugin and require an authenticated Codex session.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
