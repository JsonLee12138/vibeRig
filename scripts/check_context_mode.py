#!/usr/bin/env python3
"""Check optional context-mode setup for a VibeRig target project."""

from __future__ import annotations

import argparse
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


MARKETPLACE = "mksglu/context-mode"


def run(args: list[str]) -> tuple[int, str]:
    try:
        proc = subprocess.run(
            args,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        return proc.returncode, proc.stdout.strip()
    except FileNotFoundError:
        return 127, f"Command not found: {args[0]}"


def write_status(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    body = [
        "# Context Mode Status",
        "",
        f"- checked_at: {now}",
        f"- install_method: codex plugin marketplace",
        f"- marketplace: {MARKETPLACE}",
        "",
        "## Result",
        "",
        *lines,
        "",
        "## Install Command",
        "",
        "```sh",
        f"codex plugin marketplace add {MARKETPLACE}",
        "```",
        "",
    ]
    path.write_text("\n".join(body), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", nargs="?", default=".")
    parser.add_argument(
        "--install",
        action="store_true",
        help="Run the Codex plugin marketplace install command if Codex is available.",
    )
    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    status_path = root / ".vibeRig" / "context-mode.md"
    lines: list[str] = []

    codex = shutil.which("codex")
    if not codex:
        lines.append("- status: codex-cli-missing")
        lines.append("- detail: `codex` was not found on PATH.")
        write_status(status_path, lines)
        print(status_path)
        return 1

    lines.append(f"- codex: {codex}")

    help_code, help_output = run([codex, "plugin", "--help"])
    if help_code != 0:
        lines.append("- status: codex-plugin-command-unavailable")
        lines.append("- detail: `codex plugin --help` did not complete successfully.")
        if help_output:
            lines.append("")
            lines.append("```text")
            lines.append(help_output)
            lines.append("```")
        write_status(status_path, lines)
        print(status_path)
        return 1

    if args.install:
        install_code, install_output = run(
            [codex, "plugin", "marketplace", "add", MARKETPLACE]
        )
        lines.append(f"- install_exit_code: {install_code}")
        if install_output:
            lines.append("")
            lines.append("```text")
            lines.append(install_output)
            lines.append("```")
        status = "installed-or-reported-next-step" if install_code == 0 else "install-failed"
        lines.insert(0, f"- status: {status}")
        write_status(status_path, lines)
        print(status_path)
        return install_code

    lines.insert(0, "- status: not-installed-by-script")
    lines.append("- detail: run with `--install` to add the context-mode marketplace.")
    write_status(status_path, lines)
    print(status_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
