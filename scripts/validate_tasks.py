#!/usr/bin/env python3
"""Validate a VibeRig tasks.yaml file."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def load_yaml(path: Path) -> Any:
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "PyYAML is required to parse tasks.yaml. Install it with `python3 -m pip install PyYAML`."
        ) from exc
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate(data: Any) -> list[str]:
    errors: list[str] = []
    require(isinstance(data, dict), "root must be an object", errors)
    if not isinstance(data, dict):
        return errors

    for key in ["requirement_id", "title", "source_docs", "base_policy", "agents", "tasks"]:
        require(key in data, f"missing required key: {key}", errors)

    base_policy = data.get("base_policy") or {}
    require(base_policy.get("default_base") == "origin/main", "base_policy.default_base must be origin/main", errors)
    require(base_policy.get("worktree_root") == "./worktrees", "base_policy.worktree_root must be ./worktrees", errors)
    for key in ["require_fetch_before_worktree", "require_base_sha_record", "require_sync_before_pr"]:
        require(base_policy.get(key) is True, f"base_policy.{key} must be true", errors)

    source_docs = data.get("source_docs") or {}
    for key in ["requirement", "research", "acceptance", "roadmap", "spec", "plan"]:
        require(isinstance(source_docs.get(key), str) and bool(source_docs.get(key)), f"source_docs.{key} is required", errors)

    agents = data.get("agents") or {}
    for key in ["task_splitter", "implementation_default", "acceptance_default", "code_review_default"]:
        require(isinstance(agents.get(key), str) and bool(agents.get(key)), f"agents.{key} is required", errors)

    tasks = data.get("tasks")
    require(isinstance(tasks, list) and bool(tasks), "tasks must be a non-empty list", errors)
    if not isinstance(tasks, list):
        return errors

    task_ids: set[str] = set()
    for index, task in enumerate(tasks):
        prefix = f"tasks[{index}]"
        require(isinstance(task, dict), f"{prefix} must be an object", errors)
        if not isinstance(task, dict):
            continue
        task_id = task.get("id")
        require(isinstance(task_id, str) and bool(task_id), f"{prefix}.id is required", errors)
        if isinstance(task_id, str):
            require(task_id not in task_ids, f"duplicate task id: {task_id}", errors)
            task_ids.add(task_id)
        for key in ["title", "type", "suggested_agent", "acceptance_agent", "review_agent"]:
            require(isinstance(task.get(key), str) and bool(task.get(key)), f"{prefix}.{key} is required", errors)
        require(isinstance(task.get("priority"), int) and task.get("priority") >= 1, f"{prefix}.priority must be an integer >= 1", errors)
        require(isinstance(task.get("depends_on"), list), f"{prefix}.depends_on must be a list", errors)
        require(isinstance(task.get("parallelizable"), bool), f"{prefix}.parallelizable must be boolean", errors)
        branch = task.get("branch")
        require(isinstance(branch, str) and branch.startswith("viberig/"), f"{prefix}.branch must start with viberig/", errors)
        worktree_hint = task.get("worktree_hint")
        require(isinstance(worktree_hint, str) and worktree_hint.startswith("./worktrees/"), f"{prefix}.worktree_hint must start with ./worktrees/", errors)
        scope = task.get("scope") or {}
        require(isinstance(scope.get("include"), list) and bool(scope.get("include")), f"{prefix}.scope.include must be a non-empty list", errors)
        require(isinstance(scope.get("exclude"), list), f"{prefix}.scope.exclude must be a list", errors)
        require(isinstance(task.get("acceptance_refs"), list) and bool(task.get("acceptance_refs")), f"{prefix}.acceptance_refs must be non-empty", errors)
        require(isinstance(task.get("validation"), list) and bool(task.get("validation")), f"{prefix}.validation must be non-empty", errors)
        review = task.get("review") or {}
        require(review.get("ai_review_required") is True, f"{prefix}.review.ai_review_required should be true", errors)
        require(isinstance(review.get("human_runtime_check"), str), f"{prefix}.review.human_runtime_check is required", errors)
        linear = task.get("linear") or {}
        require(isinstance(linear.get("parent"), str) and bool(linear.get("parent")), f"{prefix}.linear.parent is required", errors)
        require(isinstance(linear.get("labels"), list), f"{prefix}.linear.labels must be a list", errors)

    for index, task in enumerate(tasks):
        if not isinstance(task, dict):
            continue
        for dep in task.get("depends_on") or []:
            require(dep in task_ids, f"tasks[{index}] depends on unknown task id: {dep}", errors)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tasks_yaml")
    parser.add_argument("--json", action="store_true", help="Print JSON result")
    args = parser.parse_args()

    data = load_yaml(Path(args.tasks_yaml))
    errors = validate(data)
    if args.json:
        print(json.dumps({"valid": not errors, "errors": errors}, indent=2))
    elif errors:
        print("tasks.yaml is invalid:")
        for error in errors:
            print(f"- {error}")
    else:
        print("tasks.yaml is valid")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
