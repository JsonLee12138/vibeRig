#!/usr/bin/env python3
"""Generate VibeRig retrospectives from accepted-work evidence."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_evidence(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    try:
        import yaml  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        raise SystemExit(
            f"{path} is not JSON and PyYAML is unavailable: {exc}"
        ) from exc
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise SystemExit(f"{path} must contain an object")
    return data


def run_git(root: Path, args: list[str]) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=root,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return proc.stdout.strip() if proc.returncode == 0 else ""


def as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [value]
    return []


def candidate_rows(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return "| - | - | - | - | - |\n"
    rows = []
    for item in candidates:
        rows.append(
            "| {id} | {type} | {confidence} | {auto_apply} | {target} |".format(
                id=item.get("id", ""),
                type=item.get("type", ""),
                confidence=item.get("confidence", ""),
                auto_apply=str(item.get("auto_apply", False)).lower(),
                target=item.get("target", ""),
            )
        )
    return "\n".join(rows) + "\n"


def append_once(path: Path, header: str, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    block = "\n".join([header, "", *lines, ""])
    if block.strip() in existing:
        return
    sep = "" if not existing or existing.endswith("\n") else "\n"
    path.write_text(existing + sep + block, encoding="utf-8")


def infer_project_note(evidence: dict[str, Any]) -> list[dict[str, Any]]:
    validation = evidence.get("validation") if isinstance(evidence.get("validation"), dict) else {}
    commands = as_list(validation.get("commands"))
    result = str(validation.get("result", "")).lower()
    if not commands or result not in {"passed", "pass", "success", "ok"}:
        return []
    command = commands[0]
    return [
        {
            "id": "LC-VALIDATION-1",
            "type": "project_note",
            "confidence": "high",
            "auto_apply": True,
            "target": ".vibeRig/insights/confirmed.md",
            "text": f"Accepted VibeRig work used `{command}` as a validation command.",
            "evidence": ["validation passed"],
        }
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", default=".")
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--requirement-id")
    parser.add_argument("--task-id")
    parser.add_argument("--apply-auto-project-notes", action="store_true")
    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    evidence = load_evidence(args.evidence)
    requirement_id = args.requirement_id or str(evidence.get("requirement_id", "")).strip()
    task_id = args.task_id or str(evidence.get("task_id", "")).strip()
    if not requirement_id:
        raise SystemExit("requirement_id is required via --requirement-id or evidence")

    requirement_dir = root / ".vibeRig" / "requirements" / requirement_id
    now = datetime.now(timezone.utc).isoformat()
    git_info = evidence.get("git") if isinstance(evidence.get("git"), dict) else {}
    branch = str(git_info.get("branch") or run_git(root, ["branch", "--show-current"]) or "")
    head_sha = str(git_info.get("head_sha") or run_git(root, ["rev-parse", "HEAD"]) or "")
    changed_files = as_list(git_info.get("changed_files"))
    if not changed_files:
        changed_files = as_list(run_git(root, ["diff", "--name-only", "HEAD~1..HEAD"]).splitlines())

    candidates = evidence.get("learning_candidates")
    if not isinstance(candidates, list):
        candidates = []
    candidates = [c for c in candidates if isinstance(c, dict)]
    candidates.extend(infer_project_note(evidence))

    validation = evidence.get("validation") if isinstance(evidence.get("validation"), dict) else {}
    context_mode = evidence.get("context_mode") if isinstance(evidence.get("context_mode"), dict) else {}
    changed_file_lines = (
        [f"- {path}" for path in changed_files]
        if changed_files
        else ["- No changed files recorded."]
    )

    report_lines = [
        f"# Task Retrospective: {requirement_id}{(' ' + task_id) if task_id else ''}",
        "",
        "## Accepted Outcome",
        "",
        f"- Status: {evidence.get('status', 'accepted')}",
        f"- Branch: {branch or 'unknown'}",
        f"- Head SHA: {head_sha or 'unknown'}",
        f"- Validation: {validation.get('result', 'unknown')}",
        f"- Generated: {now}",
        "",
        "## What Changed",
        "",
        *changed_file_lines,
        "",
        "## Evidence",
        "",
        f"- Context-mode available: {str(context_mode.get('available', False)).lower()}",
        f"- Context-mode summary: {context_mode.get('summary', '') or 'not provided'}",
        "",
        "## Friction",
        "",
        "- Not recorded.",
        "",
        "## Learning Candidates",
        "",
        "| ID | Type | Confidence | Auto Apply | Target |",
        "| --- | --- | --- | --- | --- |",
        candidate_rows(candidates).rstrip(),
        "",
        "## Applied Learnings",
        "",
        "- See `.vibeRig/insights/confirmed.md` for auto-applied project notes.",
        "",
    ]

    if task_id:
        output = requirement_dir / "tasks" / task_id / "retrospective.md"
    else:
        output = requirement_dir / "insights.md"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(report_lines), encoding="utf-8")

    candidates_path = root / ".vibeRig" / "insights" / "candidates.md"
    confirmed_path = root / ".vibeRig" / "insights" / "confirmed.md"
    for item in candidates:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        header = f"## {item.get('id', 'candidate')} - {item.get('type', 'unknown')}"
        lines = [
            f"- confidence: {item.get('confidence', 'unknown')}",
            f"- auto_apply: {str(item.get('auto_apply', False)).lower()}",
            f"- target: {item.get('target', '')}",
            "",
            text,
        ]
        if (
            args.apply_auto_project_notes
            and item.get("type") == "project_note"
            and item.get("confidence") == "high"
            and item.get("auto_apply") is True
        ):
            append_once(confirmed_path, header, lines)
        else:
            append_once(candidates_path, header, lines)

    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
