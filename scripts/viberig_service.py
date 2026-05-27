#!/usr/bin/env python3
"""Global VibeRig service and project registry."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import platform
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


DEFAULT_PORT = 49160
PLUGIN_ROOT = Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def viberig_home() -> Path:
    return Path(os.environ.get("VIBERIG_HOME", "~/.viberig")).expanduser()


def service_url(port: int = DEFAULT_PORT) -> str:
    return f"http://127.0.0.1:{port}"


def ensure_dirs(home: Path) -> None:
    for directory in [
        home,
        home / "runtime",
        home / "runtime" / "runners",
        home / "logs",
        home / "logs" / "runners",
    ]:
        directory.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def project_slug(name: str) -> str:
    clean = []
    for char in name.lower():
        if char.isalnum():
            clean.append(char)
        elif clean and clean[-1] != "-":
            clean.append("-")
    return "".join(clean).strip("-") or "project"


def project_id(project_root: Path, project_name: str) -> str:
    import hashlib

    digest = hashlib.sha1(str(project_root).encode("utf-8")).hexdigest()[:10]
    return f"{project_slug(project_name)}-{digest}"


def projects_file(home: Path) -> Path:
    return home / "projects.json"


def daemon_file(home: Path) -> Path:
    return home / "runtime" / "daemon.json"


def runner_file(home: Path, project_id_value: str, workflow: str) -> Path:
    return home / "runtime" / "runners" / f"{project_id_value}.{workflow}.json"


def is_pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def load_projects(home: Path) -> dict[str, Any]:
    data = read_json(projects_file(home), {"projects": []})
    if not isinstance(data, dict):
        return {"projects": []}
    projects = data.get("projects")
    if not isinstance(projects, list):
        data["projects"] = []
    return data


def save_project(home: Path, project_root: Path, name: str, plugin_root: Path) -> dict[str, Any]:
    data = load_projects(home)
    project = {
        "id": project_id(project_root, name),
        "name": name,
        "project_root": str(project_root),
        "plugin_root": str(plugin_root),
        "workflow_planning": str(project_root / "WORKFLOW.planning.md"),
        "workflow_implementation": str(project_root / "WORKFLOW.implementation.md"),
        "registered_at": utc_now(),
        "updated_at": utc_now(),
    }

    replaced = False
    next_projects = []
    for existing in data["projects"]:
        if existing.get("id") == project["id"] or existing.get("project_root") == project["project_root"]:
            merged = {**existing, **project, "registered_at": existing.get("registered_at", project["registered_at"])}
            next_projects.append(merged)
            project = merged
            replaced = True
        else:
            next_projects.append(existing)
    if not replaced:
        next_projects.append(project)
    data["projects"] = sorted(next_projects, key=lambda item: item.get("name", ""))
    write_json(projects_file(home), data)
    return project


def find_project(home: Path, project_id_value: str) -> dict[str, Any] | None:
    for project in load_projects(home)["projects"]:
        if project.get("id") == project_id_value:
            return project
    return None


def collect_runners(home: Path) -> list[dict[str, Any]]:
    runners = []
    for path in sorted((home / "runtime" / "runners").glob("*.json")):
        record = read_json(path, {})
        if not isinstance(record, dict):
            continue
        pid = record.get("pid")
        record["alive"] = is_pid_alive(pid if isinstance(pid, int) else None)
        if not record["alive"] and record.get("status") in {"starting", "running"}:
            record["status"] = "stopped"
        runners.append(record)
        write_json(path, record)
    return runners


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            env[key] = value
    return env


def daemon_state(home: Path, port: int) -> dict[str, Any]:
    return {
        "pid": os.getpid(),
        "port": port,
        "url": service_url(port),
        "home": str(home),
        "plugin_root": str(PLUGIN_ROOT),
        "started_at": utc_now(),
    }


def current_state(home: Path, port: int) -> dict[str, Any]:
    daemon = read_json(daemon_file(home), {})
    if not isinstance(daemon, dict):
        daemon = {}
    return {
        "daemon": daemon,
        "projects": load_projects(home)["projects"],
        "runners": collect_runners(home),
        "panel_url": service_url(port),
    }


def healthcheck(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"{service_url(port)}/api/health", timeout=1) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def post_json(port: int, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{service_url(port)}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def start_daemon(home: Path, port: int) -> None:
    ensure_dirs(home)
    if healthcheck(port):
        return
    if not port_available(port):
        raise RuntimeError(f"Port {port} is already in use by another process.")

    log_path = home / "logs" / "daemon.log"
    with log_path.open("a", encoding="utf-8") as log:
        subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "serve", "--port", str(port)],
            cwd=str(PLUGIN_ROOT),
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    for _ in range(50):
        if healthcheck(port):
            return
        time.sleep(0.1)
    raise RuntimeError(f"VibeRig daemon did not start. See {log_path}.")


def install_launch_agent(home: Path, port: int) -> Path | None:
    if platform.system() != "Darwin":
        return None
    launch_agents = Path.home() / "Library" / "LaunchAgents"
    launch_agents.mkdir(parents=True, exist_ok=True)
    plist = launch_agents / "com.viberig.daemon.plist"
    stdout = home / "logs" / "daemon.launchd.log"
    stderr = home / "logs" / "daemon.launchd.err.log"
    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.viberig.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>{html.escape(sys.executable)}</string>
    <string>{html.escape(str(Path(__file__).resolve()))}</string>
    <string>serve</string>
    <string>--port</string>
    <string>{port}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>{html.escape(str(PLUGIN_ROOT))}</string>
  <key>StandardOutPath</key>
  <string>{html.escape(str(stdout))}</string>
  <key>StandardErrorPath</key>
  <string>{html.escape(str(stderr))}</string>
</dict>
</plist>
"""
    previous = plist.read_text(encoding="utf-8") if plist.exists() else None
    if previous != content:
        plist.write_text(content, encoding="utf-8")
    return plist


