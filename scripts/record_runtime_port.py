#!/usr/bin/env python3
"""Merge one runtime port value into .vibeRig/runtime.json."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root")
    parser.add_argument("key")
    parser.add_argument("port", type=int)
    args = parser.parse_args()

    runtime_dir = Path(args.project_root).expanduser().resolve() / ".vibeRig"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    path = runtime_dir / "runtime.json"
    data = {}
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    data[args.key] = args.port
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
