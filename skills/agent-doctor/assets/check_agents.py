#!/usr/bin/env python3
"""Codex custom-agent availability checker.

Scans one or more agent TOML files (default: .codex/agents/ and ~/.codex/agents/)
and reports per-agent PASS / WARN / FAIL with reasons.

Checks performed:
  1. TOML parses without error.
  2. Required top-level keys present: name, description, developer_instructions.
  3. Field ordering: any [mcp_servers] / [[skills.config]] table block must come
     AFTER all top-level scalar keys. In TOML a preceding table swallows later
     bare keys, so a misplaced [mcp_servers] silently steals developer_instructions.
  4. No unknown / unsupported top-level keys.
  5. sandbox_mode, when present, is one of read-only / workspace-write / danger-full-access.
  6. name matches filename stem (warning only).
  7. Declared mcp_servers[*].command binaries exist on PATH (warning if missing).

Exit code: 0 if no FAIL, 1 if any agent FAILs. WARN never fails the run.

Usage:
  python3 check_agents.py [path ...]
  python3 check_agents.py --json [path ...]
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tomllib
from pathlib import Path

KNOWN_SCALAR = {
    "name",
    "description",
    "developer_instructions",
    "nickname_candidates",
    "model",
    "model_reasoning_effort",
    "sandbox_mode",
    "approval_policy",
}
KNOWN_TABLES = {"mcp_servers", "skills"}
REQUIRED = ("name", "description", "developer_instructions")
VALID_SANDBOX = {"read-only", "workspace-write", "danger-full-access"}

# Top-level scalar assignment: a key = ... at column 0 (not indented).
SCALAR_ASSIGN = re.compile(r"^([A-Za-z0-9_]+)\s*=", re.MULTILINE)
# Top-level table header at column 0.
TABLE_HEADER = re.compile(r"^\[\[?([A-Za-z0-9_.\-]+)", re.MULTILINE)


def strip_triple_strings(text: str) -> str:
    """Blank out triple-quoted string bodies so regex line scans ignore their
    contents (a developer_instructions block can legally contain [mcp_servers...]
    as documentation text)."""

    def repl(m: re.Match) -> str:
        return '"""' + "\n" * m.group(1).count("\n") + '"""'

    return re.sub(r'"""(.*?)"""', repl, text, flags=re.DOTALL)


def first_table_line(text: str) -> tuple[int, str] | None:
    for m in TABLE_HEADER.finditer(text):
        line = text[: m.start()].count("\n") + 1
        return line, m.group(1)
    return None


def last_scalar_line(text: str) -> int:
    last = -1
    for m in SCALAR_ASSIGN.finditer(text):
        if m.group(1) in KNOWN_SCALAR:
            last = text[: m.start()].count("\n") + 1
    return last


def check_file(path: Path) -> dict:
    findings: list[tuple[str, str]] = []  # (level, message)
    raw = path.read_text(encoding="utf-8")

    # 1. Parse.
    try:
        data = tomllib.loads(raw)
    except tomllib.TOMLDecodeError as e:
        return {
            "file": str(path),
            "status": "FAIL",
            "findings": [("FAIL", f"TOML parse error: {e}")],
        }

    masked = strip_triple_strings(raw)

    # 3. Ordering (run before required-key check so we can give a precise hint).
    tbl = first_table_line(masked)
    last_scalar = last_scalar_line(masked)
    if tbl and last_scalar > tbl[0]:
        findings.append(
            (
                "FAIL",
                f"Field-ordering bug: table [{tbl[1]}] at line {tbl[0]} precedes a "
                f"top-level key at line {last_scalar}. Move all [mcp_servers]/"
                f"[[skills.config]] blocks to the END of the file — a preceding "
                f"table captures developer_instructions and the agent loses it.",
            )
        )

    # 2. Required keys.
    for key in REQUIRED:
        if key not in data:
            hint = ""
            if tbl:
                hint = (
                    f" (likely captured by table [{tbl[1]}] above it — see ordering)"
                )
            findings.append(("FAIL", f"Missing required top-level key '{key}'{hint}"))

    # 4. Unknown top-level keys.
    for key in data:
        if key not in KNOWN_SCALAR and key not in KNOWN_TABLES:
            findings.append(
                ("WARN", f"Unknown/unsupported top-level key '{key}' — Codex may ignore it")
            )

    # 5. sandbox_mode value.
    sb = data.get("sandbox_mode")
    if sb is not None and sb not in VALID_SANDBOX:
        findings.append(
            ("WARN", f"sandbox_mode='{sb}' not in {sorted(VALID_SANDBOX)}")
        )

    # 6. name vs filename.
    name = data.get("name")
    if name and name != path.stem and name.replace("_", "-") != path.stem:
        findings.append(
            ("WARN", f"name '{name}' does not match filename stem '{path.stem}'")
        )

    # 7. mcp_servers command binaries.
    for srv, cfg in (data.get("mcp_servers") or {}).items():
        if not isinstance(cfg, dict):
            continue
        cmd = cfg.get("command")
        if cmd:
            exe = cmd if os.path.sep in cmd else cmd
            ok = (Path(cmd).exists() if os.path.sep in cmd else shutil.which(cmd))
            if not ok:
                findings.append(
                    ("WARN", f"mcp_servers.{srv}.command '{cmd}' not found on PATH/disk")
                )
        elif cfg.get("url"):
            findings.append(
                ("WARN", f"mcp_servers.{srv} is URL-based — requires network at runtime (not checked)")
            )

    status = "FAIL" if any(l == "FAIL" for l, _ in findings) else (
        "WARN" if findings else "PASS"
    )
    return {"file": str(path), "status": status, "findings": findings}


def collect_targets(args: list[str]) -> list[Path]:
    if args:
        out: list[Path] = []
        for a in args:
            p = Path(a).expanduser()
            if p.is_dir():
                out += sorted(p.glob("*.toml"))
            elif p.is_file():
                out.append(p)
            else:
                print(f"warning: {a} not found", file=sys.stderr)
        return out
    defaults = [Path(".codex/agents"), Path("~/.codex/agents").expanduser()]
    out = []
    for d in defaults:
        if d.is_dir():
            out += sorted(d.glob("*.toml"))
    return out


def main() -> int:
    argv = sys.argv[1:]
    as_json = "--json" in argv
    argv = [a for a in argv if a != "--json"]
    targets = collect_targets(argv)
    if not targets:
        print("No agent TOML files found. Pass a path or run from a project with .codex/agents/.")
        return 0

    results = [check_file(p) for p in targets]

    if as_json:
        print(json.dumps(results, indent=2))
    else:
        icon = {"PASS": "✅", "WARN": "⚠️ ", "FAIL": "❌"}
        for r in results:
            print(f"{icon[r['status']]} {r['status']:4} {r['file']}")
            for level, msg in r["findings"]:
                print(f"        - [{level}] {msg}")
        n_fail = sum(r["status"] == "FAIL" for r in results)
        n_warn = sum(r["status"] == "WARN" for r in results)
        n_pass = sum(r["status"] == "PASS" for r in results)
        print(f"\nSummary: {n_pass} pass, {n_warn} warn, {n_fail} fail "
              f"({len(results)} agents)")

    return 1 if any(r["status"] == "FAIL" for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