def runner_command(project: dict[str, Any], workflow: str) -> list[str]:
    plugin_root = Path(project.get("plugin_root") or PLUGIN_ROOT)
    script = "symphony_run_planning.sh" if workflow == "planning" else "symphony_run_implementation.sh"
    return [str(plugin_root / "scripts" / script), str(project["project_root"])]


def start_runner(home: Path, project_id_value: str, workflow: str) -> dict[str, Any]:
    if workflow not in {"planning", "implementation"}:
        raise ValueError("workflow must be planning or implementation")
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")

    path = runner_file(home, project_id_value, workflow)
    existing = read_json(path, {})
    existing_pid = existing.get("pid") if isinstance(existing, dict) else None
    if is_pid_alive(existing_pid if isinstance(existing_pid, int) else None):
        return existing

    log_path = home / "logs" / "runners" / f"{project_id_value}.{workflow}.log"
    env = os.environ.copy()
    env.update(load_env_file(home / "secrets.env"))
    with log_path.open("a", encoding="utf-8") as log:
        process = subprocess.Popen(
            runner_command(project, workflow),
            cwd=str(project["project_root"]),
            stdout=log,
            stderr=subprocess.STDOUT,
            env=env,
            start_new_session=True,
        )
    record = {
        "project_id": project_id_value,
        "project_name": project.get("name"),
        "workflow": workflow,
        "pid": process.pid,
        "status": "starting",
        "alive": True,
        "log_file": str(log_path),
        "started_at": utc_now(),
    }
    write_json(path, record)
    return record


def stop_runner(home: Path, project_id_value: str, workflow: str) -> dict[str, Any]:
    path = runner_file(home, project_id_value, workflow)
    record = read_json(path, {})
    if not isinstance(record, dict):
        record = {}
    pid = record.get("pid")
    if isinstance(pid, int) and is_pid_alive(pid):
        os.kill(pid, signal.SIGTERM)
        record["status"] = "stopping"
    else:
        record["status"] = "stopped"
        record["alive"] = False
    record["updated_at"] = utc_now()
    write_json(path, record)
    return record


