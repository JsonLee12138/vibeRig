#!/usr/bin/env python3
"""Apply safe VibeRig learning candidates."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"{path} must contain a JSON object")
    return data


def append_once(path: Path, block: str) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if block.strip() in existing:
        return False
    sep = "" if not existing or existing.endswith("\n") else "\n"
    path.write_text(existing + sep + block, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidates_json")
    parser.add_argument("--project-root", default=".")
    parser.add_argument("--apply-auto", action="store_true")
    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    payload = load_json(Path(args.candidates_json))
    candidates = payload.get("learning_candidates", payload.get("candidates", []))
    if not isinstance(candidates, list):
        raise SystemExit("learning_candidates must be a list")

    confirmed_path = root / ".vibeRig" / "insights" / "confirmed.md"
    pending_path = root / ".vibeRig" / "insights" / "candidates.md"
    now = datetime.now(timezone.utc).isoformat()
    applied = 0
    pending = 0

    for raw in candidates:
        if not isinstance(raw, dict):
            continue
        cid = str(raw.get("id", "candidate"))
        ctype = str(raw.get("type", "unknown"))
        confidence = str(raw.get("confidence", "unknown"))
        text = str(raw.get("text", "")).strip()
        if not text:
            continue
        block = "\n".join(
            [
                f"## {cid} - {ctype}",
                "",
                f"- confidence: {confidence}",
                f"- auto_apply: {str(raw.get('auto_apply', False)).lower()}",
                f"- applied_at: {now}" if args.apply_auto else f"- reviewed_at: {now}",
                "",
                text,
                "",
            ]
        )
        safe_auto = (
            args.apply_auto
            and ctype == "project_note"
            and confidence == "high"
            and raw.get("auto_apply") is True
        )
        if safe_auto:
            if append_once(confirmed_path, block):
                applied += 1
        else:
            if append_once(pending_path, block):
                pending += 1

    print(f"applied={applied} pending={pending}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
