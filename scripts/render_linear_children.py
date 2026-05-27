#!/usr/bin/env python3
"""Render Linear child issue markdown files from tasks.yaml."""

from __future__ import annotations

import argparse
import re
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


def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "task"


def render_task(requirement_id: str, task: dict[str, Any]) -> str:
    depends = task.get("depends_on") or []
    scope = task.get("scope") or {}
    review = task.get("review") or {}
    linear = task.get("linear") or {}
    labels = linear.get("labels") or []
    return f"""# {requirement_id} {task.get("id")}: {task.get("title")}

## Task Contract

- Requirement: {requirement_id}
- Task: {task.get("id")}
- Type: {task.get("type")}
- Branch: {task.get("branch")}
- Worktree: {task.get("worktree_hint")}
- Depends on: {", ".join(depends) if depends else "none"}
- Priority: {task.get("priority")}
- Parallelizable: {task.get("parallelizable")}

## Scope

Include:
{chr(10).join(f"- {item}" for item in scope.get("include", []))}

Exclude:
{chr(10).join(f"- {item}" for item in scope.get("exclude", [])) or "- none"}

## Acceptance References

{chr(10).join(f"- {item}" for item in task.get("acceptance_refs", []))}

## Validation

{chr(10).join(f"- `{item}`" for item in task.get("validation", []))}

## Agents

- Implementation: {task.get("suggested_agent")}
- Acceptance: {task.get("acceptance_agent")}
- Code review: {task.get("review_agent")}

## Review

- AI review required: {review.get("ai_review_required")}
- Human runtime check: {review.get("human_runtime_check")}

## Linear

- Parent: {linear.get("parent")}
- Labels: {", ".join(labels) if labels else "none"}

## Source Snapshot

Copy the minimal relevant spec and acceptance excerpts here before starting implementation if planning docs are not merged.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tasks_yaml")
    parser.add_argument("--output-dir", default="linear-children")
    args = parser.parse_args()

    data = load_yaml(Path(args.tasks_yaml))
    requirement_id = data["requirement_id"]
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for task in data["tasks"]:
        name = safe_name(f"{requirement_id}-{task['id']}-{task['title']}.md")
        path = out_dir / name
        path.write_text(render_task(requirement_id, task), encoding="utf-8")
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