def render_dashboard(state: dict[str, Any]) -> str:
    projects = state["projects"]
    runners = state["runners"]
    rows = []
    for project in projects:
        project_runners = [runner for runner in runners if runner.get("project_id") == project.get("id")]
        runner_summary = ", ".join(
            f"{html.escape(runner.get('workflow', ''))}: {html.escape(runner.get('status', 'unknown'))}"
            for runner in project_runners
        ) or "no runners"
        rows.append(
            "<tr>"
            f"<td>{html.escape(project.get('name', ''))}</td>"
            f"<td><code>{html.escape(project.get('project_root', ''))}</code></td>"
            f"<td>{runner_summary}</td>"
            f"<td><button data-project='{html.escape(project.get('id', ''))}' data-workflow='planning'>Start Planning</button> "
            f"<button data-project='{html.escape(project.get('id', ''))}' data-workflow='implementation'>Start Implementation</button></td>"
            "</tr>"
        )
    body = "\n".join(rows) or "<tr><td colspan='4'>No projects registered yet.</td></tr>"
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VibeRig</title>
  <style>
    body {{ font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #1f2328; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border-bottom: 1px solid #d0d7de; padding: 10px; text-align: left; vertical-align: top; }}
    code {{ font-size: 12px; }}
    button {{ border: 1px solid #8c959f; background: #f6f8fa; padding: 6px 10px; border-radius: 6px; cursor: pointer; }}
    .meta {{ color: #57606a; margin-bottom: 20px; }}
  </style>
</head>
<body>
  <h1>VibeRig</h1>
  <div class="meta">Global panel: {html.escape(state.get("panel_url", ""))}</div>
  <table>
    <thead><tr><th>Project</th><th>Path</th><th>Runners</th><th>Actions</th></tr></thead>
    <tbody>{body}</tbody>
  </table>
  <script>
    document.addEventListener('click', async (event) => {{
      const button = event.target.closest('button[data-project]');
      if (!button) return;
      button.disabled = true;
      await fetch('/api/runners/start', {{
        method: 'POST',
        headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{project_id: button.dataset.project, workflow: button.dataset.workflow}})
      }});
      location.reload();
    }});
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    home: Path
    port: int

    def log_message(self, format: str, *args: Any) -> None:
        return

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True})
            return
        if self.path == "/api/state":
            self.send_json(current_state(self.home, self.port))
            return
        if self.path == "/":
            body = render_dashboard(current_state(self.home, self.port)).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_json({"error": "not found"}, 404)

    def do_POST(self) -> None:
        try:
            payload = self.read_json_body()
            if self.path == "/api/projects/register":
                project_root = Path(payload["project_root"]).expanduser().resolve()
                plugin_root = Path(payload.get("plugin_root") or PLUGIN_ROOT).expanduser().resolve()
                name = payload.get("project_name") or project_root.name
                self.send_json({"project": save_project(self.home, project_root, name, plugin_root)})
                return
            if self.path == "/api/runners/start":
                self.send_json({"runner": start_runner(self.home, payload["project_id"], payload["workflow"])})
                return
            if self.path == "/api/runners/stop":
                self.send_json({"runner": stop_runner(self.home, payload["project_id"], payload["workflow"])})
                return
        except Exception as error:  # noqa: BLE001
            self.send_json({"error": str(error)}, 400)
            return
        self.send_json({"error": "not found"}, 404)


def serve(args: argparse.Namespace) -> int:
    home = viberig_home()
    ensure_dirs(home)
    write_json(daemon_file(home), daemon_state(home, args.port))
    Handler.home = home
    Handler.port = args.port
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.serve_forever()
    return 0


def ensure(args: argparse.Namespace) -> int:
    home = viberig_home()
    ensure_dirs(home)
    if args.install_autostart:
        install_launch_agent(home, args.port)
    start_daemon(home, args.port)
    print(service_url(args.port))
    return 0


def register(args: argparse.Namespace) -> int:
    start_daemon(viberig_home(), args.port)
    payload = {
        "project_root": str(Path(args.project_root).expanduser().resolve()),
        "project_name": args.project_name,
        "plugin_root": str(Path(args.plugin_root).expanduser().resolve()) if args.plugin_root else str(PLUGIN_ROOT),
    }
    response = post_json(args.port, "/api/projects/register", payload)
    print(json.dumps(response, indent=2, sort_keys=True))
    return 0


def status(args: argparse.Namespace) -> int:
    if healthcheck(args.port):
        with urllib.request.urlopen(f"{service_url(args.port)}/api/state", timeout=3) as response:
            print(response.read().decode("utf-8"))
        return 0
    print("VibeRig daemon is not running.")
    return 1


def stop(args: argparse.Namespace) -> int:
    home = viberig_home()
    daemon = read_json(daemon_file(home), {})
    pid = daemon.get("pid") if isinstance(daemon, dict) else None
    if isinstance(pid, int) and is_pid_alive(pid):
        os.kill(pid, signal.SIGTERM)
        print(f"Stopped VibeRig daemon pid {pid}.")
        return 0
    print("VibeRig daemon is not running.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="VibeRig global service")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve")
    serve_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    serve_parser.set_defaults(func=serve)

    ensure_parser = subparsers.add_parser("ensure")
    ensure_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    ensure_parser.add_argument("--install-autostart", action="store_true")
    ensure_parser.set_defaults(func=ensure)

    register_parser = subparsers.add_parser("register")
    register_parser.add_argument("project_root")
    register_parser.add_argument("--project-name")
    register_parser.add_argument("--plugin-root")
    register_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    register_parser.set_defaults(func=register)

    status_parser = subparsers.add_parser("status")
    status_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    status_parser.set_defaults(func=status)

    stop_parser = subparsers.add_parser("stop")
    stop_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    stop_parser.set_defaults(func=stop)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
