#!/usr/bin/env python3
"""Global VibeRig service and project registry."""

from __future__ import annotations

import argparse
import base64
from dataclasses import dataclass, field
import datetime as dt
import hashlib
import html
import json
import mimetypes
import os
import platform
import re
import shlex
import signal
import select
import socket
import sqlite3
import struct
import subprocess
import sys
import tempfile
import threading
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


DEFAULT_PORT = 49160
PLUGIN_ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_DIST = PLUGIN_ROOT / "dashboard" / "dist"
TASK_STATES = {
    "draft",
    "ready",
    "running",
    "self_accepted",
    "human_review",
    "accepted",
    "blocked",
    "failed",
    "canceled",
}
BOARD_COLUMNS = [
    ("draft", "Backlog"),
    ("ready", "Ready"),
    ("running", "Running"),
    ("human_review", "Human Review"),
    ("accepted", "Accepted"),
    ("blocked", "Blocked"),
    ("failed", "Failed"),
]
EVENT_STREAM_LIMIT = 100
WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
WEBSOCKET_CLIENTS: set[socket.socket] = set()
WEBSOCKET_LOCK = threading.Lock()
RUN_TERMINAL_STATES = {"success", "failed", "blocked", "canceled"}
RUN_ACTIVE_STATES = {
    "created",
    "preflight",
    "workspace_ready",
    "codex_starting",
    "codex_running",
    "codex_completed",
    "codex_failed",
    "development",
    "test_authoring",
    "validating",
    "validation_failed",
    "acceptance_review",
    "acceptance_failed",
    "self_acceptance_written",
}


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
        home / "exports",
        home / "runs",
        home / "logs",
    ]:
        directory.mkdir(parents=True, exist_ok=True)


def db_file(home: Path) -> Path:
    return home / "viberig.sqlite"


def task_key(project_id_value: str, requirement_id_value: str, task_id_value: str) -> str:
    return f"{project_id_value}:{requirement_id_value}:{task_id_value}"


def acceptance_key(project_id_value: str, requirement_id_value: str, acceptance_id_value: str) -> str:
    return f"{project_id_value}:{requirement_id_value}:{acceptance_id_value}"


def file_hash(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_yaml(path: Path) -> Any:
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "PyYAML is required to import VibeRig tasks. Install it with `python3 -m pip install PyYAML`."
        ) from exc
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data or {}


def connect_db(home: Path) -> sqlite3.Connection:
    ensure_dirs(home)
    connection = sqlite3.connect(db_file(home))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    init_db(connection)
    return connection


def init_db(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          project_root TEXT NOT NULL UNIQUE,
          config_path TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          plugin_root TEXT,
          registered_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requirements (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          title TEXT NOT NULL,
          path TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          imported_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(project_id, requirement_id),
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS roadmap_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          roadmap_id TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          source_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(project_id, requirement_id, roadmap_id)
        );

        CREATE TABLE IF NOT EXISTS source_revisions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          source_name TEXT NOT NULL,
          path TEXT NOT NULL,
          sha256 TEXT,
          updated_at TEXT NOT NULL,
          UNIQUE(project_id, requirement_id, source_name)
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          title TEXT NOT NULL,
          type TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          priority INTEGER NOT NULL DEFAULT 100,
          sort_order INTEGER NOT NULL DEFAULT 0,
          suggested_agent TEXT,
          acceptance_agent TEXT,
          review_agent TEXT,
          roadmap_id TEXT,
          branch TEXT,
          worktree_hint TEXT,
          scope_json TEXT NOT NULL DEFAULT '{}',
          validation_json TEXT NOT NULL DEFAULT '[]',
          review_json TEXT NOT NULL DEFAULT '{}',
          source_json TEXT NOT NULL DEFAULT '{}',
          definition_hash TEXT,
          definition_stale INTEGER NOT NULL DEFAULT 0,
          definition_changed_at TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(project_id, requirement_id, task_id),
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_dependencies (
          task_id TEXT NOT NULL,
          depends_on_task_id TEXT NOT NULL,
          waived INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(task_id, depends_on_task_id),
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY(depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS acceptance_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          acceptance_id TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          evidence_required INTEGER NOT NULL DEFAULT 1,
          source_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(project_id, requirement_id, acceptance_id)
        );

        CREATE TABLE IF NOT EXISTS task_acceptance_links (
          task_id TEXT NOT NULL,
          acceptance_item_id TEXT NOT NULL,
          PRIMARY KEY(task_id, acceptance_item_id),
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY(acceptance_item_id) REFERENCES acceptance_items(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT,
          task_id TEXT,
          status TEXT NOT NULL,
          implementation_status TEXT,
          codex_adapter TEXT,
          codex_session_id TEXT,
          codex_thread_id TEXT,
          codex_conversation_id TEXT,
          codex_exit_code INTEGER,
          codex_usage_json TEXT NOT NULL DEFAULT '{}',
          changed_files_json TEXT NOT NULL DEFAULT '[]',
          diff_path TEXT,
          base_ref TEXT,
          base_sha TEXT,
          source_sha TEXT,
          error_summary TEXT,
          worktree_path TEXT,
          run_db_path TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          summary TEXT
        );

        CREATE TABLE IF NOT EXISTS run_events (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          message TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS codex_sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          adapter TEXT NOT NULL,
          native_session_id TEXT,
          thread_id TEXT,
          conversation_id TEXT,
          turn_ids_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          prompt_path TEXT,
          transcript_path TEXT,
          events_path TEXT,
          final_message_path TEXT,
          usage_json TEXT NOT NULL DEFAULT '{}',
          error_summary TEXT,
          FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS evidence (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          task_id TEXT,
          acceptance_item_id TEXT,
          kind TEXT NOT NULL,
          path TEXT,
          summary TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          recorded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS manual_reviews (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          requirement_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          reviewer TEXT NOT NULL,
          result TEXT NOT NULL,
          notes TEXT,
          evidence_reviewed_json TEXT NOT NULL DEFAULT '[]',
          residual_risks TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_events (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          requirement_id TEXT,
          task_id TEXT,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        """
    )
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
    }
    if "roadmap_id" not in columns:
        connection.execute("ALTER TABLE tasks ADD COLUMN roadmap_id TEXT")
    task_column_defaults = {
        "definition_hash": "TEXT",
        "definition_stale": "INTEGER NOT NULL DEFAULT 0",
        "definition_changed_at": "TEXT",
    }
    for column_name, column_type in task_column_defaults.items():
        if column_name not in columns:
            connection.execute(f"ALTER TABLE tasks ADD COLUMN {column_name} {column_type}")
    project_columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(projects)").fetchall()
    }
    if "config_path" not in project_columns:
        connection.execute("ALTER TABLE projects ADD COLUMN config_path TEXT")
    if "status" not in project_columns:
        connection.execute("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
    run_columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(runs)").fetchall()
    }
    run_column_defaults = {
        "implementation_status": "TEXT",
        "codex_adapter": "TEXT",
        "codex_session_id": "TEXT",
        "codex_thread_id": "TEXT",
        "codex_conversation_id": "TEXT",
        "codex_exit_code": "INTEGER",
        "codex_usage_json": "TEXT NOT NULL DEFAULT '{}'",
        "changed_files_json": "TEXT NOT NULL DEFAULT '[]'",
        "diff_path": "TEXT",
        "base_ref": "TEXT",
        "base_sha": "TEXT",
        "source_sha": "TEXT",
        "error_summary": "TEXT",
    }
    for column_name, column_type in run_column_defaults.items():
        if column_name not in run_columns:
            connection.execute(f"ALTER TABLE runs ADD COLUMN {column_name} {column_type}")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f"{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(json.dumps(payload, indent=2, sort_keys=True) + "\n")
        tmp_path.replace(path)
    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def json_loads_field(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def stable_json_hash(payload: Any) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def nested_get(data: dict[str, Any], path: list[str], default: Any = None) -> Any:
    current: Any = data
    for part in path:
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def load_project_config(project_root: Path) -> dict[str, Any]:
    config_path = project_root / ".vibeRig" / "config.yaml"
    if not config_path.exists():
        return {}
    try:
        data = load_yaml(config_path)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def user_codex_model() -> str | None:
    config_home = Path(os.environ.get("CODEX_HOME", "~/.codex")).expanduser()
    config_path = config_home / "config.toml"
    if not config_path.exists():
        return None
    try:
        data = tomllib.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return None
    model = data.get("model") if isinstance(data, dict) else None
    return str(model) if model else None


def ensure_codex_hooks_config(config_path: Path) -> bool:
    config_path.parent.mkdir(parents=True, exist_ok=True)
    if not config_path.exists():
        config_path.write_text("[features]\nhooks = true\n", encoding="utf-8")
        return True

    existing = config_path.read_text(encoding="utf-8")
    lines = existing.splitlines(keepends=True)
    section_start: int | None = None
    section_end = len(lines)
    for index, line in enumerate(lines):
        if re.match(r"^\s*\[features\]\s*(?:#.*)?$", line):
            section_start = index
            continue
        if section_start is not None and index > section_start and re.match(r"^\s*\[.*\]\s*(?:#.*)?$", line):
            section_end = index
            break

    if section_start is None:
        separator = "\n" if existing and not existing.endswith("\n") else ""
        updated = existing + separator + ("\n" if existing else "") + "[features]\nhooks = true\n"
    else:
        hook_line_index: int | None = None
        for index in range(section_start + 1, section_end):
            if re.match(r"^\s*hooks\s*=", lines[index]):
                hook_line_index = index
                break
        if hook_line_index is None:
            lines.insert(section_start + 1, "hooks = true\n")
        elif not re.match(r"^\s*hooks\s*=\s*true\s*(?:#.*)?$", lines[hook_line_index]):
            newline = "\n" if lines[hook_line_index].endswith("\n") else ""
            lines[hook_line_index] = "hooks = true" + newline
        updated = "".join(lines)

    if updated == existing:
        return False
    config_path.write_text(updated, encoding="utf-8")
    return True


def codex_hooks_enabled(config_path: Path) -> bool:
    if not config_path.exists():
        return False
    try:
        data = tomllib.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    features = data.get("features") if isinstance(data, dict) else None
    return isinstance(features, dict) and features.get("hooks") is True


def has_ancestor_codex_hooks_config(path: Path) -> bool:
    resolved = path.resolve()
    for candidate in [resolved, *resolved.parents]:
        if codex_hooks_enabled(candidate / ".codex" / "config.toml"):
            return True
    return False


def parse_feature_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def codex_runner_config(project_root: Path) -> dict[str, Any]:
    data = load_project_config(project_root)
    codex_config = nested_get(data, ["runner", "codex"], {}) or {}
    if not isinstance(codex_config, dict):
        codex_config = {}
    adapter = os.environ.get("VIBERIG_CODEX_ADAPTER") or codex_config.get("adapter") or "codex-cli-mcp"
    command = os.environ.get("VIBERIG_CODEX_COMMAND") or codex_config.get("command") or "codex"
    return {
        "adapter": str(adapter),
        "command": str(command),
        "base_ref": os.environ.get("VIBERIG_CODEX_BASE_REF") or codex_config.get("base_ref") or "origin/main",
        "require_fetch_before_worktree": str(
            os.environ.get("VIBERIG_CODEX_REQUIRE_FETCH_BEFORE_WORKTREE")
            or codex_config.get("require_fetch_before_worktree")
            or "true"
        ).lower()
        not in {"0", "false", "no"},
        "model": os.environ.get("VIBERIG_CODEX_MODEL") or codex_config.get("model") or user_codex_model() or "gpt-5.5",
        "reasoning_effort": os.environ.get("VIBERIG_CODEX_REASONING_EFFORT") or codex_config.get("reasoning_effort"),
        "approval_policy": os.environ.get("VIBERIG_CODEX_APPROVAL_POLICY") or codex_config.get("approval_policy") or "never",
        "sandbox": os.environ.get("VIBERIG_CODEX_SANDBOX") or codex_config.get("sandbox") or "workspace-write",
        "turn_timeout_ms": int(os.environ.get("VIBERIG_CODEX_TURN_TIMEOUT_MS") or codex_config.get("turn_timeout_ms") or 0),
        "mcp_command": os.environ.get("VIBERIG_CODEX_MCP_COMMAND") or codex_config.get("mcp_command") or "npx -y codex-mcp-server",
        "mcp_initialize_timeout_ms": int(
            os.environ.get("VIBERIG_CODEX_MCP_INITIALIZE_TIMEOUT_MS")
            or codex_config.get("mcp_initialize_timeout_ms")
            or 60000
        ),
        "mcp_tool_timeout_ms": int(
            os.environ.get("VIBERIG_CODEX_MCP_TOOL_TIMEOUT_MS")
            or codex_config.get("mcp_tool_timeout_ms")
            or os.environ.get("VIBERIG_CODEX_TURN_TIMEOUT_MS")
            or codex_config.get("turn_timeout_ms")
            or 600000
        ),
        "mcp_tool": os.environ.get("VIBERIG_CODEX_MCP_TOOL") or codex_config.get("mcp_tool") or "codex",
        "enable_features": parse_feature_list(
            os.environ.get("VIBERIG_CODEX_ENABLE_FEATURES") or codex_config.get("enable_features") or ["hooks"]
        ),
        "full_auto": str(os.environ.get("VIBERIG_CODEX_FULL_AUTO") or codex_config.get("full_auto") or "false").lower()
        in {"1", "true", "yes", "on"},
        "callback_uri": os.environ.get("VIBERIG_CODEX_CALLBACK_URI") or codex_config.get("callback_uri"),
        "profile": os.environ.get("VIBERIG_CODEX_PROFILE") or codex_config.get("profile"),
        "base_instructions": os.environ.get("VIBERIG_CODEX_BASE_INSTRUCTIONS") or codex_config.get("base_instructions"),
        "developer_instructions": os.environ.get("VIBERIG_CODEX_DEVELOPER_INSTRUCTIONS") or codex_config.get("developer_instructions"),
        "config": codex_config.get("config") if isinstance(codex_config.get("config"), dict) else None,
        "mcp_env": codex_config.get("mcp_env") if isinstance(codex_config.get("mcp_env"), dict) else {},
        "appserver_command": os.environ.get("VIBERIG_CODEX_APPSERVER_COMMAND") or codex_config.get("appserver_command"),
    }


@dataclass
class CodexRunContext:
    home: Path
    project: dict[str, Any]
    task: dict[str, Any]
    requirement: dict[str, Any]
    dependencies: list[dict[str, Any]]
    acceptance_items: list[dict[str, Any]]
    source_revisions: list[dict[str, Any]]
    run: dict[str, Any]
    run_dir: Path
    run_log_path: Path
    worktree_path: Path
    base_ref: str
    source_sha: str | None
    config: dict[str, Any]


@dataclass
class CodexAdapterResult:
    adapter: str
    session_id: str
    status: str
    exit_code: int | None = None
    thread_id: str | None = None
    conversation_id: str | None = None
    turn_ids: list[str] = field(default_factory=list)
    usage: dict[str, Any] = field(default_factory=dict)
    transcript_path: str | None = None
    events_path: str | None = None
    final_message_path: str | None = None
    final_message: str = ""
    error: str | None = None
    last_event_at: str | None = None


def db_project_payload(project: dict[str, Any]) -> tuple[Any, ...]:
    now = utc_now()
    return (
        project["id"],
        project.get("name") or project["id"],
        project["project_root"],
        project.get("config_path"),
        project.get("status") or "active",
        project.get("plugin_root"),
        project.get("registered_at") or now,
        project.get("updated_at") or now,
    )


def sync_project_to_db(home: Path, project: dict[str, Any]) -> dict[str, Any]:
    with connect_db(home) as connection:
        existing_by_root = connection.execute(
            "SELECT id, registered_at FROM projects WHERE project_root = ?",
            (project["project_root"],),
        ).fetchone()
        if existing_by_root and existing_by_root["id"] != project["id"]:
            project = {
                **project,
                "id": existing_by_root["id"],
                "registered_at": existing_by_root["registered_at"] or project.get("registered_at"),
            }
        connection.execute(
            """
            INSERT INTO projects (id, name, project_root, config_path, status, plugin_root, registered_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              project_root = excluded.project_root,
              config_path = excluded.config_path,
              status = excluded.status,
              plugin_root = excluded.plugin_root,
              updated_at = excluded.updated_at
            """,
            db_project_payload(project),
        )
        connection.commit()
    return project


def new_record_id(prefix: str, *parts: Any) -> str:
    raw = ":".join(str(part) for part in (*parts, utc_now(), os.getpid()))
    return f"{prefix}:{hashlib.sha1(raw.encode('utf-8')).hexdigest()}"


def websocket_accept_key(client_key: str) -> str:
    digest = hashlib.sha1((client_key + WEBSOCKET_GUID).encode("ascii")).digest()
    return base64.b64encode(digest).decode("ascii")


def websocket_frame_text(message: str) -> bytes:
    payload = message.encode("utf-8")
    length = len(payload)
    if length < 126:
        return bytes([0x81, length]) + payload
    if length <= 0xFFFF:
        return bytes([0x81, 126]) + struct.pack("!H", length) + payload
    return bytes([0x81, 127]) + struct.pack("!Q", length) + payload


def websocket_send(sock: socket.socket, payload: dict[str, Any]) -> bool:
    try:
        sock.sendall(websocket_frame_text(json.dumps(payload, sort_keys=True)))
        return True
    except OSError:
        return False


def publish_server_event(event_type: str, payload: dict[str, Any] | None = None) -> None:
    message = {"type": event_type, "created_at": utc_now(), "payload": payload or {}}
    with WEBSOCKET_LOCK:
        clients = list(WEBSOCKET_CLIENTS)
    stale: list[socket.socket] = []
    for client in clients:
        if not websocket_send(client, message):
            stale.append(client)
    if stale:
        with WEBSOCKET_LOCK:
            for client in stale:
                WEBSOCKET_CLIENTS.discard(client)
                try:
                    client.close()
                except OSError:
                    pass


def add_activity_event(
    connection: sqlite3.Connection,
    event_type: str,
    project_id_value: str | None = None,
    requirement_id_value: str | None = None,
    task_db_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    event_id = new_record_id("event", event_type, project_id_value, requirement_id_value, task_db_id)
    created_at = utc_now()
    event_payload = payload or {}
    connection.execute(
        """
        INSERT INTO activity_events (id, project_id, requirement_id, task_id, event_type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            project_id_value,
            requirement_id_value,
            task_db_id,
            event_type,
            json.dumps(event_payload, sort_keys=True),
            created_at,
        ),
    )
    publish_server_event(
        "activity",
        {
            "id": event_id,
            "event_type": event_type,
            "project_id": project_id_value,
            "requirement_id": requirement_id_value,
            "task_id": task_db_id,
            "payload": event_payload,
            "created_at": created_at,
        },
    )


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


def is_pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        reaped_pid, _status = os.waitpid(pid, os.WNOHANG)
        if reaped_pid == pid:
            return False
    except ChildProcessError:
        pass
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:
        result = subprocess.run(
            ["ps", "-p", str(pid), "-o", "stat="],
            check=False,
            capture_output=True,
            text=True,
            timeout=1,
        )
        if result.returncode == 0 and result.stdout.strip().startswith("Z"):
            return False
    except (OSError, subprocess.SubprocessError):
        pass
    return True


def last_log_line(path: str | None) -> str | None:
    if not path:
        return None
    log_path = Path(path).expanduser()
    if not log_path.exists():
        return None
    try:
        lines = [line.strip() for line in log_path.read_text(encoding="utf-8", errors="replace").splitlines()]
    except OSError:
        return None
    for line in reversed(lines):
        if line:
            return line
    return None


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
    existing_db_project: dict[str, Any] | None = None
    with connect_db(home) as connection:
        row = connection.execute("SELECT * FROM projects WHERE project_root = ?", (str(project_root),)).fetchone()
        if row:
            existing_db_project = dict(row)
    project = {
        "id": project_id(project_root, name),
        "name": name,
        "project_root": str(project_root),
        "plugin_root": str(plugin_root),
        "config_path": str(project_root / ".vibeRig" / "config.yaml") if (project_root / ".vibeRig" / "config.yaml").exists() else None,
        "status": "active",
        "workflow_planning": str(project_root / "WORKFLOW.planning.md"),
        "workflow_implementation": str(project_root / "WORKFLOW.implementation.md"),
        "registered_at": utc_now(),
        "updated_at": utc_now(),
    }

    replaced = False
    next_projects = []
    for existing in data["projects"]:
        if existing.get("id") == project["id"] or existing.get("project_root") == project["project_root"]:
            merged = {
                **existing,
                **project,
                "id": existing.get("id") or project["id"],
                "registered_at": existing.get("registered_at", project["registered_at"]),
            }
            next_projects.append(merged)
            project = merged
            replaced = True
        else:
            next_projects.append(existing)
    if not replaced and existing_db_project:
        project = {
            **existing_db_project,
            **project,
            "id": existing_db_project["id"],
            "registered_at": existing_db_project.get("registered_at", project["registered_at"]),
        }
    if not replaced:
        next_projects.append(project)
    data["projects"] = sorted(next_projects, key=lambda item: item.get("name", ""))
    write_json(projects_file(home), data)
    project = sync_project_to_db(home, project)
    with connect_db(home) as connection:
        add_activity_event(connection, "project.registered", project["id"], payload={"project_root": project["project_root"]})
        connection.commit()
    return project


def remove_project(home: Path, project_id_value: str) -> dict[str, Any]:
    data = load_projects(home)
    project = next((item for item in data["projects"] if item.get("id") == project_id_value), None)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")

    data["projects"] = [item for item in data["projects"] if item.get("id") != project_id_value]
    write_json(projects_file(home), data)

    with connect_db(home) as connection:
        run_ids = [
            row["id"]
            for row in connection.execute("SELECT id FROM runs WHERE project_id = ?", (project_id_value,)).fetchall()
        ]
        if run_ids:
            placeholders = ",".join("?" for _ in run_ids)
            connection.execute(f"DELETE FROM run_events WHERE run_id IN ({placeholders})", run_ids)

        statements = [
            ("DELETE FROM codex_sessions WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM runs WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM evidence WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM manual_reviews WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM activity_events WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM source_revisions WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM roadmap_items WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM acceptance_items WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM requirements WHERE project_id = ?", (project_id_value,)),
            ("DELETE FROM projects WHERE id = ?", (project_id_value,)),
        ]
        for statement, params in statements:
            connection.execute(statement, params)
        connection.commit()
    return project


def find_project(home: Path, project_id_value: str) -> dict[str, Any] | None:
    for project in load_projects(home)["projects"]:
        if project.get("id") == project_id_value:
            return project
    return None


def ensure_project_in_db(home: Path, project: dict[str, Any]) -> None:
    sync_project_to_db(home, project)


def parse_acceptance_markdown(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    items: dict[str, str] = {}
    heading_pattern = re.compile(r"^#{2,6}\s+([A-Za-z]+-\d+)[:：]?\s*(.*)$")
    checklist_pattern = re.compile(r"^\s*[-*]\s+\[[ xX]\]\s+([A-Za-z]+-\d+)[:：]?\s*(.*)$")
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = heading_pattern.match(line) or checklist_pattern.match(line)
        if not match:
            continue
        acceptance_id_value = match.group(1)
        title = match.group(2).strip() or acceptance_id_value
        items[acceptance_id_value] = title
    return items


def parse_roadmap_markdown(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    items: list[dict[str, Any]] = []
    heading_pattern = re.compile(r"^#{2,6}\s+([A-Za-z]+-\d+|R\d+|M\d+)[:：]?\s*(.*)$")
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = heading_pattern.match(line)
        if not match:
            continue
        roadmap_id = match.group(1)
        title = match.group(2).strip() or roadmap_id
        items.append({"roadmap_id": roadmap_id, "title": title})
    return items


def discover_requirement_paths(project_root: Path) -> list[Path]:
    requirements_root = project_root / ".vibeRig" / "requirements"
    if not requirements_root.exists():
        return []
    return sorted(path.parent for path in requirements_root.glob("*/tasks.yaml"))


def import_requirement(home: Path, project: dict[str, Any], requirement_path: Path) -> dict[str, Any]:
    ensure_project_in_db(home, project)
    tasks_path = requirement_path / "tasks.yaml"
    if not tasks_path.exists():
        raise ValueError(f"tasks.yaml not found: {tasks_path}")
    data = load_yaml(tasks_path)
    if not isinstance(data, dict):
        raise ValueError(f"tasks.yaml must contain a mapping: {tasks_path}")

    now = utc_now()
    project_id_value = project["id"]
    requirement_id_value = str(data.get("requirement_id") or requirement_path.name)
    requirement_db_id = f"{project_id_value}:{requirement_id_value}"
    title = str(data.get("title") or requirement_id_value)
    acceptance_from_markdown = parse_acceptance_markdown(requirement_path / "acceptance.md")
    roadmap_from_markdown = parse_roadmap_markdown(requirement_path / "roadmap.md")

    source_files = {
        "tasks": tasks_path,
        "roadmap": requirement_path / "roadmap.md",
        "acceptance": requirement_path / "acceptance.md",
    }

    task_records = data.get("tasks")
    if not isinstance(task_records, list):
        raise ValueError(f"tasks.yaml must contain a tasks list: {tasks_path}")

    imported_task_ids: set[str] = set()
    imported_acceptance_ids: set[str] = set(acceptance_from_markdown)
    dependency_links: list[tuple[str, str]] = []

    with connect_db(home) as connection:
        connection.execute(
            """
            INSERT INTO requirements (id, project_id, requirement_id, title, path, status, imported_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
            ON CONFLICT(project_id, requirement_id) DO UPDATE SET
              title = excluded.title,
              path = excluded.path,
              status = 'active',
              updated_at = excluded.updated_at
            """,
            (requirement_db_id, project_id_value, requirement_id_value, title, str(requirement_path), now, now),
        )
        for source_name, path in source_files.items():
            connection.execute(
                """
                INSERT INTO source_revisions (id, project_id, requirement_id, source_name, path, sha256, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, requirement_id, source_name) DO UPDATE SET
                  path = excluded.path,
                  sha256 = excluded.sha256,
                  updated_at = excluded.updated_at
                """,
                (
                    f"{requirement_db_id}:{source_name}",
                    project_id_value,
                    requirement_id_value,
                    source_name,
                    str(path),
                    file_hash(path),
                    now,
                ),
            )

        connection.execute(
            "DELETE FROM roadmap_items WHERE project_id = ? AND requirement_id = ?",
            (project_id_value, requirement_id_value),
        )
        for index, roadmap_item in enumerate(roadmap_from_markdown):
            roadmap_id_value = str(roadmap_item["roadmap_id"])
            connection.execute(
                """
                INSERT INTO roadmap_items
                  (id, project_id, requirement_id, roadmap_id, title, body, sort_order, source_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{requirement_db_id}:roadmap:{roadmap_id_value}",
                    project_id_value,
                    requirement_id_value,
                    roadmap_id_value,
                    str(roadmap_item["title"]),
                    roadmap_item.get("body"),
                    index,
                    json.dumps(roadmap_item, sort_keys=True),
                    now,
                    now,
                ),
            )

        for acceptance_id_value, acceptance_title in acceptance_from_markdown.items():
            item_key = acceptance_key(project_id_value, requirement_id_value, acceptance_id_value)
            connection.execute(
                """
                INSERT INTO acceptance_items
                  (id, project_id, requirement_id, acceptance_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, requirement_id, acceptance_id) DO UPDATE SET
                  title = excluded.title,
                  updated_at = excluded.updated_at
                """,
                (item_key, project_id_value, requirement_id_value, acceptance_id_value, acceptance_title, now, now),
            )

        for index, task in enumerate(task_records):
            if not isinstance(task, dict):
                continue
            task_id_value = str(task.get("id") or "").strip()
            if not task_id_value:
                raise ValueError("Every task must have an id")
            imported_task_ids.add(task_id_value)
            key = task_key(project_id_value, requirement_id_value, task_id_value)
            task_source_json = json.dumps(task, sort_keys=True)
            task_definition_hash = stable_json_hash(task)
            existing = connection.execute(
                "SELECT status, created_at, definition_hash, definition_stale FROM tasks WHERE id = ?",
                (key,),
            ).fetchone()
            status = existing["status"] if existing else "draft"
            created_at = existing["created_at"] if existing else now
            definition_changed = bool(existing and existing["definition_hash"] and existing["definition_hash"] != task_definition_hash)
            definition_stale = 1 if existing and (existing["definition_stale"] or (definition_changed and status != "draft")) else 0
            definition_changed_at = now if definition_changed else None
            connection.execute(
                """
                INSERT INTO tasks
                  (id, project_id, requirement_id, task_id, title, type, status, priority, sort_order,
                   suggested_agent, acceptance_agent, review_agent, roadmap_id, branch, worktree_hint, scope_json,
                   validation_json, review_json, source_json, definition_hash, definition_stale, definition_changed_at,
                   archived, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                ON CONFLICT(project_id, requirement_id, task_id) DO UPDATE SET
                  title = excluded.title,
                  type = excluded.type,
                  priority = excluded.priority,
                  sort_order = excluded.sort_order,
                  suggested_agent = excluded.suggested_agent,
                  acceptance_agent = excluded.acceptance_agent,
                  review_agent = excluded.review_agent,
                  roadmap_id = excluded.roadmap_id,
                  branch = excluded.branch,
                  worktree_hint = excluded.worktree_hint,
                  scope_json = excluded.scope_json,
                  validation_json = excluded.validation_json,
                  review_json = excluded.review_json,
                  source_json = excluded.source_json,
                  definition_hash = excluded.definition_hash,
                  definition_stale = excluded.definition_stale,
                  definition_changed_at = COALESCE(excluded.definition_changed_at, tasks.definition_changed_at),
                  archived = 0,
                  updated_at = excluded.updated_at
                """,
                (
                    key,
                    project_id_value,
                    requirement_id_value,
                    task_id_value,
                    str(task.get("title") or task_id_value),
                    task.get("type"),
                    status,
                    int(task.get("priority") or 100),
                    index,
                    task.get("suggested_agent"),
                    task.get("acceptance_agent"),
                    task.get("review_agent"),
                    task.get("roadmap_id") or task.get("roadmap"),
                    task.get("branch"),
                    task.get("worktree_hint"),
                    json.dumps(task.get("scope") or {}, sort_keys=True),
                    json.dumps(task.get("validation") or [], sort_keys=True),
                    json.dumps(task.get("review") or {}, sort_keys=True),
                    task_source_json,
                    task_definition_hash,
                    definition_stale,
                    definition_changed_at,
                    created_at,
                    now,
                ),
            )
            if definition_changed:
                add_activity_event(
                    connection,
                    "task.definition_changed",
                    project_id_value,
                    requirement_id_value,
                    key,
                    {
                        "task_id": task_id_value,
                        "previous_hash": existing["definition_hash"],
                        "current_hash": task_definition_hash,
                        "definition_stale": bool(definition_stale),
                    },
                )
            connection.execute("DELETE FROM task_dependencies WHERE task_id = ?", (key,))
            for dependency in task.get("depends_on") or []:
                dep_key = task_key(project_id_value, requirement_id_value, str(dependency))
                dependency_links.append((key, dep_key))
            connection.execute("DELETE FROM task_acceptance_links WHERE task_id = ?", (key,))
            for acceptance_id_value in task.get("acceptance_refs") or []:
                acceptance_id_value = str(acceptance_id_value)
                imported_acceptance_ids.add(acceptance_id_value)
                item_key = acceptance_key(project_id_value, requirement_id_value, acceptance_id_value)
                title_value = acceptance_from_markdown.get(acceptance_id_value, acceptance_id_value)
                connection.execute(
                    """
                    INSERT INTO acceptance_items
                      (id, project_id, requirement_id, acceptance_id, title, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(project_id, requirement_id, acceptance_id) DO UPDATE SET
                      title = CASE
                        WHEN acceptance_items.title = acceptance_items.acceptance_id THEN excluded.title
                        ELSE acceptance_items.title
                      END,
                      updated_at = excluded.updated_at
                    """,
                    (item_key, project_id_value, requirement_id_value, acceptance_id_value, title_value, now, now),
                )
                connection.execute(
                    """
                    INSERT OR IGNORE INTO task_acceptance_links (task_id, acceptance_item_id)
                    VALUES (?, ?)
                    """,
                    (key, item_key),
                )

        for key, dep_key in dependency_links:
            connection.execute(
                """
                INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id)
                VALUES (?, ?)
                """,
                (key, dep_key),
            )

        placeholders = ",".join("?" for _ in imported_task_ids) or "''"
        connection.execute(
            f"""
            UPDATE tasks
            SET archived = 1, status = CASE WHEN status = 'accepted' THEN status ELSE 'canceled' END, updated_at = ?
            WHERE project_id = ? AND requirement_id = ? AND task_id NOT IN ({placeholders})
            """,
            (now, project_id_value, requirement_id_value, *sorted(imported_task_ids)),
        )
        add_activity_event(
            connection,
            "requirement.imported",
            project_id_value,
            requirement_id_value,
            payload={
                "tasks_imported": len(imported_task_ids),
                "acceptance_items_imported": len(imported_acceptance_ids),
                "roadmap_items_imported": len(roadmap_from_markdown),
            },
        )
        connection.commit()

    return {
        "project_id": project_id_value,
        "requirement_id": requirement_id_value,
        "title": title,
        "tasks_imported": len(imported_task_ids),
        "acceptance_items_imported": len(imported_acceptance_ids),
        "roadmap_items_imported": len(roadmap_from_markdown),
    }


def refresh_project(home: Path, project_id_value: str) -> dict[str, Any]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    project_root = Path(project["project_root"])
    imports = [import_requirement(home, project, path) for path in discover_requirement_paths(project_root)]
    return {"project_id": project_id_value, "requirements_imported": len(imports), "imports": imports}


def refresh_requirement(home: Path, project_id_value: str, requirement_id_value: str) -> dict[str, Any]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    existing = get_requirement(home, project_id_value, requirement_id_value)
    requirement_path = (
        Path(existing["requirement"]["path"])
        if existing and existing.get("requirement", {}).get("path")
        else Path(project["project_root"]) / ".vibeRig" / "requirements" / requirement_id_value
    )
    imported = import_requirement(home, project, requirement_path)
    return {
        "project_id": project_id_value,
        "requirement_id": imported["requirement_id"],
        "import": imported,
    }


def normalize_task(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["scope"] = json_loads_field(item.pop("scope_json", None), {})
    item["validation"] = json_loads_field(item.pop("validation_json", None), [])
    item["review"] = json_loads_field(item.pop("review_json", None), {})
    item["source"] = json_loads_field(item.pop("source_json", None), {})
    item["definition_stale"] = bool(item.get("definition_stale"))
    return item


def normalize_run(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item["codex_usage"] = json_loads_field(item.pop("codex_usage_json", None), {})
    item["changed_files"] = json_loads_field(item.pop("changed_files_json", None), [])
    return item


def task_status_reason(task: dict[str, Any], latest_run: dict[str, Any] | None = None, manual_review: dict[str, Any] | None = None) -> str | None:
    if task.get("status") == "ready" and manual_review and manual_review.get("result") == "rejected":
        for key in ("notes", "residual_risks"):
            value = manual_review.get(key)
            if value:
                return str(value)
        return "manual review rejected"
    if task.get("status") not in {"blocked", "failed"}:
        return None
    if latest_run:
        for key in ("error_summary", "summary"):
            value = latest_run.get(key)
            if value:
                return str(value)
    if manual_review:
        for key in ("notes", "residual_risks", "result"):
            value = manual_review.get(key)
            if value:
                return str(value)
    return None


def normalize_codex_session(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item["turn_ids"] = json_loads_field(item.pop("turn_ids_json", None), [])
    item["usage"] = json_loads_field(item.pop("usage_json", None), {})
    return item


def list_requirements(home: Path, project_id_value: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM requirements"
    params: list[Any] = []
    if project_id_value:
        query += " WHERE project_id = ?"
        params.append(project_id_value)
    query += " ORDER BY updated_at DESC, title ASC"
    with connect_db(home) as connection:
        return [dict(row) for row in connection.execute(query, params).fetchall()]


def list_projects(home: Path) -> list[dict[str, Any]]:
    with connect_db(home) as connection:
        rows = connection.execute("SELECT * FROM projects ORDER BY name ASC").fetchall()
        if rows:
            return [dict(row) for row in rows]
    projects = load_projects(home)["projects"]
    for project in projects:
        sync_project_to_db(home, project)
    return projects


def get_requirement(home: Path, project_id_value: str, requirement_id_value: str) -> dict[str, Any]:
    with connect_db(home) as connection:
        requirement = connection.execute(
            "SELECT * FROM requirements WHERE project_id = ? AND requirement_id = ?",
            (project_id_value, requirement_id_value),
        ).fetchone()
        if not requirement:
            raise ValueError(f"Unknown requirement: {requirement_id_value}")
        roadmap_items = [
            dict(row)
            for row in connection.execute(
                """
                SELECT * FROM roadmap_items
                WHERE project_id = ? AND requirement_id = ?
                ORDER BY sort_order ASC
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        ]
        source_revisions = [
            dict(row)
            for row in connection.execute(
                """
                SELECT source_name, path, sha256, updated_at FROM source_revisions
                WHERE project_id = ? AND requirement_id = ?
                ORDER BY source_name ASC
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        ]
    return {"requirement": dict(requirement), "roadmap_items": roadmap_items, "source_revisions": source_revisions}


def get_board(home: Path, project_id_value: str, requirement_id_value: str) -> dict[str, Any]:
    with connect_db(home) as connection:
        requirement = connection.execute(
            "SELECT * FROM requirements WHERE project_id = ? AND requirement_id = ?",
            (project_id_value, requirement_id_value),
        ).fetchone()
        if not requirement:
            raise ValueError(f"Unknown requirement: {requirement_id_value}")
        tasks = [
            normalize_task(row)
            for row in connection.execute(
                """
                SELECT * FROM tasks
                WHERE project_id = ? AND requirement_id = ? AND archived = 0
                ORDER BY sort_order ASC, priority ASC, task_id ASC
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        ]
        dependencies = [
            dict(row)
            for row in connection.execute(
                """
                SELECT d.task_id, d.depends_on_task_id, d.waived
                FROM task_dependencies d
                JOIN tasks t ON t.id = d.task_id
                WHERE t.project_id = ? AND t.requirement_id = ?
                ORDER BY d.task_id, d.depends_on_task_id
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        ]
        acceptance_items = [
            dict(row)
            for row in connection.execute(
                """
                SELECT * FROM acceptance_items
                WHERE project_id = ? AND requirement_id = ?
                ORDER BY acceptance_id ASC
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        ]
        task_acceptance_links = [
            dict(row)
            for row in connection.execute(
                """
                SELECT l.task_id, l.acceptance_item_id
                FROM task_acceptance_links l
                JOIN tasks t ON t.id = l.task_id
                WHERE t.project_id = ? AND t.requirement_id = ?
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        ]
        evidence_counts = {
            row["task_id"]: row["count"]
            for row in connection.execute(
                """
                SELECT task_id, COUNT(*) AS count FROM evidence
                WHERE project_id = ? AND requirement_id = ? AND task_id IS NOT NULL
                GROUP BY task_id
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        }
        latest_runs = {
            row["task_id"]: normalize_run(row)
            for row in connection.execute(
                """
                SELECT r.* FROM runs r
                JOIN (
                  SELECT task_id, MAX(started_at) AS started_at FROM runs
                  WHERE project_id = ? AND requirement_id = ? AND task_id IS NOT NULL
                  GROUP BY task_id
                ) latest ON latest.task_id = r.task_id AND latest.started_at = r.started_at
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        }
        review_status = {
            row["task_id"]: dict(row)
            for row in connection.execute(
                """
                SELECT task_id, result, reviewer, created_at FROM manual_reviews
                WHERE project_id = ? AND requirement_id = ?
                ORDER BY created_at DESC
                """,
                (project_id_value, requirement_id_value),
            ).fetchall()
        }
    for task in tasks:
        task["evidence_count"] = evidence_counts.get(task["id"], 0)
        task["latest_run"] = latest_runs.get(task["id"])
        task["manual_review"] = review_status.get(task["id"])
        task["status_reason"] = task_status_reason(task, task["latest_run"], task["manual_review"])
        task["blocked_reason"] = task["status_reason"]
        linked_ids = {
            link["acceptance_item_id"]
            for link in task_acceptance_links
            if link["task_id"] == task["id"]
        }
        linked_items = [item for item in acceptance_items if item["id"] in linked_ids]
        completed = len([item for item in linked_items if item["status"] in {"passed", "waived"}])
        task["acceptance_progress"] = {
            "completed": completed,
            "total": len(linked_items),
        }
    columns = [
        {
            "status": status,
            "title": title,
            "tasks": [task for task in tasks if task["status"] == status],
        }
        for status, title in BOARD_COLUMNS
    ]
    return {
        "requirement": dict(requirement),
        "columns": columns,
        "tasks": tasks,
        "dependencies": dependencies,
        "acceptance_items": acceptance_items,
        "task_acceptance_links": task_acceptance_links,
    }


def task_has_evidence(connection: sqlite3.Connection, task_db_id: str, kind: str | None = None) -> bool:
    query = "SELECT 1 FROM evidence WHERE task_id = ?"
    params: list[Any] = [task_db_id]
    if kind:
        query += " AND kind = ?"
        params.append(kind)
    return connection.execute(query, params).fetchone() is not None


def task_has_manual_acceptance(connection: sqlite3.Connection, task_db_id: str) -> bool:
    return (
        connection.execute(
            "SELECT 1 FROM manual_reviews WHERE task_id = ? AND result = 'accepted'",
            (task_db_id,),
        ).fetchone()
        is not None
    )


def archive_requirement_if_fully_accepted(
    connection: sqlite3.Connection,
    project_id_value: str,
    requirement_id_value: str,
    now: str,
) -> bool:
    remaining = connection.execute(
        """
        SELECT COUNT(*) AS count FROM tasks
        WHERE project_id = ? AND requirement_id = ? AND archived = 0 AND status != 'accepted'
        """,
        (project_id_value, requirement_id_value),
    ).fetchone()
    if remaining and int(remaining["count"]) > 0:
        return False
    task_count = connection.execute(
        """
        SELECT COUNT(*) AS count FROM tasks
        WHERE project_id = ? AND requirement_id = ? AND archived = 0
        """,
        (project_id_value, requirement_id_value),
    ).fetchone()
    if not task_count or int(task_count["count"]) == 0:
        return False
    connection.execute(
        """
        UPDATE requirements SET status = 'archived', updated_at = ?
        WHERE project_id = ? AND requirement_id = ? AND status != 'archived'
        """,
        (now, project_id_value, requirement_id_value),
    )
    add_activity_event(
        connection,
        "requirement.archived",
        project_id_value,
        requirement_id_value,
        payload={"reason": "all active tasks manually accepted"},
    )
    return True


def list_evidence(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str | None = None,
) -> list[dict[str, Any]]:
    params: list[Any] = [project_id_value, requirement_id_value]
    query = """
        SELECT * FROM evidence
        WHERE project_id = ? AND requirement_id = ?
    """
    if task_id_value:
        query += " AND task_id = ?"
        params.append(task_key(project_id_value, requirement_id_value, task_id_value))
    query += " ORDER BY recorded_at DESC"
    with connect_db(home) as connection:
        rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def list_activity(
    home: Path,
    project_id_value: str | None = None,
    requirement_id_value: str | None = None,
    task_db_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    params: list[Any] = []
    clauses = []
    if project_id_value:
        clauses.append("project_id = ?")
        params.append(project_id_value)
    if requirement_id_value:
        clauses.append("requirement_id = ?")
        params.append(requirement_id_value)
    if task_db_id:
        clauses.append("task_id = ?")
        params.append(task_db_id)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    params.append(limit)
    with connect_db(home) as connection:
        rows = connection.execute(
            f"SELECT * FROM activity_events{where} ORDER BY created_at DESC LIMIT ?",
            params,
        ).fetchall()
    return [dict(row) for row in rows]


def get_task(home: Path, project_id_value: str, requirement_id_value: str, task_id_value: str) -> dict[str, Any]:
    key = task_key(project_id_value, requirement_id_value, task_id_value)
    with connect_db(home) as connection:
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (key,)).fetchone()
        if not task:
            raise ValueError(f"Unknown task: {task_id_value}")
        dependencies = [
            dict(row)
            for row in connection.execute(
                """
                SELECT dep.* FROM task_dependencies d
                JOIN tasks dep ON dep.id = d.depends_on_task_id
                WHERE d.task_id = ?
                ORDER BY dep.sort_order ASC
                """,
                (key,),
            ).fetchall()
        ]
        acceptance_items = [
            dict(row)
            for row in connection.execute(
                """
                SELECT a.* FROM task_acceptance_links l
                JOIN acceptance_items a ON a.id = l.acceptance_item_id
                WHERE l.task_id = ?
                ORDER BY a.acceptance_id ASC
                """,
                (key,),
            ).fetchall()
        ]
        runs = [
            normalize_run(row)
            for row in connection.execute(
                "SELECT * FROM runs WHERE task_id = ? ORDER BY started_at DESC",
                (key,),
            ).fetchall()
        ]
        reviews = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM manual_reviews WHERE task_id = ? ORDER BY created_at DESC",
                (key,),
            ).fetchall()
        ]
        codex_sessions = [
            normalize_codex_session(row)
            for row in connection.execute(
                "SELECT * FROM codex_sessions WHERE task_id = ? ORDER BY started_at DESC",
                (key,),
            ).fetchall()
        ]
    normalized_task = normalize_task(task)
    latest_run = runs[0] if runs else None
    latest_review = reviews[0] if reviews else None
    normalized_task["latest_run"] = latest_run
    normalized_task["manual_review"] = latest_review
    normalized_task["status_reason"] = task_status_reason(normalized_task, latest_run, latest_review)
    normalized_task["blocked_reason"] = normalized_task["status_reason"]
    return {
        "task": normalized_task,
        "dependencies": dependencies,
        "acceptance_items": acceptance_items,
        "runs": runs,
        "codex_sessions": codex_sessions,
        "evidence": list_evidence(home, project_id_value, requirement_id_value, task_id_value),
        "manual_reviews": reviews,
        "activity": list_activity(home, project_id_value, requirement_id_value, key),
    }


def validate_task_transition(
    connection: sqlite3.Connection,
    task: sqlite3.Row,
    target_status: str,
    auto_acceptable: bool = False,
    reason: str | None = None,
) -> None:
    if target_status not in TASK_STATES:
        raise ValueError(f"Unknown task status: {target_status}")
    allowed = {
        "draft": {"ready", "canceled"},
        "ready": {"running", "blocked", "canceled"},
        "running": {"self_accepted", "human_review", "blocked", "failed", "canceled"},
        "self_accepted": {"ready", "human_review", "accepted", "blocked", "failed", "canceled"},
        "human_review": {"ready", "accepted", "blocked", "canceled"},
        "blocked": {"ready", "canceled"},
        "failed": {"ready", "canceled"},
        "accepted": set(),
        "canceled": {"ready"},
    }
    current_status = task["status"]
    if current_status != target_status and target_status not in allowed.get(current_status, set()):
        stale_reopen = bool(task["definition_stale"]) and current_status in {"self_accepted", "human_review", "accepted"} and target_status == "ready"
        if not stale_reopen:
            raise ValueError(f"Invalid task transition: {current_status} -> {target_status}")
    if target_status == "ready":
        if task["status"] in {"human_review", "blocked", "failed", "accepted", "canceled"} and not reason:
            raise ValueError("Moving a non-active task back to ready requires a reason.")
        blockers = connection.execute(
            """
            SELECT dep.task_id
            FROM task_dependencies d
            JOIN tasks dep ON dep.id = d.depends_on_task_id
            WHERE d.task_id = ? AND d.waived = 0 AND dep.status != 'accepted'
            """,
            (task["id"],),
        ).fetchall()
        if blockers:
            raise ValueError("Task cannot move to ready until dependencies are accepted or waived.")
    if target_status == "self_accepted" and not (
        task_has_evidence(connection, task["id"], "self_acceptance")
        or task_has_evidence(connection, task["id"], "validation")
    ):
        raise ValueError("Task cannot move to self_accepted without validation or self_acceptance evidence.")
    if target_status == "accepted" and not (auto_acceptable or task_has_manual_acceptance(connection, task["id"])):
        raise ValueError("Task cannot move to accepted without an accepted manual review.")
    if target_status == "canceled" and not reason:
        raise ValueError("Moving a task to canceled requires a reason.")


def update_task_status(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    status: str,
    auto_acceptable: bool = False,
    reason: str | None = None,
) -> dict[str, Any]:
    now = utc_now()
    key = task_key(project_id_value, requirement_id_value, task_id_value)
    with connect_db(home) as connection:
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (key,)).fetchone()
        if not task:
            raise ValueError(f"Unknown task: {task_id_value}")
        validate_task_transition(connection, task, status, auto_acceptable=auto_acceptable, reason=reason)
        if status == "running":
            connection.execute(
                "UPDATE tasks SET status = ?, definition_stale = 0, definition_changed_at = NULL, updated_at = ? WHERE id = ?",
                (status, now, key),
            )
        else:
            connection.execute("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?", (status, now, key))
        add_activity_event(
            connection,
            "task.status_updated",
            project_id_value,
            requirement_id_value,
            key,
            {"status": status, "reason": reason, "auto_acceptable": auto_acceptable},
        )
        connection.commit()
        updated = connection.execute("SELECT * FROM tasks WHERE id = ?", (key,)).fetchone()
        return normalize_task(updated)


def mark_task_running_for_resume(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    run_id: str,
) -> dict[str, Any]:
    now = utc_now()
    key = task_key(project_id_value, requirement_id_value, task_id_value)
    with connect_db(home) as connection:
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (key,)).fetchone()
        if not task:
            raise ValueError(f"Unknown task: {task_id_value}")
        if task["status"] != "blocked":
            raise ValueError("Resume can only move a blocked task to running.")
        connection.execute(
            """
            UPDATE tasks
            SET status = 'running', definition_stale = 0, definition_changed_at = NULL, updated_at = ?
            WHERE id = ?
            """,
            (now, key),
        )
        add_activity_event(
            connection,
            "task.resume_running",
            project_id_value,
            requirement_id_value,
            key,
            {"status": "running", "run_id": run_id},
        )
        connection.commit()
        updated = connection.execute("SELECT * FROM tasks WHERE id = ?", (key,)).fetchone()
        return normalize_task(updated)


def update_task_order(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    ordered_task_ids: list[str],
) -> dict[str, Any]:
    now = utc_now()
    with connect_db(home) as connection:
        for index, task_id_value in enumerate(ordered_task_ids):
            connection.execute(
                """
                UPDATE tasks SET sort_order = ?, updated_at = ?
                WHERE project_id = ? AND requirement_id = ? AND task_id = ?
                """,
                (index, now, project_id_value, requirement_id_value, task_id_value),
            )
        add_activity_event(
            connection,
            "task.order_updated",
            project_id_value,
            requirement_id_value,
            payload={"task_ids": ordered_task_ids},
        )
        connection.commit()
    return {"updated": len(ordered_task_ids)}


def record_evidence(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str | None,
    kind: str,
    summary: str = "",
    path: str | None = None,
    payload: dict[str, Any] | None = None,
    acceptance_id_value: str | None = None,
) -> dict[str, Any]:
    now = utc_now()
    task_db_id = task_key(project_id_value, requirement_id_value, task_id_value) if task_id_value else None
    acceptance_db_id = (
        acceptance_key(project_id_value, requirement_id_value, acceptance_id_value)
        if acceptance_id_value
        else None
    )
    evidence_id = f"evidence:{hashlib.sha1((str(task_db_id) + kind + now).encode('utf-8')).hexdigest()}"
    with connect_db(home) as connection:
        connection.execute(
            """
            INSERT INTO evidence
              (id, project_id, requirement_id, task_id, acceptance_item_id, kind, path, summary, payload_json, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                evidence_id,
                project_id_value,
                requirement_id_value,
                task_db_id,
                acceptance_db_id,
                kind,
                path,
                summary,
                json.dumps(payload or {}, sort_keys=True),
                now,
            ),
        )
        add_activity_event(
            connection,
            "evidence.recorded",
            project_id_value,
            requirement_id_value,
            task_db_id,
            {"kind": kind, "path": path, "summary": summary, "acceptance_id": acceptance_id_value},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM evidence WHERE id = ?", (evidence_id,)).fetchone()
        return dict(row)


def discover_evidence(home: Path, project_id_value: str, requirement_id_value: str) -> dict[str, Any]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    requirement_dir = Path(project["project_root"]) / ".vibeRig" / "requirements" / requirement_id_value
    evidence_root = requirement_dir / "evidence"
    supported = {
        "self-acceptance.md": "self_acceptance",
        "validation.json": "validation",
        "run.log": "run_log",
        "changed-files.txt": "changed_files",
        "human-review.md": "human_review",
    }
    recorded = []
    if not evidence_root.exists():
        return {"recorded": recorded}
    for task_dir in sorted(path for path in evidence_root.iterdir() if path.is_dir()):
        task_id_value = task_dir.name
        for file_name, kind in supported.items():
            path = task_dir / file_name
            if not path.exists():
                continue
            summary = f"Discovered {file_name}"
            payload: dict[str, Any] = {"sha256": file_hash(path)}
            if file_name == "validation.json":
                try:
                    payload["validation"] = json.loads(path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    payload["validation_error"] = "invalid json"
            recorded.append(
                record_evidence(
                    home,
                    project_id_value,
                    requirement_id_value,
                    task_id_value,
                    kind,
                    summary,
                    str(path),
                    payload,
                )
            )
    return {"recorded": recorded}


def update_acceptance_status(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    acceptance_id_value: str,
    status: str,
) -> dict[str, Any]:
    if status not in {"pending", "passed", "failed", "blocked", "waived"}:
        raise ValueError("acceptance status must be pending, passed, failed, blocked, or waived")
    now = utc_now()
    key = acceptance_key(project_id_value, requirement_id_value, acceptance_id_value)
    with connect_db(home) as connection:
        connection.execute(
            "UPDATE acceptance_items SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, key),
        )
        add_activity_event(
            connection,
            "acceptance.status_updated",
            project_id_value,
            requirement_id_value,
            payload={"acceptance_id": acceptance_id_value, "status": status},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM acceptance_items WHERE id = ?", (key,)).fetchone()
        if not row:
            raise ValueError(f"Unknown acceptance item: {acceptance_id_value}")
        return dict(row)


def record_manual_review(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    reviewer: str,
    result: str,
    notes: str = "",
    evidence_reviewed: list[str] | None = None,
    residual_risks: str = "",
    apply_task_status: bool = False,
) -> dict[str, Any]:
    if result not in {"accepted", "rejected"}:
        raise ValueError("manual review result must be accepted or rejected")
    if apply_task_status and result == "rejected" and not notes.strip():
        raise ValueError("manual review rejection requires a reason.")
    now = utc_now()
    task_db_id = task_key(project_id_value, requirement_id_value, task_id_value)
    review_id = f"review:{hashlib.sha1((task_db_id + reviewer + now).encode('utf-8')).hexdigest()}"
    with connect_db(home) as connection:
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (task_db_id,)).fetchone()
        if not task:
            raise ValueError(f"Unknown task: {task_id_value}")
        connection.execute(
            """
            INSERT INTO manual_reviews
              (id, project_id, requirement_id, task_id, reviewer, result, notes,
               evidence_reviewed_json, residual_risks, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                review_id,
                project_id_value,
                requirement_id_value,
                task_db_id,
                reviewer,
                result,
                notes,
                json.dumps(evidence_reviewed or [], sort_keys=True),
                residual_risks,
                now,
            ),
        )
        if apply_task_status and result == "accepted":
            validate_task_transition(connection, task, "accepted")
            connection.execute("UPDATE tasks SET status = 'accepted', updated_at = ? WHERE id = ?", (now, task_db_id))
            add_activity_event(
                connection,
                "task.status_updated",
                project_id_value,
                requirement_id_value,
                task_db_id,
                {"status": "accepted", "reason": "manual review accepted"},
            )
            archive_requirement_if_fully_accepted(connection, project_id_value, requirement_id_value, now)
        elif apply_task_status and result == "rejected":
            reason = notes.strip()
            validate_task_transition(connection, task, "ready", reason=reason)
            connection.execute(
                "UPDATE tasks SET status = 'ready', updated_at = ? WHERE id = ?",
                (now, task_db_id),
            )
            add_activity_event(
                connection,
                "task.status_updated",
                project_id_value,
                requirement_id_value,
                task_db_id,
                {"status": "ready", "reason": reason},
            )
        add_activity_event(
            connection,
            "review.recorded",
            project_id_value,
            requirement_id_value,
            task_db_id,
            {"reviewer": reviewer, "result": result},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM manual_reviews WHERE id = ?", (review_id,)).fetchone()
        return dict(row)


def get_project_requirement_task(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    with connect_db(home) as connection:
        task = connection.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (task_key(project_id_value, requirement_id_value, task_id_value),),
        ).fetchone()
        if not task:
            raise ValueError(f"Unknown task: {task_id_value}")
    return project, normalize_task(task)


def create_run(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    worktree_path: str | None = None,
) -> dict[str, Any]:
    project, task = get_project_requirement_task(home, project_id_value, requirement_id_value, task_id_value)
    if task["status"] != "ready":
        raise ValueError("Runner can only start tasks in ready status.")
    with connect_db(home) as connection:
        task_row = connection.execute("SELECT * FROM tasks WHERE id = ?", (task["id"],)).fetchone()
        validate_task_transition(
            connection,
            task_row,
            "ready",
            reason="runner dependency preflight",
        )
    run_id = new_record_id("run", project_id_value, requirement_id_value, task_id_value)
    run_dir = home / "runs" / run_id.replace(":", "-")
    run_dir.mkdir(parents=True, exist_ok=True)
    run_db_path = run_dir / "run.sqlite"
    run_log_path = run_dir / "run.log"
    worktree = worktree_path or str(Path(project["project_root"]) / "worktrees" / f"{requirement_id_value}-{task_id_value}")
    source_sha = current_git_sha(Path(project["project_root"]))
    runner_config = codex_runner_config(Path(project["project_root"]))
    base_ref = str(runner_config.get("base_ref") or "origin/main")
    now = utc_now()
    with sqlite3.connect(run_db_path) as run_db:
        run_db.execute("CREATE TABLE IF NOT EXISTS log_events (created_at TEXT, message TEXT)")
        run_db.execute("INSERT INTO log_events (created_at, message) VALUES (?, ?)", (now, "run created"))
        run_db.commit()
    run_log_path.write_text(f"{now} run created for {task_id_value}\n", encoding="utf-8")
    publish_server_event(
        "run.log",
        {"run_id": run_id, "path": str(run_log_path), "message": f"{now} run created for {task_id_value}"},
    )
    with connect_db(home) as connection:
        connection.execute(
            """
            INSERT INTO runs
              (id, project_id, requirement_id, task_id, status, implementation_status, codex_adapter,
               codex_usage_json, changed_files_json, base_ref, source_sha, worktree_path, run_db_path, started_at, summary)
            VALUES (?, ?, ?, ?, 'created', 'created', ?, '{}', '[]', ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                project_id_value,
                requirement_id_value,
                task["id"],
                runner_config["adapter"],
                base_ref,
                source_sha,
                worktree,
                str(run_db_path),
                now,
                str(run_log_path),
            ),
        )
        add_activity_event(
            connection,
            "run.created",
            project_id_value,
            requirement_id_value,
            task["id"],
            {"run_id": run_id, "worktree_path": worktree, "log_path": str(run_log_path)},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        return normalize_run(row)


def append_run_event(
    home: Path,
    run_id: str,
    event_type: str,
    message: str = "",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    now = utc_now()
    event_id = new_record_id("run-event", run_id, event_type)
    with connect_db(home) as connection:
        run = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"Unknown run: {run_id}")
        connection.execute(
            """
            INSERT INTO run_events (id, run_id, event_type, message, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (event_id, run_id, event_type, message, json.dumps(payload or {}, sort_keys=True), now),
        )
        add_activity_event(
            connection,
            f"run.{event_type}",
            run["project_id"],
            run["requirement_id"],
            run["task_id"],
            {"run_id": run_id, "message": message},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM run_events WHERE id = ?", (event_id,)).fetchone()
    log_path = get_run_log_path(home, run_id)
    if log_path:
        with Path(log_path).open("a", encoding="utf-8") as handle:
            handle.write(f"{now} {event_type}: {message}\n")
        publish_server_event(
            "run.log",
            {"run_id": run_id, "path": log_path, "event_type": event_type, "message": f"{now} {event_type}: {message}"},
        )
    publish_server_event("run.event", {"run_id": run_id, "event": dict(row)})
    return dict(row)


def update_run_progress(
    home: Path,
    run_id: str,
    implementation_status: str,
    status: str | None = None,
    **fields: Any,
) -> dict[str, Any]:
    allowed_fields = {
        "codex_adapter",
        "codex_session_id",
        "codex_thread_id",
        "codex_conversation_id",
        "codex_exit_code",
        "codex_usage_json",
        "changed_files_json",
        "diff_path",
        "base_ref",
        "base_sha",
        "source_sha",
        "error_summary",
        "summary",
    }
    assignments = ["implementation_status = ?"]
    values: list[Any] = [implementation_status]
    if status:
        assignments.append("status = ?")
        values.append(status)
    for key, value in fields.items():
        if key not in allowed_fields:
            continue
        assignments.append(f"{key} = ?")
        if key in {"codex_usage_json", "changed_files_json"} and not isinstance(value, str):
            values.append(json.dumps(value, sort_keys=True))
        else:
            values.append(value)
    values.append(run_id)
    with connect_db(home) as connection:
        connection.execute(f"UPDATE runs SET {', '.join(assignments)} WHERE id = ?", values)
        connection.commit()
        row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not row:
            raise ValueError(f"Unknown run: {run_id}")
        run = normalize_run(row)
    publish_server_event("run.updated", {"run_id": run_id, "run": run})
    return run


def latest_manual_review(home: Path, task_db_id: str) -> dict[str, Any] | None:
    with connect_db(home) as connection:
        row = connection.execute(
            "SELECT * FROM manual_reviews WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
            (task_db_id,),
        ).fetchone()
        return dict(row) if row else None


def finish_run(home: Path, run_id: str, status: str, summary: str = "") -> dict[str, Any]:
    if status not in RUN_TERMINAL_STATES:
        raise ValueError("run status must be success, failed, blocked, or canceled")
    now = utc_now()
    with connect_db(home) as connection:
        run = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"Unknown run: {run_id}")
        connection.execute(
            "UPDATE runs SET status = ?, implementation_status = ?, finished_at = ?, summary = ? WHERE id = ?",
            (status, status, now, summary, run_id),
        )
        add_activity_event(
            connection,
            "run.finished",
            run["project_id"],
            run["requirement_id"],
            run["task_id"],
            {"run_id": run_id, "status": status, "summary": summary},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    append_run_event(home, run_id, "finished", summary, {"status": status})
    run = normalize_run(row)
    publish_server_event("run.updated", {"run_id": run_id, "run": run})
    return run


def get_run_log_path(home: Path, run_id: str) -> str | None:
    with connect_db(home) as connection:
        run = connection.execute("SELECT summary FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            return None
        summary = run["summary"]
        if summary and Path(summary).exists():
            return summary
    candidate = home / "runs" / run_id.replace(":", "-") / "run.log"
    return str(candidate) if candidate.exists() else None


def get_run_log(home: Path, run_id: str) -> dict[str, Any]:
    path = get_run_log_path(home, run_id)
    if not path:
        raise ValueError(f"Run log not found: {run_id}")
    return {"run_id": run_id, "path": path, "log": Path(path).read_text(encoding="utf-8", errors="replace")}


def get_run(home: Path, run_id: str) -> dict[str, Any]:
    with connect_db(home) as connection:
        run = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"Unknown run: {run_id}")
        session = connection.execute(
            """
            SELECT * FROM codex_sessions
            WHERE run_id = ? AND prompt_path LIKE '%codex-prompt.md'
            ORDER BY started_at ASC LIMIT 1
            """,
            (run_id,),
        ).fetchone()
        if not session:
            session = connection.execute("SELECT * FROM codex_sessions WHERE run_id = ? ORDER BY started_at ASC LIMIT 1", (run_id,)).fetchone()
    return {
        "run": normalize_run(run),
        "codex_session": normalize_codex_session(session) if session else None,
        "artifacts": get_run_artifacts(home, run_id),
    }


def list_run_events(home: Path, run_id: str) -> list[dict[str, Any]]:
    with connect_db(home) as connection:
        if not connection.execute("SELECT 1 FROM runs WHERE id = ?", (run_id,)).fetchone():
            raise ValueError(f"Unknown run: {run_id}")
        rows = connection.execute(
            "SELECT * FROM run_events WHERE run_id = ? ORDER BY created_at ASC",
            (run_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_run_artifacts(home: Path, run_id: str) -> dict[str, Any]:
    run_dir = run_dir_for(home, run_id)
    with connect_db(home) as connection:
        run = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"Unknown run: {run_id}")
        session = connection.execute(
            """
            SELECT * FROM codex_sessions
            WHERE run_id = ? AND prompt_path LIKE '%codex-prompt.md'
            ORDER BY started_at ASC LIMIT 1
            """,
            (run_id,),
        ).fetchone()
        if not session:
            session = connection.execute("SELECT * FROM codex_sessions WHERE run_id = ? ORDER BY started_at ASC LIMIT 1", (run_id,)).fetchone()
    session_item = normalize_codex_session(session) if session else {}
    paths = {
        "prompt": session_item.get("prompt_path") or str(run_dir / "codex-prompt.md"),
        "transcript": session_item.get("transcript_path") or str(run_dir / "codex-transcript.md"),
        "events": session_item.get("events_path") or str(run_dir / "codex-events.jsonl"),
        "final": session_item.get("final_message_path") or str(run_dir / "codex-final.md"),
        "changed_files": str(run_dir / "changed-files.txt"),
        "diff": run["diff_path"] or str(run_dir / "diff.patch"),
        "validation": str(run_dir / "validation.json"),
        "run_log": get_run_log_path(home, run_id),
    }
    return {
        "run_id": run_id,
        "paths": paths,
        "exists": {name: bool(path and Path(path).exists()) for name, path in paths.items()},
        "changed_files": json_loads_field(run["changed_files_json"], []),
    }


def get_run_diff(home: Path, run_id: str) -> dict[str, Any]:
    artifacts = get_run_artifacts(home, run_id)
    path = artifacts["paths"]["diff"]
    return {
        "run_id": run_id,
        "path": path,
        "diff": Path(path).read_text(encoding="utf-8", errors="replace") if path and Path(path).exists() else "",
    }


def get_codex_session(home: Path, session_id: str) -> dict[str, Any]:
    with connect_db(home) as connection:
        row = connection.execute("SELECT * FROM codex_sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            raise ValueError(f"Unknown Codex session: {session_id}")
        return normalize_codex_session(row)


def get_run_codex_session(home: Path, run_id: str) -> dict[str, Any]:
    with connect_db(home) as connection:
        row = connection.execute("SELECT * FROM codex_sessions WHERE run_id = ? ORDER BY started_at DESC LIMIT 1", (run_id,)).fetchone()
        if not row:
            raise ValueError(f"Run has no Codex session: {run_id}")
        return normalize_codex_session(row)


def list_task_codex_sessions(home: Path, project_id_value: str, requirement_id_value: str, task_id_value: str) -> list[dict[str, Any]]:
    key = task_key(project_id_value, requirement_id_value, task_id_value)
    with connect_db(home) as connection:
        rows = connection.execute(
            "SELECT * FROM codex_sessions WHERE task_id = ? ORDER BY started_at DESC",
            (key,),
        ).fetchall()
    return [normalize_codex_session(row) for row in rows]


def read_codex_session_file(home: Path, session_id: str, kind: str) -> dict[str, Any]:
    session = get_codex_session(home, session_id)
    field_name = {"transcript": "transcript_path", "events": "events_path", "final": "final_message_path", "prompt": "prompt_path"}[kind]
    path = session.get(field_name)
    return {
        "session": session,
        "path": path,
        "content": Path(path).read_text(encoding="utf-8", errors="replace") if path and Path(path).exists() else "",
    }


def cancel_run(home: Path, run_id: str, reason: str = "canceled by user") -> dict[str, Any]:
    with connect_db(home) as connection:
        run = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"Unknown run: {run_id}")
        if run["status"] in RUN_TERMINAL_STATES:
            return normalize_run(run)
    append_run_event(home, run_id, "canceled", reason)
    with connect_db(home) as connection:
        task = connection.execute("SELECT * FROM tasks WHERE id = ?", (run["task_id"],)).fetchone()
    if task and task["status"] not in {"accepted", "canceled", "failed"}:
        try:
            update_task_status(home, run["project_id"], run["requirement_id"], task["task_id"], "canceled", reason=reason)
        except Exception:
            pass
    return finish_run(home, run_id, "canceled", reason)


def run_git(project_root: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=project_root,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )


def current_git_sha(project_root: Path) -> str | None:
    result = run_git(project_root, ["rev-parse", "HEAD"])
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def git_ref_sha(project_root: Path, ref: str) -> str | None:
    result = run_git(project_root, ["rev-parse", "--verify", ref])
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def fetch_base_ref(project_root: Path, base_ref: str, require_fetch: bool = True) -> str:
    if require_fetch and "/" in base_ref:
        remote, branch = base_ref.split("/", 1)
        fetch = run_git(project_root, ["fetch", remote, branch])
        if fetch.returncode != 0:
            raise RuntimeError(fetch.stderr.strip() or fetch.stdout.strip() or f"git fetch {remote} {branch} failed")
    base_sha = git_ref_sha(project_root, base_ref)
    if not base_sha:
        raise RuntimeError(f"Unable to resolve worktree base ref: {base_ref}")
    return base_sha


def prepare_worktree(
    project_root: Path,
    worktree_path: Path,
    branch_name: str | None = None,
    base_ref: str = "origin/main",
    require_fetch: bool = True,
) -> dict[str, str | bool]:
    if current_git_sha(project_root) is None:
        worktree_path.mkdir(parents=True, exist_ok=True)
        return {"base_ref": "filesystem", "base_sha": "", "created": False}
    base_sha = fetch_base_ref(project_root, base_ref, require_fetch=require_fetch)
    if worktree_path.exists():
        existing_sha = current_git_sha(worktree_path) or ""
        return {"base_ref": base_ref, "base_sha": existing_sha or base_sha, "created": False}
    branch = branch_name or f"viberig/{worktree_path.name}"
    result = run_git(project_root, ["worktree", "add", "-B", branch, str(worktree_path), base_ref])
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "git worktree add failed")
    return {"base_ref": base_ref, "base_sha": base_sha, "created": True}


def viberig_worktree_changes(worktree_path: Path) -> list[str]:
    if current_git_sha(worktree_path) is None:
        return []
    result = run_git(worktree_path, ["status", "--short", "--", ".vibeRig"])
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def run_dir_for(home: Path, run_id: str) -> Path:
    return home / "runs" / run_id.replace(":", "-")


def run_id_from_log_path(run_log_path: Path) -> str | None:
    name = run_log_path.parent.name
    if name.startswith("run-") and len(name) > 4:
        return "run:" + name.removeprefix("run-")
    return None


def append_run_log(run_log_path: Path, message: str) -> None:
    run_log_path.parent.mkdir(parents=True, exist_ok=True)
    with run_log_path.open("a", encoding="utf-8") as handle:
        handle.write(message)
        if message and not message.endswith("\n"):
            handle.write("\n")
    publish_server_event(
        "run.log",
        {
            "run_id": run_id_from_log_path(run_log_path),
            "path": str(run_log_path),
            "message": message,
        },
    )


def create_run_context(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    run: dict[str, Any] | None = None,
) -> CodexRunContext:
    project, task = get_project_requirement_task(home, project_id_value, requirement_id_value, task_id_value)
    requirement_payload = get_requirement(home, project_id_value, requirement_id_value)
    task_detail = get_task(home, project_id_value, requirement_id_value, task_id_value)
    if run is None:
        run = create_run(home, project_id_value, requirement_id_value, task_id_value)
    run_id = run["id"]
    run_dir = run_dir_for(home, run_id)
    run_log_path = Path(get_run_log_path(home, run_id) or run_dir / "run.log")
    project_root = Path(project["project_root"])
    config = codex_runner_config(project_root)
    return CodexRunContext(
        home=home,
        project=project,
        task=task_detail["task"],
        requirement=requirement_payload["requirement"],
        dependencies=task_detail["dependencies"],
        acceptance_items=task_detail["acceptance_items"],
        source_revisions=requirement_payload["source_revisions"],
        run=run,
        run_dir=run_dir,
        run_log_path=run_log_path,
        worktree_path=Path(run["worktree_path"]),
        base_ref=str(run.get("base_ref") or config.get("base_ref") or "origin/main"),
        source_sha=run.get("base_sha") or run.get("source_sha") or current_git_sha(project_root),
        config=config,
    )


def prepare_task_worktree(context: CodexRunContext) -> None:
    project_root = Path(context.project["project_root"])
    update_run_progress(context.home, context.run["id"], "preflight", "preflight")
    append_run_event(context.home, context.run["id"], "preflight_started", "preparing workspace")
    project_codex_config = project_root / ".codex" / "config.toml"
    if ensure_codex_hooks_config(project_codex_config):
        append_run_event(
            context.home,
            context.run["id"],
            "codex_hooks_configured",
            "enabled Codex hooks in project config",
            {"config_path": str(project_codex_config), "scope": "project"},
        )
    worktree = prepare_worktree(
        project_root,
        context.worktree_path,
        context.task.get("branch"),
        context.base_ref,
        bool(context.config.get("require_fetch_before_worktree", True)),
    )
    if not has_ancestor_codex_hooks_config(context.worktree_path):
        worktree_codex_config = context.worktree_path / ".codex" / "config.toml"
        if ensure_codex_hooks_config(worktree_codex_config):
            append_run_event(
                context.home,
                context.run["id"],
                "codex_hooks_configured",
                "enabled Codex hooks in worktree config",
                {"config_path": str(worktree_codex_config), "scope": "worktree"},
            )
    context.source_sha = str(worktree.get("base_sha") or context.source_sha or "")
    update_run_progress(
        context.home,
        context.run["id"],
        "workspace_ready",
        "workspace_ready",
        base_ref=worktree.get("base_ref"),
        base_sha=worktree.get("base_sha"),
        source_sha=worktree.get("base_sha"),
    )
    append_run_event(
        context.home,
        context.run["id"],
        "workspace_ready",
        "worktree prepared",
        {"worktree_path": str(context.worktree_path), "base_ref": worktree.get("base_ref"), "base_sha": worktree.get("base_sha"), "created": worktree.get("created")},
    )


def render_prompt_section(title: str, body: str) -> str:
    return f"## {title}\n\n{body.strip() or 'None'}\n"


def backend_mcp_server_config() -> dict[str, Any]:
    return {
        "command": sys.executable,
        "args": [str(Path(__file__).resolve()), "mcp"],
    }


def render_mcp_operating_contract(context: CodexRunContext) -> str:
    return "\n".join(
        [
            "The VibeRig backend database is the source of truth for task state, acceptance state, runs, evidence, and review records.",
            "Use the configured `viberig` MCP server for VibeRig reads when it is available. If it is unavailable, report that limitation and rely on the prompt evidence.",
            "Recommended MCP reads before acting:",
            f"- `viberig.tasks.get` with project_id `{context.project['id']}`, requirement_id `{context.task['requirement_id']}`, task_id `{context.task['task_id']}`.",
            f"- `viberig.runs.get` with run_id `{context.run['id']}`.",
            "Allowed MCP writes while working:",
            f"- `viberig.runs.append_event` for stage start, important findings, and stage completion for run_id `{context.run['id']}`.",
            "- `viberig.evidence.record` when you produce durable evidence outside the files already recorded by the runner.",
            "Do not call task status mutation tools. Do not update acceptance status or final review status; return a recommendation and evidence instead.",
            "Do not edit `.vibeRig/` files, SQLite files, or markdown source files to update task state.",
        ]
    )


def build_codex_prompt(context: CodexRunContext) -> str:
    task = context.task
    scope = task.get("scope") or {}
    dependencies = "\n".join(
        f"- {item['task_id']}: {item['title']} [{item['status']}]" for item in context.dependencies
    )
    acceptance = "\n".join(
        f"- {item['acceptance_id']}: {item['title']} [{item['status']}]" for item in context.acceptance_items
    )
    validation_lines = []
    for item in task.get("validation") or []:
        if isinstance(item, str):
            validation_lines.append(f"- shell: `{item}`")
        else:
            validation_lines.append(f"- manual: {json.dumps(item, sort_keys=True)}")
    sources = "\n".join(
        f"- {item['source_name']}: {item['path']} sha256={item.get('sha256') or 'missing'}"
        for item in context.source_revisions
    )
    rules = "\n".join(
        [
            "- Implement only the requested task.",
            "- Make code changes only inside the provided worktree.",
            "- Treat the worktree as code-only execution space; task state is owned by the VibeRig backend database.",
            "- Do not edit any file under `.vibeRig/` in the worktree.",
            f"- Do not edit `.vibeRig/requirements/{context.task['requirement_id']}/tasks.yaml`, `acceptance.md`, or `roadmap.md`.",
            "- Do not edit VibeRig runtime SQLite files or files under ~/.viberig.",
            "- Do not update task status, acceptance status, or evidence by editing project files.",
            "- Do not mark human acceptance or final task acceptance.",
            "- Leave validation execution to the VibeRig runner.",
            "- Do not commit, push, or open a pull request unless explicitly requested by the user.",
            "- Finish with a concise implementation summary and any residual risk.",
        ]
    )
    return "\n".join(
        [
            "# VibeRig Codex Implementation Prompt",
            "",
            render_prompt_section(
                "Project",
                "\n".join(
                    [
                        f"- project_id: {context.project['id']}",
                        f"- project_root: {context.project['project_root']}",
                        f"- worktree_path: {context.worktree_path}",
                        f"- base_ref: {context.base_ref}",
                        f"- base_sha: {context.source_sha or 'unavailable'}",
                    ]
                ),
            ),
            render_prompt_section(
                "Requirement",
                "\n".join(
                    [
                        f"- requirement_id: {context.task['requirement_id']}",
                        f"- title: {context.requirement['title']}",
                    ]
                ),
            ),
            render_prompt_section(
                "Task",
                "\n".join(
                    [
                        f"- task_id: {task['task_id']}",
                        f"- title: {task['title']}",
                        f"- type: {task.get('type') or 'task'}",
                        f"- priority: {task.get('priority')}",
                        f"- suggested_agent: {task.get('suggested_agent') or 'default'}",
                        f"- acceptance_agent: {task.get('acceptance_agent') or 'default'}",
                        f"- review_agent: {task.get('review_agent') or 'default'}",
                    ]
                ),
            ),
            render_prompt_section(
                "Scope",
                "\n".join(
                    [
                        "Include:",
                        *[f"- {item}" for item in scope.get("include", [])],
                        "",
                        "Exclude:",
                        *[f"- {item}" for item in scope.get("exclude", [])],
                    ]
                ),
            ),
            render_prompt_section("Dependencies", dependencies),
            render_prompt_section("Linked Acceptance Criteria", acceptance),
            render_prompt_section("Requirement Source Files", sources),
            render_prompt_section("Validation", "\n".join(validation_lines)),
            render_prompt_section(
                "Expected Evidence",
                "\n".join(
                    [
                        f"- {context.run_dir / 'codex-prompt.md'}",
                        f"- {context.run_dir / 'codex-events.jsonl'}",
                        f"- {context.run_dir / 'codex-final.md'}",
                        f"- {context.run_dir / 'changed-files.txt'}",
                        f"- {context.run_dir / 'diff.patch'}",
                        f"- {context.run_dir / 'validation.json'}",
                        f"- {context.run_log_path}",
                    ]
                ),
            ),
            render_prompt_section("Execution Rules", rules),
            render_prompt_section("VibeRig MCP Contract", render_mcp_operating_contract(context)),
        ]
    ).strip() + "\n"


def tail_text(text: str, max_lines: int = 120) -> str:
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return text
    return "\n".join(lines[-max_lines:])


def build_blocked_resume_prompt(context: CodexRunContext, comment: str | None = None, resume_session_id: str | None = None) -> str:
    run_log = ""
    if context.run_log_path.exists():
        run_log = tail_text(context.run_log_path.read_text(encoding="utf-8", errors="replace"))
    latest_session = get_codex_session(context.home, resume_session_id) if resume_session_id else get_run_codex_session(context.home, context.run["id"])
    final_message = ""
    final_path = latest_session.get("final_message_path")
    if final_path and Path(final_path).exists():
        final_message = tail_text(Path(final_path).read_text(encoding="utf-8", errors="replace"), 80)
    status_reason = context.task.get("status_reason") or context.run.get("error_summary") or context.run.get("summary") or "blocked"
    return "\n".join(
        [
            "# VibeRig Blocked Run Resume Prompt",
            "",
            render_prompt_section(
                "Objective",
                "Continue the blocked implementation session. Analyze the blocker, apply the smallest required fix in the existing worktree, and finish with a concise summary and residual risks.",
            ),
            render_prompt_section(
                "Context",
                "\n".join(
                    [
                        f"- project_id: {context.project['id']}",
                        f"- requirement_id: {context.task['requirement_id']}",
                        f"- task_id: {context.task['task_id']}",
                        f"- run_id: {context.run['id']}",
                        f"- worktree_path: {context.worktree_path}",
                        f"- blocked_reason: {status_reason}",
                        f"- resume_session_id: {latest_session['id']}",
                    ]
                ),
            ),
            render_prompt_section("User Comment", comment or "No additional comment was provided."),
            render_prompt_section("Previous Final Message", final_message or "No final message was recorded."),
            render_prompt_section("Recent Run Log", run_log or "No run log was recorded."),
            render_prompt_section(
                "Resume Rules",
                "\n".join(
                    [
                        "- Continue from the current worktree state; do not restart the task from scratch.",
                        "- Use VibeRig MCP reads to inspect task, run, log, diff, and evidence when available.",
                        "- You may append run events or record new evidence through VibeRig MCP.",
                        "- Do not mutate task status, acceptance status, or final review status.",
                        "- Do not edit `.vibeRig/` files, SQLite files, or markdown source files to update task state.",
                    ]
                ),
            ),
            render_prompt_section("VibeRig MCP Contract", render_mcp_operating_contract(context)),
        ]
    ).strip() + "\n"


def build_resume_preflight_prompt(context: CodexRunContext, comment: str | None = None) -> str:
    run_log = ""
    if context.run_log_path.exists():
        run_log = tail_text(context.run_log_path.read_text(encoding="utf-8", errors="replace"))
    diff = ""
    diff_path = get_run_artifacts(context.home, context.run["id"]).get("paths", {}).get("diff")
    if diff_path and Path(diff_path).exists():
        diff = tail_text(Path(diff_path).read_text(encoding="utf-8", errors="replace"), 160)
    status_reason = context.task.get("status_reason") or context.run.get("error_summary") or context.run.get("summary") or "blocked"
    return "\n".join(
        [
            "# VibeRig Resume Preflight Prompt",
            "",
            render_prompt_section(
                "Objective",
                "Inspect the blocked task before it is resumed. Decide whether the original blocker appears resolved and whether the current worktree shows obvious new breakage.",
            ),
            render_prompt_section(
                "Context",
                "\n".join(
                    [
                        f"- project_id: {context.project['id']}",
                        f"- requirement_id: {context.task['requirement_id']}",
                        f"- task_id: {context.task['task_id']}",
                        f"- run_id: {context.run['id']}",
                        f"- worktree_path: {context.worktree_path}",
                        f"- blocked_reason: {status_reason}",
                    ]
                ),
            ),
            render_prompt_section("User Fix Comment", comment or "No fix comment was provided."),
            render_prompt_section("Recent Run Log", run_log or "No run log was recorded."),
            render_prompt_section("Current Diff", diff or "No diff was recorded."),
            render_prompt_section(
                "Required Output",
                "\n".join(
                    [
                        "Return a concise assessment.",
                        "Include exactly one machine-readable line: `RESUME_READY: yes` or `RESUME_READY: no`.",
                        "Use `RESUME_READY: no` if the blocker is still present, the provided fix is insufficient, required information is still missing, or the worktree appears broken in a way unrelated to the original blocker.",
                        "Do not edit files. Do not mutate task, run, acceptance, evidence, or review status.",
                    ]
                ),
            ),
            render_prompt_section("VibeRig MCP Contract", render_mcp_operating_contract(context)),
        ]
    ).strip() + "\n"


def resume_preflight_allows_resume(result: CodexAdapterResult) -> bool:
    if result.status != "success":
        return False
    final = result.final_message or ""
    match = re.search(r"RESUME_READY\s*:\s*(yes|no|true|false)", final, flags=re.IGNORECASE)
    if not match:
        return True
    return match.group(1).lower() in {"yes", "true"}


def build_test_authoring_prompt(context: CodexRunContext, implementation_result: CodexAdapterResult, diff_artifacts: dict[str, Any]) -> str:
    return "\n".join(
        [
            "# VibeRig Codex Test Authoring Prompt",
            "",
            render_prompt_section(
                "Objective",
                "Add or update focused tests for the completed implementation. Use the task scope and linked acceptance criteria from VibeRig MCP as the source of truth.",
            ),
            render_prompt_section(
                "Context",
                "\n".join(
                    [
                        f"- project_id: {context.project['id']}",
                        f"- requirement_id: {context.task['requirement_id']}",
                        f"- task_id: {context.task['task_id']}",
                        f"- run_id: {context.run['id']}",
                        f"- worktree_path: {context.worktree_path}",
                        f"- implementation_session: {implementation_result.session_id}",
                        f"- implementation_final: {implementation_result.final_message_path}",
                        f"- current_diff: {diff_artifacts.get('diff_path')}",
                    ]
                ),
            ),
            render_prompt_section(
                "Instructions",
                "\n".join(
                    [
                        "- Query VibeRig MCP before writing tests.",
                        "- Write the smallest useful automated tests or test fixtures needed to verify the acceptance criteria.",
                        "- Do not update final task acceptance yourself in this stage.",
                        "- Use `viberig.runs.append_event` to record what tests were added or why no test was appropriate.",
                        "- Finish with a concise summary of test coverage and residual gaps.",
                    ]
                ),
            ),
            render_prompt_section("VibeRig MCP Contract", render_mcp_operating_contract(context)),
        ]
    ).strip() + "\n"


def build_acceptance_review_prompt(
    context: CodexRunContext,
    implementation_result: CodexAdapterResult,
    test_result: CodexAdapterResult | None,
    validation_results: list[dict[str, Any]],
    evidence_paths: dict[str, Path],
    diff_artifacts: dict[str, Any],
) -> str:
    reviewer = context.task.get("review_agent") or context.task.get("acceptance_agent") or "codex-acceptance-review"
    return "\n".join(
        [
            "# VibeRig Codex Acceptance Review Prompt",
            "",
            render_prompt_section(
                "Objective",
                "Review the implementation against the linked acceptance criteria and recorded evidence. This stage produces an AI review recommendation; human review remains the only path to final task acceptance.",
            ),
            render_prompt_section(
                "Context",
                "\n".join(
                    [
                        f"- project_id: {context.project['id']}",
                        f"- requirement_id: {context.task['requirement_id']}",
                        f"- task_id: {context.task['task_id']}",
                        f"- run_id: {context.run['id']}",
                        f"- worktree_path: {context.worktree_path}",
                        f"- acceptance_agent: {context.task.get('acceptance_agent') or 'default'}",
                        f"- review_agent: {reviewer}",
                        f"- implementation_session: {implementation_result.session_id}",
                        f"- test_session: {test_result.session_id if test_result else 'none'}",
                        f"- diff: {diff_artifacts.get('diff_path')}",
                        f"- validation: {evidence_paths.get('validation')}",
                        f"- self_acceptance: {evidence_paths.get('self_acceptance')}",
                    ]
                ),
            ),
            render_prompt_section(
                "Validation Results",
                json.dumps(validation_results, indent=2, sort_keys=True),
            ),
            render_prompt_section(
                "Required Review Actions",
                "\n".join(
                    [
                        "- Query `viberig.tasks.get`, `viberig.runs.get`, `viberig.runs.diff`, and `viberig.evidence.list` before deciding when those tools are available.",
                        "- Do not mutate task status, acceptance status, or final review state.",
                        f"- Return your AI recommendation as reviewer `{reviewer}` in the final response.",
                        "- If VibeRig tools are unavailable, do not block solely on that; rely on the prompt evidence and state the limitation.",
                        "- Recommend accepted only when implementation, tests, validation output, and all non-waived acceptance criteria pass.",
                        "- Recommend rework when any acceptance criterion fails, evidence is insufficient, validation failed, or the implementation is materially incomplete.",
                        "- Include evidence paths and residual risks in the final response.",
                        "- Do not mark final task acceptance, and do not edit files to change task state.",
                    ]
                ),
            ),
            render_prompt_section("VibeRig MCP Contract", render_mcp_operating_contract(context)),
        ]
    ).strip() + "\n"


def write_codex_prompt(context: CodexRunContext) -> Path:
    prompt_path = context.run_dir / "codex-prompt.md"
    prompt_path.write_text(build_codex_prompt(context), encoding="utf-8")
    append_run_event(context.home, context.run["id"], "prompt_written", "codex prompt persisted", {"prompt_path": str(prompt_path)})
    return prompt_path


def write_codex_stage_prompt(context: CodexRunContext, stage: str, prompt: str) -> Path:
    prompt_path = context.run_dir / f"codex-{stage}-prompt.md"
    prompt_path.write_text(prompt, encoding="utf-8")
    append_run_event(
        context.home,
        context.run["id"],
        f"{stage}_prompt_written",
        f"{stage} prompt persisted",
        {"prompt_path": str(prompt_path), "stage": stage},
    )
    return prompt_path


def create_codex_session_record(
    context: CodexRunContext,
    adapter: str,
    prompt_path: Path,
    events_path: Path,
    transcript_path: Path,
    final_message_path: Path,
) -> dict[str, Any]:
    now = utc_now()
    session_id = new_record_id("codex-session", context.run["id"], adapter)
    with connect_db(context.home) as connection:
        connection.execute(
            """
            INSERT INTO codex_sessions
              (id, project_id, requirement_id, task_id, run_id, adapter, status, started_at,
               prompt_path, transcript_path, events_path, final_message_path)
            VALUES (?, ?, ?, ?, ?, ?, 'starting', ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                context.project["id"],
                context.task["requirement_id"],
                context.task["id"],
                context.run["id"],
                adapter,
                now,
                str(prompt_path),
                str(transcript_path),
                str(events_path),
                str(final_message_path),
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM codex_sessions WHERE id = ?", (session_id,)).fetchone()
    update_run_progress(
        context.home,
        context.run["id"],
        "codex_starting",
        "codex_starting",
        codex_adapter=adapter,
        codex_session_id=session_id,
    )
    append_run_event(
        context.home,
        context.run["id"],
        "codex_session_created",
        "codex session record created",
        {"codex_session_id": session_id, "adapter": adapter, "prompt_path": str(prompt_path)},
    )
    return normalize_codex_session(row)


def reopen_codex_session_record(context: CodexRunContext, session_id: str, prompt_path: Path, stage: str) -> dict[str, Any]:
    now = utc_now()
    with connect_db(context.home) as connection:
        row = connection.execute("SELECT * FROM codex_sessions WHERE id = ? AND run_id = ?", (session_id, context.run["id"])).fetchone()
        if not row:
            raise ValueError(f"Run {context.run['id']} has no Codex session {session_id}")
        connection.execute(
            """
            UPDATE codex_sessions
            SET status = 'starting', finished_at = NULL, prompt_path = ?, error_summary = NULL
            WHERE id = ?
            """,
            (str(prompt_path), session_id),
        )
        connection.commit()
        updated = connection.execute("SELECT * FROM codex_sessions WHERE id = ?", (session_id,)).fetchone()
    update_run_progress(
        context.home,
        context.run["id"],
        "codex_resuming",
        "codex_resuming",
        codex_adapter=row["adapter"],
        codex_session_id=session_id,
    )
    append_run_event(
        context.home,
        context.run["id"],
        "codex_session_resumed",
        "codex session resume turn started",
        {"codex_session_id": session_id, "adapter": row["adapter"], "prompt_path": str(prompt_path), "stage": stage, "resumed_at": now},
    )
    return normalize_codex_session(updated)


def update_codex_session_record(home: Path, result: CodexAdapterResult) -> dict[str, Any]:
    now = utc_now()
    with connect_db(home) as connection:
        connection.execute(
            """
            UPDATE codex_sessions
            SET native_session_id = ?, thread_id = ?, conversation_id = ?, turn_ids_json = ?,
                status = ?, finished_at = ?, transcript_path = COALESCE(?, transcript_path),
                events_path = COALESCE(?, events_path), final_message_path = COALESCE(?, final_message_path),
                usage_json = ?, error_summary = ?
            WHERE id = ?
            """,
            (
                result.session_id,
                result.thread_id,
                result.conversation_id,
                json.dumps(result.turn_ids, sort_keys=True),
                result.status,
                now,
                result.transcript_path,
                result.events_path,
                result.final_message_path,
                json.dumps(result.usage, sort_keys=True),
                result.error,
                result.session_id,
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM codex_sessions WHERE id = ?", (result.session_id,)).fetchone()
        if not row:
            raise ValueError(f"Unknown Codex session: {result.session_id}")
        return normalize_codex_session(row)


def update_codex_session_metadata(home: Path, session_id: str, metadata: dict[str, Any], status: str = "running") -> None:
    with connect_db(home) as connection:
        connection.execute(
            """
            UPDATE codex_sessions
            SET thread_id = COALESCE(?, thread_id),
                conversation_id = COALESCE(?, conversation_id),
                turn_ids_json = ?,
                usage_json = ?,
                status = ?
            WHERE id = ?
            """,
            (
                metadata.get("thread_id"),
                metadata.get("conversation_id") or metadata.get("session_id"),
                json.dumps(metadata.get("turn_ids") or [], sort_keys=True),
                json.dumps(metadata.get("usage") or {}, sort_keys=True),
                status,
                session_id,
            ),
        )
        connection.commit()


def parse_codex_jsonl(text: str) -> dict[str, Any]:
    metadata: dict[str, Any] = {"turn_ids": [], "usage": {}, "final_message": "", "events": []}
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        metadata["events"].append(event)
        for key in ("session_id", "thread_id", "conversation_id"):
            if event.get(key):
                metadata[key] = event[key]
        if event.get("turn_id"):
            metadata["turn_ids"].append(event["turn_id"])
        if isinstance(event.get("usage"), dict):
            metadata["usage"] = event["usage"]
        if event.get("final_message"):
            metadata["final_message"] = str(event["final_message"])
        elif event.get("message") and event.get("type") in {"final", "assistant_final", "turn.completed"}:
            metadata["final_message"] = str(event["message"])
    return metadata


def codex_artifact_paths(context: CodexRunContext, stage: str) -> tuple[Path, Path, Path]:
    if stage == "implementation":
        return (
            context.run_dir / "codex-events.jsonl",
            context.run_dir / "codex-transcript.md",
            context.run_dir / "codex-final.md",
        )
    return (
        context.run_dir / f"codex-{stage}-events.jsonl",
        context.run_dir / f"codex-{stage}-transcript.md",
        context.run_dir / f"codex-{stage}-final.md",
    )


def fake_codex_adapter(context: CodexRunContext, session_id: str, prompt_path: Path, stage: str = "implementation") -> CodexAdapterResult:
    events_path, transcript_path, final_path = codex_artifact_paths(context, stage)
    status = os.environ.get("VIBERIG_FAKE_CODEX_STATUS", "success")
    now = utc_now()
    events = [
        {"type": "session.started", "created_at": now, "session_id": session_id, "cwd": str(context.worktree_path)},
    ]
    if status == "input_required":
        events.append({"type": "input_required", "created_at": utc_now(), "message": "fake adapter requested input"})
        final = "Fake Codex adapter blocked: input required.\n"
        exit_code = 2
        error = "input required"
    elif status in {"failed", "timeout"}:
        events.append({"type": status, "created_at": utc_now(), "message": f"fake adapter {status}"})
        final = f"Fake Codex adapter {status}.\n"
        exit_code = 1
        error = f"fake adapter {status}"
    else:
        target = os.environ.get("VIBERIG_FAKE_CODEX_WRITE_FILE")
        if target:
            path = context.worktree_path / target
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"Implemented by fake Codex session {session_id}\n", encoding="utf-8")
        final = f"Fake Codex {stage} completed.\n"
        if stage == "resume_preflight":
            final += f"RESUME_READY: {os.environ.get('VIBERIG_FAKE_RESUME_PREFLIGHT_READY', 'yes')}\n"
        events.append({"type": "codex.completed", "created_at": utc_now(), "stage": stage, "final_message": final.strip()})
        exit_code = 0
        error = None
    events_path.write_text("".join(json.dumps(event, sort_keys=True) + "\n" for event in events), encoding="utf-8")
    transcript_path.write_text(f"# Codex Transcript\n\nPrompt: `{prompt_path}`\n\n{final}", encoding="utf-8")
    final_path.write_text(final, encoding="utf-8")
    append_run_log(context.run_log_path, f"fake codex adapter stage={stage} status={status} session={session_id}")
    result_status = "blocked" if status == "input_required" else ("success" if exit_code == 0 else "failed")
    return CodexAdapterResult(
        adapter="fake",
        session_id=session_id,
        status=result_status,
        exit_code=exit_code,
        transcript_path=str(transcript_path),
        events_path=str(events_path),
        final_message_path=str(final_path),
        final_message=final,
        error=error,
        last_event_at=events[-1]["created_at"],
    )


def jsonrpc_line(handle: Any, payload: dict[str, Any]) -> None:
    handle.write(json.dumps(payload, sort_keys=True) + "\n")
    handle.flush()


def read_jsonrpc_line(handle: Any, timeout_seconds: float | None = None) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds if timeout_seconds is not None else None
    fd = handle.fileno()
    line = bytearray()
    while deadline is None or time.time() < deadline:
        remaining = None if deadline is None else deadline - time.time()
        readable, _, _ = select.select([fd], [], [], remaining)
        if not readable:
            break
        chunk = os.read(fd, 1)
        if not chunk:
            if line:
                break
            raise EOFError("JSON-RPC stream closed before response")
        line.extend(chunk)
        if chunk == b"\n":
            return json.loads(bytes(line).decode("utf-8"))
    raise TimeoutError("timed out waiting for JSON-RPC response")


def read_jsonrpc_response(handle: Any, response_id: int, timeout_seconds: float) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    deadline = time.time() + timeout_seconds
    messages: list[dict[str, Any]] = []
    while time.time() < deadline:
        message = read_jsonrpc_line(handle, max(0.1, deadline - time.time()))
        messages.append(message)
        if message.get("id") == response_id:
            return messages, message
    raise TimeoutError(f"timed out waiting for JSON-RPC response id {response_id}")


def read_jsonrpc_response_unbounded(handle: Any, response_id: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    while True:
        message = read_jsonrpc_line(handle, None)
        messages.append(message)
        if message.get("id") == response_id:
            return messages, message


def mcp_stdio_write(handle: Any, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, sort_keys=True).encode("utf-8")
    handle.write(f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body)
    handle.flush()


def mcp_stdio_read(handle: Any, timeout_seconds: float | None) -> dict[str, Any]:
    deadline = None if timeout_seconds is None else time.time() + timeout_seconds
    fd = handle.fileno()
    header = bytearray()
    while b"\r\n\r\n" not in header:
        remaining = None if deadline is None else deadline - time.time()
        if remaining is not None and remaining <= 0:
            raise TimeoutError("timed out waiting for MCP response headers")
        readable, _, _ = select.select([fd], [], [], remaining)
        if not readable:
            raise TimeoutError("timed out waiting for MCP response headers")
        chunk = os.read(fd, 1)
        if not chunk:
            raise EOFError("MCP server closed stdout before response headers")
        header.extend(chunk)
    header_text = bytes(header).decode("ascii", errors="replace")
    content_length = None
    for line in header_text.split("\r\n"):
        if line.lower().startswith("content-length:"):
            content_length = int(line.split(":", 1)[1].strip())
            break
    if content_length is None:
        raise ValueError("MCP response missing Content-Length header")
    body = bytearray()
    while len(body) < content_length:
        remaining = None if deadline is None else deadline - time.time()
        if remaining is not None and remaining <= 0:
            raise TimeoutError("timed out waiting for MCP response body")
        readable, _, _ = select.select([fd], [], [], remaining)
        if not readable:
            raise TimeoutError("timed out waiting for MCP response body")
        chunk = os.read(fd, content_length - len(body))
        if not chunk:
            raise EOFError("MCP server closed stdout before response body")
        body.extend(chunk)
    return json.loads(bytes(body).decode("utf-8"))


def read_mcp_stdio_response(handle: Any, response_id: int, timeout_seconds: float) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    deadline = time.time() + timeout_seconds
    messages: list[dict[str, Any]] = []
    while time.time() < deadline:
        message = mcp_stdio_read(handle, max(0.1, deadline - time.time()))
        messages.append(message)
        if message.get("id") == response_id:
            return messages, message
    raise TimeoutError(f"timed out waiting for MCP response id {response_id}")


def read_mcp_stdio_response_unbounded(handle: Any, response_id: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    while True:
        message = mcp_stdio_read(handle, None)
        messages.append(message)
        if message.get("id") == response_id:
            return messages, message


def resolve_mcp_command(command_text: str) -> tuple[list[str], str | None]:
    return shlex.split(command_text), "codex mcp command using configured command"


def codex_mcp_session_id(session_id: str) -> str:
    safe_id = re.sub(r"[^A-Za-z0-9_-]+", "-", session_id).strip("-")
    if not safe_id:
        safe_id = "viberig-session"
    return safe_id[:256]


def codex_mcp_arguments(context: CodexRunContext, session_id: str, prompt: str) -> dict[str, Any]:
    arguments: dict[str, Any] = {
        "prompt": prompt,
        "sessionId": codex_mcp_session_id(session_id),
        "workingDirectory": str(context.worktree_path),
        "sandbox": context.config.get("sandbox") or "workspace-write",
    }
    if context.config.get("full_auto"):
        arguments["fullAuto"] = True
    optional_keys = [("model", "model"), ("reasoningEffort", "reasoning_effort"), ("callbackUri", "callback_uri")]
    for wire_key, config_key in optional_keys:
        if context.config.get(config_key):
            arguments[wire_key] = context.config[config_key]
    return arguments


def extract_codex_mcp_result(response: dict[str, Any]) -> tuple[str | None, str | None, dict[str, Any], str]:
    result_payload = response.get("result") if isinstance(response.get("result"), dict) else {}
    structured = result_payload.get("structuredContent") if isinstance(result_payload.get("structuredContent"), dict) else {}
    thread_id = structured.get("threadId") or structured.get("thread_id") or result_payload.get("threadId") or result_payload.get("thread_id")
    conversation_id = structured.get("conversationId") or structured.get("conversation_id")
    content = structured.get("content")
    content_items = result_payload.get("content") if isinstance(result_payload.get("content"), list) else []
    for item in content_items:
        if not isinstance(item, dict):
            continue
        meta = item.get("_meta") if isinstance(item.get("_meta"), dict) else {}
        thread_id = thread_id or meta.get("threadId") or meta.get("thread_id")
        conversation_id = conversation_id or meta.get("conversationId") or meta.get("conversation_id")
    if content is None:
        text_parts = [str(item.get("text")) for item in content_items if isinstance(item, dict) and item.get("type") == "text" and item.get("text")]
        content = "\n".join(text_parts)
    if content is None:
        content = json.dumps(result_payload or response, indent=2, sort_keys=True)
    if not thread_id:
        match = re.search(r"thread\s*id\s*:\s*([A-Za-z0-9_-]+)", str(content), flags=re.IGNORECASE)
        if match:
            thread_id = match.group(1)
    if not conversation_id:
        match = re.search(r"(?:conversation|session)\s*id\s*:\s*([A-Za-z0-9_-]+)", str(content), flags=re.IGNORECASE)
        if match:
            conversation_id = match.group(1)
    return (
        str(thread_id) if thread_id else None,
        str(conversation_id) if conversation_id else None,
        structured,
        str(content),
    )


def extract_codex_event_thread_id(events: list[dict[str, Any]]) -> str | None:
    for event in events:
        if event.get("method") != "codex/event":
            continue
        params = event.get("params") if isinstance(event.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
        message = params.get("msg") if isinstance(params.get("msg"), dict) else {}
        thread_id = meta.get("threadId") or meta.get("thread_id") or message.get("thread_id") or message.get("session_id")
        if thread_id:
            return str(thread_id)
    return None


def mcp_codex_adapter(context: CodexRunContext, session_id: str, prompt_path: Path, stage: str = "implementation") -> CodexAdapterResult:
    command_text = context.config.get("mcp_command")
    if not command_text:
        raise RuntimeError("runner.codex.mcp_command or VIBERIG_CODEX_MCP_COMMAND is required for MCP adapter")
    events_path, transcript_path, final_path = codex_artifact_paths(context, stage)
    prompt = prompt_path.read_text(encoding="utf-8")
    cmd, command_note = resolve_mcp_command(str(command_text))
    append_run_log(context.run_log_path, f"codex mcp invocation stage={stage}: " + " ".join(shlex.quote(part) for part in cmd))
    if context.config.get("enable_features"):
        append_run_log(
            context.run_log_path,
            "codex feature intent stage={}: {}".format(
                stage,
                " ".join(f"--enable {shlex.quote(str(feature))}" for feature in context.config["enable_features"]),
            ),
        )
    if command_note:
        append_run_log(context.run_log_path, command_note)
    env = os.environ.copy()
    env["STRUCTURED_CONTENT_ENABLED"] = env.get("STRUCTURED_CONTENT_ENABLED", "true")
    for key, value in dict(context.config.get("mcp_env") or {}).items():
        env[str(key)] = str(value)
    process = subprocess.Popen(
        cmd,
        cwd=context.worktree_path,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )
    assert process.stdin and process.stdout
    events: list[dict[str, Any]] = []
    response: dict[str, Any] | None = None
    adapter_error: Exception | None = None
    stderr = ""
    try:
        jsonrpc_line(
            process.stdin,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "viberig", "version": "0.1.0"},
                },
            },
        )
        initialize_timeout = max(1, int(context.config.get("mcp_initialize_timeout_ms") or 60000) / 1000)
        initialize_events, _ = read_jsonrpc_response(process.stdout, 1, initialize_timeout)
        events.extend(initialize_events)
        jsonrpc_line(process.stdin, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})
        jsonrpc_line(
            process.stdin,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": context.config.get("mcp_tool") or "codex",
                    "arguments": codex_mcp_arguments(context, session_id, prompt),
                },
            },
        )
        append_run_log(context.run_log_path, f"codex mcp waiting for response stage={stage}")
        tool_timeout = max(1, int(context.config.get("mcp_tool_timeout_ms") or 600000) / 1000)
        tool_events, response = read_jsonrpc_response(process.stdout, 2, tool_timeout)
        events.extend(tool_events)
    except Exception as exc:
        adapter_error = exc
    finally:
        process.terminate()
        try:
            _, stderr_bytes = process.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            _, stderr_bytes = process.communicate()
    stderr_text = stderr_bytes if isinstance(stderr_bytes, str) else bytes(stderr_bytes or b"").decode("utf-8", errors="replace")
    events_path.write_text("".join(json.dumps(event, sort_keys=True) + "\n" for event in events), encoding="utf-8")
    response = response or (events[-1] if events else {"error": str(adapter_error or "missing Codex MCP response")})
    error = response.get("error")
    result_payload = response.get("result") if isinstance(response.get("result"), dict) else {}
    if result_payload.get("isError") and not error:
        error = result_payload.get("content") or "Codex MCP tool returned isError=true"
    thread_id, conversation_id, structured, final = extract_codex_mcp_result(response)
    thread_id = thread_id or extract_codex_event_thread_id(events)
    if adapter_error:
        stderr_hint = f"\n\nstderr:\n{stderr_text.strip()}" if stderr_text.strip() else ""
        error = error or f"{adapter_error}{stderr_hint}"
        final = f"{adapter_error}{stderr_hint}\n\nLast received event:\n\n{json.dumps(events[-1], indent=2, sort_keys=True) if events else '(none)'}"
    transcript_path.write_text(final + ("\n\n## stderr\n\n" + stderr_text if stderr_text else ""), encoding="utf-8")
    final_path.write_text(final + "\n", encoding="utf-8")
    if adapter_error:
        if stderr_text:
            append_run_log(context.run_log_path, stderr_text)
        append_run_log(context.run_log_path, f"mcp adapter failed stage={stage}: {adapter_error}")
    else:
        append_run_log(context.run_log_path, stderr_text or "mcp adapter completed")
    return CodexAdapterResult(
        adapter="codex-cli-mcp",
        session_id=session_id,
        status="failed" if error else "success",
        exit_code=0 if not error else 1,
        thread_id=thread_id,
        conversation_id=conversation_id,
        usage=dict(structured.get("usage") or {}) if isinstance(structured.get("usage"), dict) else {},
        transcript_path=str(transcript_path),
        events_path=str(events_path),
        final_message_path=str(final_path),
        final_message=final,
        error=json.dumps(error, sort_keys=True) if isinstance(error, dict) else (str(error) if error else None),
    )


def appserver_codex_adapter(context: CodexRunContext, session_id: str, prompt_path: Path) -> CodexAdapterResult:
    command_text = context.config.get("appserver_command")
    if not command_text:
        raise RuntimeError("runner.codex.appserver_command or VIBERIG_CODEX_APPSERVER_COMMAND is required for AppServer adapter")
    events_path = context.run_dir / "codex-events.jsonl"
    transcript_path = context.run_dir / "codex-transcript.md"
    final_path = context.run_dir / "codex-final.md"
    cmd = shlex.split(str(command_text))
    prompt = prompt_path.read_text(encoding="utf-8")
    append_run_log(context.run_log_path, "codex appserver invocation: " + " ".join(shlex.quote(part) for part in cmd))
    process = subprocess.Popen(
        cmd,
        cwd=context.worktree_path,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert process.stdin and process.stdout
    events: list[dict[str, Any]] = []
    thread_id = None
    turn_ids: list[str] = []
    try:
        jsonrpc_line(process.stdin, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        events.append(read_jsonrpc_line(process.stdout, 5))
        jsonrpc_line(process.stdin, {"jsonrpc": "2.0", "method": "initialized", "params": {}})
        jsonrpc_line(
            process.stdin,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "thread/start",
                "params": {
                    "cwd": str(context.worktree_path),
                    "sandbox": context.config.get("sandbox"),
                    "approval_policy": context.config.get("approval_policy"),
                    "model": context.config.get("model"),
                },
            },
        )
        thread_response = read_jsonrpc_line(process.stdout, 5)
        events.append(thread_response)
        thread_result = thread_response.get("result") if isinstance(thread_response.get("result"), dict) else {}
        thread_id = thread_result.get("thread_id") or thread_result.get("threadId") or session_id
        jsonrpc_line(
            process.stdin,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "turn/start",
                "params": {"thread_id": thread_id, "prompt": prompt},
            },
        )
        turn_response = read_jsonrpc_line(process.stdout, max(1, int(context.config.get("turn_timeout_ms") or 600000) / 1000))
        events.append(turn_response)
        turn_result = turn_response.get("result") if isinstance(turn_response.get("result"), dict) else {}
        if turn_result.get("turn_id") or turn_result.get("turnId"):
            turn_ids.append(turn_result.get("turn_id") or turn_result.get("turnId"))
    finally:
        process.terminate()
        try:
            _, stderr = process.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            _, stderr = process.communicate()
    events_path.write_text("".join(json.dumps(event, sort_keys=True) + "\n" for event in events), encoding="utf-8")
    final = json.dumps(events[-1].get("result", events[-1]), indent=2, sort_keys=True)
    transcript_path.write_text(final + ("\n\n## stderr\n\n" + stderr if stderr else ""), encoding="utf-8")
    final_path.write_text(final + "\n", encoding="utf-8")
    append_run_log(context.run_log_path, stderr or "appserver adapter completed")
    error = events[-1].get("error")
    return CodexAdapterResult(
        adapter="appserver",
        session_id=session_id,
        status="failed" if error else "success",
        exit_code=0 if not error else 1,
        thread_id=thread_id,
        turn_ids=turn_ids,
        transcript_path=str(transcript_path),
        events_path=str(events_path),
        final_message_path=str(final_path),
        final_message=final,
        error=json.dumps(error, sort_keys=True) if error else None,
    )


def run_codex_stage(
    context: CodexRunContext,
    prompt_path: Path,
    stage: str,
    status_label: str,
    resume_session_id: str | None = None,
) -> CodexAdapterResult:
    adapter = str(context.config.get("adapter") or "fake")
    if adapter == "cli":
        raise ValueError("Codex CLI adapter is disabled for real VibeRig task runs; use runner.codex.adapter: codex-cli-mcp.")
    if adapter == "appserver":
        raise ValueError("Codex appserver adapter is disabled for real VibeRig task runs; use runner.codex.adapter: codex-cli-mcp.")
    effective_adapter = "codex-cli-mcp" if adapter == "mcp" else adapter
    events_path, transcript_path, final_path = codex_artifact_paths(context, stage)
    if resume_session_id:
        session = reopen_codex_session_record(context, resume_session_id, prompt_path, stage)
        effective_adapter = session.get("adapter") or effective_adapter
    else:
        session = create_codex_session_record(context, effective_adapter, prompt_path, events_path, transcript_path, final_path)
    session_id = session["id"]
    update_run_progress(context.home, context.run["id"], status_label, status_label)
    append_run_event(
        context.home,
        context.run["id"],
        f"{stage}_started",
        f"{stage} Codex stage started",
        {"adapter": effective_adapter, "codex_session_id": session_id, "stage": stage},
    )
    if effective_adapter == "fake":
        result = fake_codex_adapter(context, session_id, prompt_path, stage)
    elif effective_adapter == "codex-cli-mcp":
        result = mcp_codex_adapter(context, session_id, prompt_path, stage)
    else:
        raise ValueError(f"Unknown Codex adapter: {adapter}")
    update_codex_session_record(context.home, result)
    if stage == "implementation":
        implementation_status = "codex_completed" if result.status == "success" else "codex_failed"
    else:
        implementation_status = f"{stage}_completed" if result.status == "success" else f"{stage}_failed"
    update_run_progress(
        context.home,
        context.run["id"],
        implementation_status,
        implementation_status,
        codex_adapter=result.adapter,
        codex_session_id=result.session_id,
        codex_thread_id=result.thread_id,
        codex_conversation_id=result.conversation_id,
        codex_exit_code=result.exit_code,
        codex_usage_json=result.usage,
        error_summary=result.error,
    )
    append_run_event(
        context.home,
        context.run["id"],
        implementation_status,
        result.error or result.final_message or result.status,
        {
            "adapter": result.adapter,
            "codex_session_id": result.session_id,
            "exit_code": result.exit_code,
            "events_path": result.events_path,
            "final_message_path": result.final_message_path,
            "last_event_at": result.last_event_at,
            "stage": stage,
        },
    )
    return result


def run_codex_implementation(context: CodexRunContext, prompt_path: Path) -> CodexAdapterResult:
    return run_codex_stage(context, prompt_path, "implementation", "development")


def collect_git_diff(context: CodexRunContext) -> dict[str, Any]:
    changed_files_path = context.run_dir / "changed-files.txt"
    diff_path = context.run_dir / "diff.patch"
    changed_files: list[str] = []
    diff_text = ""
    if current_git_sha(context.worktree_path) is not None:
        status = run_git(context.worktree_path, ["status", "--short"])
        changed_files = [
            line[3:].strip()
            for line in status.stdout.splitlines()
            if len(line) > 3 and line[3:].strip()
        ]
        diff = run_git(context.worktree_path, ["diff", "--binary", "HEAD"])
        diff_text = diff.stdout
    changed_files_path.write_text("\n".join(changed_files) + ("\n" if changed_files else ""), encoding="utf-8")
    diff_path.write_text(diff_text, encoding="utf-8")
    update_run_progress(
        context.home,
        context.run["id"],
        "codex_completed",
        changed_files_json=changed_files,
        diff_path=str(diff_path),
    )
    append_run_event(
        context.home,
        context.run["id"],
        "diff_collected",
        "changed files and diff captured",
        {"changed_files": changed_files, "changed_files_path": str(changed_files_path), "diff_path": str(diff_path)},
    )
    return {"changed_files": changed_files, "changed_files_path": changed_files_path, "diff_path": diff_path}


def run_validation(context: CodexRunContext) -> list[dict[str, Any]]:
    update_run_progress(context.home, context.run["id"], "validating", "validating")
    validation_results: list[dict[str, Any]] = []
    for command in context.task.get("validation") or []:
        if not isinstance(command, str):
            manual_message = "; ".join(f"{key}: {value}" for key, value in command.items()) if isinstance(command, dict) else str(command)
            validation_results.append(
                {
                    "command": manual_message,
                    "exit_code": None,
                    "duration_ms": 0,
                    "manual": True,
                }
            )
            append_run_event(context.home, context.run["id"], "manual_validation_required", manual_message)
            append_run_log(context.run_log_path, f"manual validation required: {manual_message}")
            continue
        append_run_event(context.home, context.run["id"], "validation_started", command)
        started = time.time()
        completed = subprocess.run(
            command,
            cwd=context.worktree_path if context.worktree_path.exists() else Path(context.project["project_root"]),
            shell=True,
            check=False,
            capture_output=True,
            text=True,
            timeout=600,
        )
        duration_ms = int((time.time() - started) * 1000)
        append_run_log(context.run_log_path, completed.stdout)
        append_run_log(context.run_log_path, completed.stderr)
        validation_results.append(
            {
                "command": command,
                "exit_code": completed.returncode,
                "duration_ms": duration_ms,
            }
        )
        append_run_event(
            context.home,
            context.run["id"],
            "validation_finished",
            command,
            {"exit_code": completed.returncode, "duration_ms": duration_ms},
        )
    (context.run_dir / "validation.json").write_text(json.dumps(validation_results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return validation_results


def write_self_acceptance_evidence(
    project_root: Path,
    requirement_id_value: str,
    task_id_value: str,
    validation_results: list[dict[str, Any]],
    run_log_path: Path,
    run_id: str | None = None,
    codex_result: CodexAdapterResult | None = None,
    run_artifacts: dict[str, Any] | None = None,
) -> dict[str, Path]:
    evidence_dir = project_root / ".vibeRig" / "requirements" / requirement_id_value / "evidence" / task_id_value
    evidence_dir.mkdir(parents=True, exist_ok=True)
    validation_path = evidence_dir / "validation.json"
    self_acceptance_path = evidence_dir / "self-acceptance.md"
    run_copy_path = evidence_dir / "run.log"
    changed_files_path = evidence_dir / "changed-files.txt"
    validation_path.write_text(json.dumps(validation_results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    run_copy_path.write_text(run_log_path.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    artifact_changed_files = (run_artifacts or {}).get("changed_files_path")
    if artifact_changed_files and Path(artifact_changed_files).exists():
        changed_files_path.write_text(Path(artifact_changed_files).read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    else:
        changed_files_path.write_text("", encoding="utf-8")
    rows = "\n".join(
        f"| {item['command']} | {'MANUAL' if item.get('manual') else 'PASS' if item['exit_code'] == 0 else 'FAIL'} | `{validation_path}` |"
        for item in validation_results
    )
    self_acceptance_path.write_text(
        "# Self Acceptance: {task_id}\n\n"
        "## Acceptance Matrix\n\n"
        "| Acceptance | Result | Evidence |\n"
        "| --- | --- | --- |\n"
        "{rows}\n\n"
        "## Commands Run\n\n"
        "{commands}\n\n"
        "## Codex Session\n\n"
        "- Run: `{run_id}`\n"
        "- Session: `{session_id}`\n"
        "- Adapter: `{adapter}`\n"
        "- Prompt: `{prompt}`\n"
        "- Transcript: `{transcript}`\n"
        "- Events: `{events}`\n"
        "- Final: `{final}`\n"
        "- Changed files: `{changed_files}`\n"
        "- Diff: `{diff}`\n"
        "- Validation: `{validation}`\n"
        "- Run log: `{run_log}`\n\n"
        "## Residual Risk\n\n"
        "Codex acceptance review is still required before final task acceptance.\n".format(
            task_id=task_id_value,
            rows=rows or "| Validation | NOT RUN |  |",
            commands="\n".join(f"- {item['command']}" for item in validation_results) or "- none",
            run_id=run_id or "",
            session_id=codex_result.session_id if codex_result else "",
            adapter=codex_result.adapter if codex_result else "",
            prompt=(run_artifacts or {}).get("prompt_path") or "",
            transcript=codex_result.transcript_path if codex_result else "",
            events=codex_result.events_path if codex_result else "",
            final=codex_result.final_message_path if codex_result else "",
            changed_files=changed_files_path,
            diff=(run_artifacts or {}).get("diff_path") or "",
            validation=validation_path,
            run_log=run_copy_path,
        ),
        encoding="utf-8",
    )
    return {
        "validation": validation_path,
        "self_acceptance": self_acceptance_path,
        "run_log": run_copy_path,
        "changed_files": changed_files_path,
    }


def execute_run_context(
    context: CodexRunContext,
    mark_running: bool = True,
    resume_session_id: str | None = None,
    resume_comment: str | None = None,
) -> dict[str, Any]:
    project_root = Path(context.project["project_root"])
    run_id = context.run["id"]
    project_id_value = context.project["id"]
    requirement_id_value = context.requirement["requirement_id"]
    task_id_value = context.task["task_id"]
    home = context.home
    if mark_running:
        update_task_status(home, project_id_value, requirement_id_value, task_id_value, "running")
    append_run_event(home, run_id, "started", "runner started")
    codex_result: CodexAdapterResult | None = None
    resume_preflight_result: CodexAdapterResult | None = None
    test_result: CodexAdapterResult | None = None
    acceptance_result: CodexAdapterResult | None = None
    validation_results: list[dict[str, Any]] = []
    try:
        if resume_session_id:
            update_run_progress(home, run_id, "resume_preflight", "resume_preflight", error_summary=None)
            append_run_event(
                home,
                run_id,
                "resume_preflight_started",
                "blocked run resume preflight started",
                {"codex_session_id": resume_session_id, "comment": resume_comment or ""},
            )
            preflight_prompt_path = write_codex_stage_prompt(
                context,
                "resume_preflight",
                build_resume_preflight_prompt(context, resume_comment),
            )
            resume_preflight_result = run_codex_stage(
                context,
                preflight_prompt_path,
                "resume_preflight",
                "resume_preflight",
            )
            if not resume_preflight_allows_resume(resume_preflight_result):
                message = resume_preflight_result.error or resume_preflight_result.final_message or "Resume preflight did not approve continuing."
                update_run_progress(home, run_id, "resume_preflight_blocked", "resume_preflight_blocked", error_summary=message)
                append_run_event(
                    home,
                    run_id,
                    "resume_preflight_blocked",
                    message,
                    {"codex_session_id": resume_preflight_result.session_id},
                )
                finished = finish_run(home, run_id, "blocked", message)
                return {
                    "run": finished,
                    "resume_preflight": resume_preflight_result.__dict__,
                    "codex": None,
                    "validation": validation_results,
                }
            mark_task_running_for_resume(home, project_id_value, requirement_id_value, task_id_value, run_id)
            update_run_progress(home, run_id, "resuming", "resuming", error_summary=None)
            append_run_event(
                home,
                run_id,
                "resume_started",
                "blocked run resume approved and started",
                {"codex_session_id": resume_session_id, "preflight_session_id": resume_preflight_result.session_id},
            )
            prompt_path = write_codex_stage_prompt(context, "resume", build_blocked_resume_prompt(context, resume_comment, resume_session_id))
            codex_result = run_codex_stage(context, prompt_path, "resume", "development", resume_session_id=resume_session_id)
        else:
            prepare_task_worktree(context)
            prompt_path = write_codex_prompt(context)
            codex_result = run_codex_implementation(context, prompt_path)
        if codex_result.status == "blocked":
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "blocked")
            finished = finish_run(home, run_id, "blocked", codex_result.error or "Codex input required")
            return {"run": finished, "codex": codex_result.__dict__, "validation": validation_results}
        if codex_result.status != "success":
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "failed")
            finished = finish_run(home, run_id, "failed", codex_result.error or "Codex implementation failed")
            return {"run": finished, "codex": codex_result.__dict__, "validation": validation_results}
        forbidden_changes = viberig_worktree_changes(context.worktree_path)
        if forbidden_changes:
            message = "Codex modified forbidden .vibeRig files: " + ", ".join(forbidden_changes)
            append_run_event(home, run_id, "forbidden_changes_detected", message, {"changes": forbidden_changes})
            update_run_progress(home, run_id, "failed", "failed", error_summary=message)
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "failed")
            finished = finish_run(home, run_id, "failed", message)
            return {"run": finished, "codex": codex_result.__dict__, "validation": validation_results}
        diff_artifacts = collect_git_diff(context)
        test_prompt_path = write_codex_stage_prompt(
            context,
            "test_authoring",
            build_test_authoring_prompt(context, codex_result, diff_artifacts),
        )
        test_result = run_codex_stage(context, test_prompt_path, "test_authoring", "test_authoring")
        if test_result.status != "success":
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "failed")
            finished = finish_run(home, run_id, "failed", test_result.error or "Codex test authoring failed")
            return {
                "run": finished,
                "codex": codex_result.__dict__,
                "test_authoring": test_result.__dict__,
                "acceptance": None,
                "validation": validation_results,
            }
        forbidden_test_changes = viberig_worktree_changes(context.worktree_path)
        if forbidden_test_changes:
            message = "Codex modified forbidden .vibeRig files during test authoring: " + ", ".join(forbidden_test_changes)
            append_run_event(home, run_id, "forbidden_changes_detected", message, {"changes": forbidden_test_changes, "stage": "test_authoring"})
            update_run_progress(home, run_id, "failed", "failed", error_summary=message)
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "failed")
            finished = finish_run(home, run_id, "failed", message)
            return {
                "run": finished,
                "codex": codex_result.__dict__,
                "test_authoring": test_result.__dict__,
                "acceptance": None,
                "validation": validation_results,
            }
        diff_artifacts = collect_git_diff(context)
        validation_results = run_validation(context)
        evidence_paths = write_self_acceptance_evidence(
            project_root,
            requirement_id_value,
            task_id_value,
            validation_results,
            context.run_log_path,
            run_id,
            codex_result,
            {
                "prompt_path": str(prompt_path),
                "changed_files_path": str(diff_artifacts["changed_files_path"]),
                "diff_path": str(diff_artifacts["diff_path"]),
            },
        )
        record_evidence(home, project_id_value, requirement_id_value, task_id_value, "validation", "validation results", str(evidence_paths["validation"]), {"results": validation_results})
        record_evidence(home, project_id_value, requirement_id_value, task_id_value, "self_acceptance", "self-acceptance evidence", str(evidence_paths["self_acceptance"]))
        failed_validations = [
            item
            for item in validation_results
            if not item.get("manual") and item.get("exit_code") != 0
        ]
        manual_validations = [item for item in validation_results if item.get("manual")]
        if not failed_validations:
            update_run_progress(home, run_id, "self_acceptance_written", "self_acceptance_written")
            append_run_event(home, run_id, "self_acceptance_written", "self-acceptance evidence written", {"path": str(evidence_paths["self_acceptance"])})
            acceptance_prompt_path = write_codex_stage_prompt(
                context,
                "acceptance_review",
                build_acceptance_review_prompt(
                    context,
                    codex_result,
                    test_result,
                    validation_results,
                    evidence_paths,
                    diff_artifacts,
                ),
            )
            acceptance_result = run_codex_stage(context, acceptance_prompt_path, "acceptance_review", "acceptance_review")
            if context.config.get("adapter") == "fake" and not latest_manual_review(home, task_key(project_id_value, requirement_id_value, task_id_value)):
                for item in context.acceptance_items:
                    update_acceptance_status(home, project_id_value, requirement_id_value, item["acceptance_id"], "passed")
                record_manual_review(
                    home,
                    project_id_value,
                    requirement_id_value,
                    task_id_value,
                    "fake-codex-acceptance-review",
                    "accepted",
                    "Fake Codex acceptance review accepted the task.",
                    [str(evidence_paths["self_acceptance"]), str(evidence_paths["validation"])],
                    "fake adapter only",
                )
            review = latest_manual_review(home, task_key(project_id_value, requirement_id_value, task_id_value))
            if acceptance_result.status != "success":
                update_run_progress(home, run_id, "acceptance_failed", "acceptance_failed", error_summary=acceptance_result.error)
                update_task_status(home, project_id_value, requirement_id_value, task_id_value, "blocked")
                finished = finish_run(home, run_id, "blocked", acceptance_result.error or "Codex acceptance review blocked")
            else:
                update_task_status(home, project_id_value, requirement_id_value, task_id_value, "human_review")
                review_note = ""
                if review:
                    review_note = f"; AI review recommendation: {review.get('result')}"
                summary = (
                    "Codex implementation, test authoring, validation, and acceptance review completed; pending human review"
                    if not manual_validations
                    else "Codex implementation and acceptance review completed; manual validation items remain recorded and human review is pending"
                )
                finished = finish_run(home, run_id, "success", summary + review_note)
        else:
            update_run_progress(home, run_id, "validation_failed", "validation_failed")
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "failed")
            finished = finish_run(home, run_id, "failed", "validation failed")
    except Exception as error:  # noqa: BLE001
        append_run_event(home, run_id, "error", str(error))
        try:
            update_task_status(home, project_id_value, requirement_id_value, task_id_value, "failed")
        except Exception:
            pass
        update_run_progress(home, run_id, "failed", "failed", error_summary=str(error))
        finished = finish_run(home, run_id, "failed", str(error))
    return {
        "run": finished,
        "resume_preflight": resume_preflight_result.__dict__ if resume_preflight_result else None,
        "codex": codex_result.__dict__ if codex_result else None,
        "test_authoring": test_result.__dict__ if test_result else None,
        "acceptance": acceptance_result.__dict__ if acceptance_result else None,
        "validation": validation_results,
    }


def execute_existing_run(
    home: Path,
    run_id: str,
    mark_running: bool = False,
    resume_session_id: str | None = None,
    resume_comment: str | None = None,
) -> dict[str, Any]:
    with connect_db(home) as connection:
        run_row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run_row:
            raise ValueError(f"Unknown run: {run_id}")
        task_row = connection.execute("SELECT * FROM tasks WHERE id = ?", (run_row["task_id"],)).fetchone()
        if not task_row:
            raise ValueError(f"Unknown task for run: {run_id}")
    run = normalize_run(run_row)
    task = normalize_task(task_row)
    context = create_run_context(home, run["project_id"], run["requirement_id"], task["task_id"], run=run)
    return execute_run_context(context, mark_running=mark_running, resume_session_id=resume_session_id, resume_comment=resume_comment)


def execute_ready_task(home: Path, project_id_value: str, requirement_id_value: str, task_id_value: str) -> dict[str, Any]:
    context = create_run_context(home, project_id_value, requirement_id_value, task_id_value)
    return execute_run_context(context)


def latest_blocked_run_for_task(home: Path, project_id_value: str, requirement_id_value: str, task_id_value: str) -> tuple[dict[str, Any], dict[str, Any]]:
    key = task_key(project_id_value, requirement_id_value, task_id_value)
    with connect_db(home) as connection:
        run_row = connection.execute(
            """
            SELECT * FROM runs
            WHERE project_id = ? AND requirement_id = ? AND task_id = ? AND status = 'blocked'
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (project_id_value, requirement_id_value, key),
        ).fetchone()
        if not run_row:
            raise ValueError(f"Task has no blocked run to resume: {task_id_value}")
        session_row = connection.execute(
            """
            SELECT * FROM codex_sessions
            WHERE run_id = ?
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (run_row["id"],),
        ).fetchone()
        if not session_row:
            raise ValueError(f"Blocked run has no Codex session to resume: {run_row['id']}")
    return normalize_run(run_row), normalize_codex_session(session_row)


def reopen_run_for_resume(home: Path, run_id: str, comment: str | None = None) -> dict[str, Any]:
    now = utc_now()
    with connect_db(home) as connection:
        run = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run:
            raise ValueError(f"Unknown run: {run_id}")
        if run["status"] != "blocked":
            raise ValueError("Only blocked runs can be resumed.")
        connection.execute(
            """
            UPDATE runs
            SET status = 'resume_preflight', implementation_status = 'resume_preflight', finished_at = NULL,
                error_summary = NULL
            WHERE id = ?
            """,
            (run_id,),
        )
        add_activity_event(
            connection,
            "run.continue_after_fix_requested",
            run["project_id"],
            run["requirement_id"],
            run["task_id"],
            {"run_id": run_id, "comment": comment or ""},
        )
        connection.commit()
        row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    append_run_event(home, run_id, "continue_after_fix_requested", comment or "continue after fix requested")
    resumed = normalize_run(row)
    publish_server_event("run.updated", {"run_id": run_id, "run": resumed})
    return resumed


def execute_blocked_task_resume(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    comment: str | None = None,
) -> dict[str, Any]:
    task_detail = get_task(home, project_id_value, requirement_id_value, task_id_value)
    if task_detail["task"]["status"] != "blocked":
        raise ValueError("Only blocked tasks can be resumed.")
    run, session = latest_blocked_run_for_task(home, project_id_value, requirement_id_value, task_id_value)
    reopen_run_for_resume(home, run["id"], comment)
    return execute_existing_run(
        home,
        run["id"],
        mark_running=False,
        resume_session_id=session["id"],
        resume_comment=comment,
    )


def start_blocked_task_resume(
    home: Path,
    project_id_value: str,
    requirement_id_value: str,
    task_id_value: str,
    comment: str | None = None,
) -> dict[str, Any]:
    task_detail = get_task(home, project_id_value, requirement_id_value, task_id_value)
    if task_detail["task"]["status"] != "blocked":
        raise ValueError("Only blocked tasks can be resumed.")
    run, session = latest_blocked_run_for_task(home, project_id_value, requirement_id_value, task_id_value)
    reopened = reopen_run_for_resume(home, run["id"], comment)

    def worker() -> None:
        execute_existing_run(
            home,
            run["id"],
            mark_running=False,
            resume_session_id=session["id"],
            resume_comment=comment,
        )

    thread = threading.Thread(target=worker, name=f"viberig-resume-{run['id']}", daemon=True)
    thread.start()
    return get_run(home, reopened["id"])["run"]


def start_run_resume(home: Path, run_id: str, comment: str | None = None) -> dict[str, Any]:
    with connect_db(home) as connection:
        run_row = connection.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not run_row:
            raise ValueError(f"Unknown run: {run_id}")
        task_row = connection.execute("SELECT * FROM tasks WHERE id = ?", (run_row["task_id"],)).fetchone()
        if not task_row:
            raise ValueError(f"Unknown task for run: {run_id}")
        session_row = connection.execute(
            "SELECT * FROM codex_sessions WHERE run_id = ? ORDER BY started_at DESC LIMIT 1",
            (run_id,),
        ).fetchone()
        if not session_row:
            raise ValueError(f"Run has no Codex session to resume: {run_id}")
    run = normalize_run(run_row)
    task = normalize_task(task_row)
    if run["status"] != "blocked":
        raise ValueError("Only blocked runs can be resumed.")
    if task["status"] != "blocked":
        raise ValueError("Only blocked tasks can be resumed.")
    reopened = reopen_run_for_resume(home, run_id, comment)

    def worker() -> None:
        execute_existing_run(
            home,
            run_id,
            mark_running=False,
            resume_session_id=session_row["id"],
            resume_comment=comment,
        )

    thread = threading.Thread(target=worker, name=f"viberig-resume-{run_id}", daemon=True)
    thread.start()
    return get_run(home, reopened["id"])["run"]


def rerun_task(home: Path, project_id_value: str, requirement_id_value: str, task_id_value: str, reason: str | None = None) -> dict[str, Any]:
    detail = get_task(home, project_id_value, requirement_id_value, task_id_value)
    if detail["task"]["status"] != "ready":
        update_task_status(
            home,
            project_id_value,
            requirement_id_value,
            task_id_value,
            "ready",
            reason=reason or "rerun requested",
        )
    return start_task_run(home, project_id_value, requirement_id_value, task_id_value)


def start_task_run(home: Path, project_id_value: str, requirement_id_value: str, task_id_value: str) -> dict[str, Any]:
    run = create_run(home, project_id_value, requirement_id_value, task_id_value)
    update_task_status(home, project_id_value, requirement_id_value, task_id_value, "running")

    def worker() -> None:
        execute_existing_run(home, run["id"], mark_running=False)

    append_run_event(home, run["id"], "queued", "run accepted for background execution")
    thread = threading.Thread(target=worker, name=f"viberig-run-{run['id']}", daemon=True)
    thread.start()
    return get_run(home, run["id"])["run"]


def export_linear(home: Path, project_id_value: str, requirement_id_value: str, dry_run: bool = True) -> dict[str, Any]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    board = get_board(home, project_id_value, requirement_id_value)
    export_dir = Path(project["project_root"]) / ".vibeRig" / "exports" / "linear" / requirement_id_value
    rendered = []
    for task in board["tasks"]:
        body = [
            f"# {task['task_id']}: {task['title']}",
            "",
            f"Status: {task['status']}",
            f"Type: {task.get('type') or ''}",
            f"Branch: `{task.get('branch') or ''}`",
            f"Worktree: `{task.get('worktree_hint') or ''}`",
            "",
            "## Scope",
            "",
            "Include:",
            *[f"- {item}" for item in task.get("scope", {}).get("include", [])],
            "",
            "Exclude:",
            *[f"- {item}" for item in task.get("scope", {}).get("exclude", [])],
            "",
            "## Validation",
            "",
            *[f"- `{command}`" for command in task.get("validation", [])],
        ]
        path = export_dir / f"{task['task_id']}.md"
        rendered.append({"task_id": task["task_id"], "path": str(path), "content": "\n".join(body) + "\n"})
    if not dry_run:
        export_dir.mkdir(parents=True, exist_ok=True)
        for item in rendered:
            Path(item["path"]).write_text(item["content"], encoding="utf-8")
    return {"dry_run": dry_run, "items": rendered}


def export_obsidian(home: Path, project_id_value: str, requirement_id_value: str) -> dict[str, Any]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    board = get_board(home, project_id_value, requirement_id_value)
    export_dir = Path(project["project_root"]) / ".vibeRig" / "exports" / "obsidian"
    export_dir.mkdir(parents=True, exist_ok=True)
    path = export_dir / f"{requirement_id_value}-dashboard.md"
    lines = [f"# {board['requirement']['title']} Dashboard", "", "| Task | Status | Acceptance | Evidence |", "| --- | --- | --- | --- |"]
    for task in board["tasks"]:
        progress = task.get("acceptance_progress") or {}
        lines.append(
            f"| {task['task_id']} {task['title']} | {task['status']} | "
            f"{progress.get('completed', 0)}/{progress.get('total', 0)} | {task.get('evidence_count', 0)} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"path": str(path)}


def export_lark_report(home: Path, project_id_value: str, requirement_id_value: str) -> dict[str, Any]:
    project = find_project(home, project_id_value)
    if not project:
        raise ValueError(f"Unknown project: {project_id_value}")
    board = get_board(home, project_id_value, requirement_id_value)
    export_dir = Path(project["project_root"]) / ".vibeRig" / "exports" / "lark"
    export_dir.mkdir(parents=True, exist_ok=True)
    path = export_dir / f"{requirement_id_value}-report.json"
    payload = {
        "project_id": project_id_value,
        "requirement_id": requirement_id_value,
        "generated_at": utc_now(),
        "summary": {
            column["status"]: len(column["tasks"])
            for column in board["columns"]
        },
        "tasks": [
            {
                "task_id": task["task_id"],
                "title": task["title"],
                "status": task["status"],
                "acceptance_progress": task.get("acceptance_progress"),
            }
            for task in board["tasks"]
        ],
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"path": str(path), "payload": payload}


def mcp_tool_descriptions() -> list[dict[str, Any]]:
    def schema(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": properties,
            "required": required or [],
            "additionalProperties": False,
        }

    string = {"type": "string"}
    string_array = {"type": "array", "items": string}
    object_value = {"type": "object", "additionalProperties": True}
    tools = {
        "viberig.projects.list": schema({}),
        "viberig.projects.register": schema({"project_root": string, "project_name": string, "plugin_root": string}, ["project_root"]),
        "viberig.projects.refresh": schema({"project_id": string}, ["project_id"]),
        "viberig.requirements.list": schema({"project_id": string}),
        "viberig.requirements.import": schema({"project_id": string, "requirement_path": string}, ["project_id", "requirement_path"]),
        "viberig.requirements.get": schema({"project_id": string, "requirement_id": string}, ["project_id", "requirement_id"]),
        "viberig.board.get": schema({"project_id": string, "requirement_id": string}, ["project_id", "requirement_id"]),
        "viberig.tasks.get": schema({"project_id": string, "requirement_id": string, "task_id": string}, ["project_id", "requirement_id", "task_id"]),
        "viberig.tasks.move": schema(
            {"project_id": string, "requirement_id": string, "task_id": string, "status": string, "reason": string, "auto_acceptable": {"type": "boolean"}},
            ["project_id", "requirement_id", "task_id", "status"],
        ),
        "viberig.tasks.update_status": schema(
            {"project_id": string, "requirement_id": string, "task_id": string, "status": string, "reason": string, "auto_acceptable": {"type": "boolean"}},
            ["project_id", "requirement_id", "task_id", "status"],
        ),
        "viberig.tasks.update_order": schema({"project_id": string, "requirement_id": string, "task_ids": string_array}, ["project_id", "requirement_id", "task_ids"]),
        "viberig.acceptance.list": schema({"project_id": string, "requirement_id": string}, ["project_id", "requirement_id"]),
        "viberig.acceptance.update_status": schema(
            {"project_id": string, "requirement_id": string, "acceptance_id": string, "status": {"type": "string", "enum": ["pending", "passed", "failed", "blocked", "waived"]}},
            ["project_id", "requirement_id", "acceptance_id", "status"],
        ),
        "viberig.runs.create": schema({"project_id": string, "requirement_id": string, "task_id": string, "worktree_path": string}, ["project_id", "requirement_id", "task_id"]),
        "viberig.tasks.continue_after_fix": schema({"project_id": string, "requirement_id": string, "task_id": string, "comment": string}, ["project_id", "requirement_id", "task_id"]),
        "viberig.tasks.resume_blocked": schema({"project_id": string, "requirement_id": string, "task_id": string, "comment": string}, ["project_id", "requirement_id", "task_id"]),
        "viberig.tasks.rerun": schema({"project_id": string, "requirement_id": string, "task_id": string, "reason": string}, ["project_id", "requirement_id", "task_id"]),
        "viberig.runs.continue_after_fix": schema({"run_id": string, "comment": string}, ["run_id"]),
        "viberig.runs.resume": schema({"run_id": string, "comment": string}, ["run_id"]),
        "viberig.runs.append_event": schema({"run_id": string, "event_type": string, "message": string, "payload": object_value}, ["run_id", "event_type"]),
        "viberig.runs.finish": schema({"run_id": string, "status": string, "summary": string}, ["run_id", "status"]),
        "viberig.runs.get_log": schema({"run_id": string}, ["run_id"]),
        "viberig.runs.get": schema({"run_id": string}, ["run_id"]),
        "viberig.runs.events": schema({"run_id": string}, ["run_id"]),
        "viberig.runs.artifacts": schema({"run_id": string}, ["run_id"]),
        "viberig.runs.diff": schema({"run_id": string}, ["run_id"]),
        "viberig.runs.cancel": schema({"run_id": string, "reason": string}, ["run_id"]),
        "viberig.codex_sessions.get": schema({"session_id": string}, ["session_id"]),
        "viberig.codex_sessions.for_run": schema({"run_id": string}, ["run_id"]),
        "viberig.codex_sessions.for_task": schema({"project_id": string, "requirement_id": string, "task_id": string}, ["project_id", "requirement_id", "task_id"]),
        "viberig.codex_sessions.transcript": schema({"session_id": string}, ["session_id"]),
        "viberig.codex_sessions.events": schema({"session_id": string}, ["session_id"]),
        "viberig.evidence.list": schema({"project_id": string, "requirement_id": string, "task_id": string}, ["project_id", "requirement_id"]),
        "viberig.evidence.record": schema(
            {"project_id": string, "requirement_id": string, "task_id": string, "kind": string, "summary": string, "path": string, "payload": object_value, "acceptance_id": string},
            ["project_id", "requirement_id", "kind"],
        ),
        "viberig.evidence.discover": schema({"project_id": string, "requirement_id": string}, ["project_id", "requirement_id"]),
        "viberig.reviews.record_manual_review": schema(
            {
                "project_id": string,
                "requirement_id": string,
                "task_id": string,
                "reviewer": string,
                "result": {"type": "string", "enum": ["accepted", "rejected"]},
                "notes": string,
                "evidence_reviewed": string_array,
                "residual_risks": string,
            },
            ["project_id", "requirement_id", "task_id", "reviewer", "result"],
        ),
    }
    return [{"name": name, "description": name, "inputSchema": input_schema} for name, input_schema in tools.items()]


def mcp_resources(home: Path) -> list[dict[str, Any]]:
    resources = [{"uri": "viberig://projects", "name": "VibeRig Projects"}]
    for project in list_projects(home):
        project_id_value = project["id"]
        resources.append({"uri": f"viberig://projects/{project_id_value}", "name": project.get("name", project_id_value)})
        resources.append({"uri": f"viberig://projects/{project_id_value}/requirements", "name": "Requirements"})
        for requirement in list_requirements(home, project_id_value):
            req_id = requirement["requirement_id"]
            resources.append({"uri": f"viberig://requirements/{project_id_value}/{req_id}", "name": requirement["title"]})
            resources.append({"uri": f"viberig://requirements/{project_id_value}/{req_id}/board", "name": "Board"})
            for task in get_board(home, project_id_value, req_id)["tasks"]:
                task_id_value = task["task_id"]
                resources.append({"uri": f"viberig://tasks/{project_id_value}/{req_id}/{task_id_value}", "name": task["title"]})
                resources.append({"uri": f"viberig://tasks/{project_id_value}/{req_id}/{task_id_value}/acceptance", "name": "Task Acceptance"})
                resources.append({"uri": f"viberig://tasks/{project_id_value}/{req_id}/{task_id_value}/runs", "name": "Task Runs"})
                resources.append({"uri": f"viberig://tasks/{project_id_value}/{req_id}/{task_id_value}/codex-sessions", "name": "Task Codex Sessions"})
                for run in get_task(home, project_id_value, req_id, task_id_value)["runs"]:
                    run_id = run["id"]
                    resources.append({"uri": f"viberig://runs/{run_id}", "name": f"Run {run_id}"})
                    resources.append({"uri": f"viberig://runs/{run_id}/events", "name": "Run Events"})
                    resources.append({"uri": f"viberig://runs/{run_id}/log", "name": "Run Log"})
                    resources.append({"uri": f"viberig://runs/{run_id}/artifacts", "name": "Run Artifacts"})
                    resources.append({"uri": f"viberig://runs/{run_id}/diff", "name": "Run Diff"})
                    if run.get("codex_session_id"):
                        resources.append({"uri": f"viberig://codex-sessions/{run['codex_session_id']}", "name": "Codex Session"})
                        resources.append({"uri": f"viberig://codex-sessions/{run['codex_session_id']}/transcript", "name": "Codex Transcript"})
                        resources.append({"uri": f"viberig://codex-sessions/{run['codex_session_id']}/events", "name": "Codex Events"})
    return resources


def call_mcp_tool(home: Path, name: str, args: dict[str, Any]) -> Any:
    if name == "viberig.projects.list":
        return {"projects": list_projects(home)}
    if name == "viberig.projects.register":
        root = Path(args["project_root"]).expanduser().resolve()
        plugin_root = Path(args.get("plugin_root") or PLUGIN_ROOT).expanduser().resolve()
        return {"project": save_project(home, root, args.get("project_name") or root.name, plugin_root)}
    if name == "viberig.projects.refresh":
        return {"refresh": refresh_project(home, args["project_id"])}
    if name == "viberig.requirements.list":
        return {"requirements": list_requirements(home, args.get("project_id"))}
    if name == "viberig.requirements.import":
        project = find_project(home, args["project_id"])
        if not project:
            raise ValueError(f"Unknown project: {args['project_id']}")
        return {"import": import_requirement(home, project, Path(args["requirement_path"]).expanduser().resolve())}
    if name == "viberig.requirements.get":
        return get_requirement(home, args["project_id"], args["requirement_id"])
    if name == "viberig.board.get":
        return {"board": get_board(home, args["project_id"], args["requirement_id"])}
    if name == "viberig.tasks.get":
        return get_task(home, args["project_id"], args["requirement_id"], args["task_id"])
    if name in {"viberig.tasks.move", "viberig.tasks.update_status"}:
        return {
            "task": update_task_status(
                home,
                args["project_id"],
                args["requirement_id"],
                args["task_id"],
                args["status"],
                bool(args.get("auto_acceptable")),
                args.get("reason"),
            )
        }
    if name == "viberig.tasks.update_order":
        return {"order": update_task_order(home, args["project_id"], args["requirement_id"], list(args.get("task_ids") or []))}
    if name == "viberig.acceptance.list":
        return {"acceptance_items": get_board(home, args["project_id"], args["requirement_id"])["acceptance_items"]}
    if name == "viberig.acceptance.update_status":
        return {"acceptance": update_acceptance_status(home, args["project_id"], args["requirement_id"], args["acceptance_id"], args["status"])}
    if name == "viberig.runs.create":
        return {"run": create_run(home, args["project_id"], args["requirement_id"], args["task_id"], args.get("worktree_path"))}
    if name in {"viberig.tasks.continue_after_fix", "viberig.tasks.resume_blocked"}:
        return {"run": start_blocked_task_resume(home, args["project_id"], args["requirement_id"], args["task_id"], args.get("comment") or "")}
    if name == "viberig.tasks.rerun":
        return {"run": rerun_task(home, args["project_id"], args["requirement_id"], args["task_id"], args.get("reason") or "rerun requested")}
    if name in {"viberig.runs.continue_after_fix", "viberig.runs.resume"}:
        return {"run": start_run_resume(home, args["run_id"], args.get("comment") or "")}
    if name == "viberig.runs.append_event":
        return {"event": append_run_event(home, args["run_id"], args["event_type"], args.get("message") or "", args.get("payload") or {})}
    if name == "viberig.runs.finish":
        return {"run": finish_run(home, args["run_id"], args["status"], args.get("summary") or "")}
    if name == "viberig.runs.get_log":
        return get_run_log(home, args["run_id"])
    if name == "viberig.runs.get":
        return get_run(home, args["run_id"])
    if name == "viberig.runs.events":
        return {"events": list_run_events(home, args["run_id"])}
    if name == "viberig.runs.artifacts":
        return get_run_artifacts(home, args["run_id"])
    if name == "viberig.runs.diff":
        return get_run_diff(home, args["run_id"])
    if name == "viberig.runs.cancel":
        return {"run": cancel_run(home, args["run_id"], args.get("reason") or "canceled by user")}
    if name == "viberig.codex_sessions.get":
        return {"codex_session": get_codex_session(home, args["session_id"])}
    if name == "viberig.codex_sessions.for_run":
        return {"codex_session": get_run_codex_session(home, args["run_id"])}
    if name == "viberig.codex_sessions.for_task":
        return {
            "codex_sessions": list_task_codex_sessions(
                home,
                args["project_id"],
                args["requirement_id"],
                args["task_id"],
            )
        }
    if name == "viberig.codex_sessions.transcript":
        return read_codex_session_file(home, args["session_id"], "transcript")
    if name == "viberig.codex_sessions.events":
        return read_codex_session_file(home, args["session_id"], "events")
    if name == "viberig.evidence.list":
        return {"evidence": list_evidence(home, args["project_id"], args["requirement_id"], args.get("task_id"))}
    if name == "viberig.evidence.record":
        return {"evidence": record_evidence(home, args["project_id"], args["requirement_id"], args.get("task_id"), args["kind"], args.get("summary") or "", args.get("path"), args.get("payload") or {}, args.get("acceptance_id"))}
    if name == "viberig.evidence.discover":
        return {"evidence": discover_evidence(home, args["project_id"], args["requirement_id"])}
    if name == "viberig.reviews.record_manual_review":
        return {"review": record_manual_review(home, args["project_id"], args["requirement_id"], args["task_id"], args["reviewer"], args["result"], args.get("notes") or "", list(args.get("evidence_reviewed") or []), args.get("residual_risks") or "")}
    raise ValueError(f"Unknown MCP tool: {name}")


def read_mcp_resource(home: Path, uri: str) -> Any:
    parts = uri.replace("viberig://", "").split("/")
    if uri == "viberig://projects":
        return {"projects": list_projects(home)}
    if len(parts) == 2 and parts[0] == "projects":
        project = next((item for item in list_projects(home) if item["id"] == parts[1]), None)
        if not project:
            raise ValueError(f"Unknown project: {parts[1]}")
        return {"project": project}
    if len(parts) == 3 and parts[0] == "projects" and parts[2] == "requirements":
        return {"requirements": list_requirements(home, parts[1])}
    if len(parts) >= 3 and parts[0] == "requirements":
        project_id_value, requirement_id_value = parts[1], parts[2]
        if len(parts) == 3:
            return get_requirement(home, project_id_value, requirement_id_value)
        if len(parts) == 4 and parts[3] == "board":
            return {"board": get_board(home, project_id_value, requirement_id_value)}
    if len(parts) >= 4 and parts[0] == "tasks":
        project_id_value, requirement_id_value, task_id_value = parts[1], parts[2], parts[3]
        detail = get_task(home, project_id_value, requirement_id_value, task_id_value)
        if len(parts) == 4:
            return detail
        if len(parts) == 5 and parts[4] == "acceptance":
            return {"acceptance_items": detail["acceptance_items"]}
        if len(parts) == 5 and parts[4] == "runs":
            return {"runs": detail["runs"]}
        if len(parts) == 5 and parts[4] == "codex-sessions":
            return {"codex_sessions": list_task_codex_sessions(home, project_id_value, requirement_id_value, task_id_value)}
    if len(parts) >= 2 and parts[0] == "runs":
        run_id = parts[1]
        if len(parts) == 2:
            return get_run(home, run_id)
        if len(parts) == 3 and parts[2] == "log":
            return get_run_log(home, run_id)
        if len(parts) == 3 and parts[2] == "events":
            return {"events": list_run_events(home, run_id)}
        if len(parts) == 3 and parts[2] == "artifacts":
            return get_run_artifacts(home, run_id)
        if len(parts) == 3 and parts[2] == "diff":
            return get_run_diff(home, run_id)
    if len(parts) >= 2 and parts[0] == "codex-sessions":
        session_id = parts[1]
        if len(parts) == 2:
            return {"codex_session": get_codex_session(home, session_id)}
        if len(parts) == 3 and parts[2] == "transcript":
            return read_codex_session_file(home, session_id, "transcript")
        if len(parts) == 3 and parts[2] == "events":
            return read_codex_session_file(home, session_id, "events")
    raise ValueError(f"Unknown MCP resource: {uri}")


def read_mcp_server_message(handle: Any) -> tuple[dict[str, Any] | None, bool]:
    first = handle.read(1)
    if not first:
        return None, False
    if first == b"C":
        header = bytearray(first)
        while b"\r\n\r\n" not in header:
            chunk = handle.read(1)
            if not chunk:
                return None, True
            header.extend(chunk)
        content_length = None
        for line in bytes(header).decode("ascii", errors="replace").split("\r\n"):
            if line.lower().startswith("content-length:"):
                content_length = int(line.split(":", 1)[1].strip())
                break
        if content_length is None:
            raise ValueError("MCP request missing Content-Length header")
        body = handle.read(content_length)
        return json.loads(body.decode("utf-8")), True
    line = bytearray(first)
    while not line.endswith(b"\n"):
        chunk = handle.read(1)
        if not chunk:
            break
        line.extend(chunk)
    if not line.strip():
        return {}, False
    return json.loads(bytes(line).decode("utf-8")), False


def write_mcp_server_message(payload: dict[str, Any], framed: bool) -> None:
    body = json.dumps(payload, sort_keys=True).encode("utf-8")
    if framed:
        sys.stdout.buffer.write(f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body)
        sys.stdout.buffer.flush()
    else:
        sys.stdout.write(body.decode("utf-8") + "\n")
        sys.stdout.flush()


def mcp(args: argparse.Namespace) -> int:
    home = viberig_home()
    while True:
        request, framed = read_mcp_server_message(sys.stdin.buffer)
        if request is None:
            break
        if not request:
            continue
        if str(request.get("method") or "").startswith("notifications/"):
            continue
        response: dict[str, Any] = {"jsonrpc": "2.0", "id": request.get("id")}
        try:
            method = request.get("method")
            params = request.get("params") or {}
            if method == "initialize":
                response["result"] = {
                    "protocolVersion": params.get("protocolVersion") or "2025-06-18",
                    "serverInfo": {"name": "viberig-native-task-engine", "version": "0.1.0"},
                    "capabilities": {"tools": {}, "resources": {}},
                }
            elif method == "tools/list":
                response["result"] = {"tools": mcp_tool_descriptions()}
            elif method == "tools/call":
                payload = call_mcp_tool(home, params["name"], params.get("arguments") or {})
                response["result"] = {"content": [{"type": "text", "text": json.dumps(payload, indent=2, sort_keys=True)}]}
            elif method == "resources/list":
                response["result"] = {"resources": mcp_resources(home)}
            elif method == "resources/read":
                payload = read_mcp_resource(home, params["uri"])
                response["result"] = {
                    "contents": [
                        {
                            "uri": params["uri"],
                            "mimeType": "application/json",
                            "text": json.dumps(payload, indent=2, sort_keys=True),
                        }
                    ]
                }
            else:
                response["error"] = {"code": -32601, "message": f"Method not found: {method}"}
        except Exception as error:  # noqa: BLE001
            response["error"] = {"code": -32000, "message": str(error)}
        write_mcp_server_message(response, framed)
    return 0


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
        "projects": list_projects(home),
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
    launch_path = os.environ.get("PATH") or "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
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
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>{html.escape(launch_path)}</string>
  </dict>
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


def render_dashboard(state: dict[str, Any]) -> str:
    state_json = html.escape(json.dumps(state, sort_keys=True))
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VibeRig</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #1f2328; background: #f6f8fa; }}
    header {{ display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #d0d7de; background: #fff; position: sticky; top: 0; z-index: 2; }}
    h1 {{ margin: 0; font-size: 18px; }}
    h2 {{ margin: 0 0 8px; font-size: 16px; }}
    h3 {{ margin: 0; font-size: 12px; color: #57606a; text-transform: uppercase; letter-spacing: 0; }}
    select, input, textarea {{ border: 1px solid #8c959f; border-radius: 6px; padding: 7px 9px; background: #fff; min-width: 160px; }}
    textarea {{ width: 100%; min-height: 76px; resize: vertical; }}
    button {{ border: 1px solid #8c959f; background: #fff; padding: 7px 10px; border-radius: 6px; cursor: pointer; }}
    button.primary {{ background: #0969da; color: white; border-color: #0969da; }}
    button.danger {{ color: #cf222e; }}
    code {{ font-size: 12px; }}
    main {{ display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; padding: 16px; }}
    .toolbar {{ display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }}
    .board {{ display: grid; grid-template-columns: repeat(4, minmax(190px, 1fr)); gap: 12px; align-items: start; }}
    .column {{ background: #fff; border: 1px solid #d0d7de; border-radius: 8px; min-height: 220px; padding: 10px; }}
    .column.over {{ outline: 2px solid #0969da; }}
    .column-head {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }}
    .count {{ color: #57606a; font-size: 12px; }}
    .card {{ border: 1px solid #d8dee4; border-radius: 6px; padding: 10px; margin-bottom: 8px; background: #ffffff; display: grid; gap: 5px; }}
    .card:hover {{ border-color: #0969da; }}
    .card strong {{ color: #0969da; }}
    .card small, .muted, .empty {{ color: #6e7781; font-size: 12px; }}
    .drawer {{ background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 14px; max-height: calc(100vh - 104px); overflow: auto; position: sticky; top: 76px; }}
    .section {{ border-top: 1px solid #d8dee4; margin-top: 12px; padding-top: 12px; }}
    .row {{ display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }}
    .pill {{ display: inline-flex; align-items: center; border: 1px solid #d8dee4; border-radius: 999px; padding: 2px 7px; font-size: 12px; color: #57606a; }}
    .log {{ white-space: pre-wrap; background: #f6f8fa; border: 1px solid #d8dee4; border-radius: 6px; padding: 8px; max-height: 180px; overflow: auto; }}
    @media (max-width: 1100px) {{ main {{ grid-template-columns: 1fr; }} .drawer {{ position: static; max-height: none; }} }}
    @media (max-width: 900px) {{ .board {{ grid-template-columns: repeat(2, minmax(160px, 1fr)); }} }}
    @media (max-width: 560px) {{ header {{ align-items: flex-start; }} .board {{ grid-template-columns: 1fr; }} select, input {{ min-width: 100%; }} }}
  </style>
</head>
<body>
  <header>
    <h1>VibeRig</h1>
    <div class="toolbar">
      <select id="projectSelect"></select>
      <select id="requirementSelect"></select>
      <button id="refreshProject">Sync Project</button>
      <button id="refreshRequirement">Sync Requirement</button>
      <button id="discoverEvidence">Discover Evidence</button>
      <button id="exportObsidian">Export Obsidian</button>
      <button id="exportLark">Export Lark</button>
    </div>
  </header>
  <main>
    <section>
      <div id="board" class="board"></div>
    </section>
    <aside id="drawer" class="drawer">
      <p class="muted">Select a task.</p>
    </aside>
  </main>
  <script id="initialState" type="application/json">{state_json}</script>
  <script>
    const initialState = JSON.parse(document.getElementById('initialState').textContent);
    const statuses = [
      ['draft', 'Backlog'], ['ready', 'Ready'], ['running', 'Running'],
      ['human_review', 'Human Review'], ['accepted', 'Accepted'], ['blocked', 'Blocked'], ['failed', 'Failed']
    ];
    let projects = initialState.projects || [];
    let requirements = [];
    let board = null;
    let selectedProject = projects[0]?.id || '';
    let selectedRequirement = '';
    let selectedTask = '';

    async function api(path, options = {{}}) {{
      const response = await fetch(path, options);
      const payload = await response.json().catch(() => ({{error: response.statusText}}));
      if (!response.ok) throw new Error(payload.error || response.statusText);
      return payload;
    }}
    function post(path, body) {{
      return api(path, {{method: 'POST', headers: {{'Content-Type': 'application/json'}}, body: JSON.stringify(body)}});
    }}
    function esc(value) {{
      return String(value ?? '').replace(/[&<>"']/g, ch => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[ch]));
    }}
    async function loadProjects() {{
      projects = (await api('/api/projects')).projects;
      const select = document.getElementById('projectSelect');
      select.innerHTML = projects.map(project => `<option value="${{esc(project.id)}}">${{esc(project.name || project.id)}}</option>`).join('');
      if (!projects.some(project => project.id === selectedProject)) selectedProject = projects[0]?.id || '';
      select.value = selectedProject;
      await loadRequirements();
    }}
    async function loadRequirements() {{
      if (!selectedProject) return;
      requirements = (await api(`/api/requirements?project_id=${{encodeURIComponent(selectedProject)}}`)).requirements;
      const select = document.getElementById('requirementSelect');
      select.innerHTML = requirements.map(req => `<option value="${{esc(req.requirement_id)}}">${{esc(req.title)}}</option>`).join('');
      if (!requirements.some(req => req.requirement_id === selectedRequirement)) selectedRequirement = requirements[0]?.requirement_id || '';
      select.value = selectedRequirement;
      await loadBoard();
    }}
    async function loadBoard() {{
      if (!selectedProject || !selectedRequirement) {{
        document.getElementById('board').innerHTML = '<p class="muted">No imported requirements.</p>';
        return;
      }}
      board = (await api(`/api/board?project_id=${{encodeURIComponent(selectedProject)}}&requirement_id=${{encodeURIComponent(selectedRequirement)}}`)).board;
      renderBoard();
      if (selectedTask) await showTask(selectedTask);
    }}
    function renderBoard() {{
      document.getElementById('board').innerHTML = statuses.map(([status, title]) => {{
        const column = board.columns.find(item => item.status === status) || {{tasks: []}};
        const cards = column.tasks.map(task => {{
          const progress = task.acceptance_progress || {{completed: 0, total: 0}};
          const run = task.latest_run ? `${{task.latest_run.status}}` : 'no run';
          const review = task.manual_review ? task.manual_review.result : 'no review';
          return `<article class="card" draggable="true" data-task="${{esc(task.task_id)}}" onclick="showTask('${{esc(task.task_id)}}')">
            <strong>${{esc(task.task_id)}} · ${{esc(task.title)}}</strong>
            <small>${{esc(task.roadmap_id || 'no roadmap')}} · deps ${{dependencyCount(task.id)}} · AC ${{progress.completed}}/${{progress.total}}</small>
            <small>${{esc(run)}} · ${{esc(review)}} · evidence ${{task.evidence_count || 0}}</small>
          </article>`;
        }}).join('') || '<div class="empty">No tasks</div>';
        return `<section class="column" data-status="${{esc(status)}}">
          <div class="column-head"><h3>${{esc(title)}}</h3><span class="count">${{column.tasks.length}}</span></div>
          ${{cards}}
        </section>`;
      }}).join('');
      document.querySelectorAll('.card').forEach(card => {{
        card.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', card.dataset.task));
      }});
      document.querySelectorAll('.column').forEach(column => {{
        column.addEventListener('dragover', event => {{ event.preventDefault(); column.classList.add('over'); }});
        column.addEventListener('dragleave', () => column.classList.remove('over'));
        column.addEventListener('drop', async event => {{
          event.preventDefault();
          column.classList.remove('over');
          const taskId = event.dataTransfer.getData('text/plain');
          await moveTask(taskId, column.dataset.status);
        }});
      }});
    }}
    function dependencyCount(taskDbId) {{
      return (board.dependencies || []).filter(dep => dep.task_id === taskDbId).length;
    }}
    async function moveTask(taskId, status) {{
      const reason = ['ready', 'canceled'].includes(status) ? prompt('Reason, if required') : '';
      try {{
        await post('/api/tasks/update_status', {{project_id: selectedProject, requirement_id: selectedRequirement, task_id: taskId, status, reason}});
        await loadBoard();
      }} catch (error) {{
        alert(error.message);
      }}
    }}
    async function showTask(taskId) {{
      selectedTask = taskId;
      const detail = await api(`/api/tasks/get?project_id=${{encodeURIComponent(selectedProject)}}&requirement_id=${{encodeURIComponent(selectedRequirement)}}&task_id=${{encodeURIComponent(taskId)}}`);
      const task = detail.task;
      const scope = task.scope || {{}};
      document.getElementById('drawer').innerHTML = `
        <h2>${{esc(task.task_id)}} · ${{esc(task.title)}}</h2>
        <div class="row">
          <span class="pill">${{esc(task.status)}}</span>
          <span class="pill">${{esc(task.type || 'task')}}</span>
          <span class="pill">${{esc(task.roadmap_id || 'no roadmap')}}</span>
        </div>
        <div class="section"><h3>Actions</h3><div class="row">
          ${{statuses.map(([status, title]) => `<button onclick="moveTask('${{esc(task.task_id)}}','${{esc(status)}}')">${{esc(title)}}</button>`).join('')}}
          <button class="primary" ${{task.status === 'ready' ? '' : 'disabled title="Set task to Ready before running"'}} onclick="runTask('${{esc(task.task_id)}}')">Run</button>
        </div></div>
        <div class="section"><h3>Scope</h3><p class="muted">Include</p><ul>${{(scope.include || []).map(item => `<li><code>${{esc(item)}}</code></li>`).join('') || '<li class="muted">none</li>'}}</ul><p class="muted">Exclude</p><ul>${{(scope.exclude || []).map(item => `<li><code>${{esc(item)}}</code></li>`).join('') || '<li class="muted">none</li>'}}</ul></div>
        <div class="section"><h3>Dependencies</h3><ul>${{detail.dependencies.map(dep => `<li>${{esc(dep.task_id)}} · ${{esc(dep.status)}}</li>`).join('') || '<li class="muted">none</li>'}}</ul></div>
        <div class="section"><h3>Acceptance</h3><ul>${{detail.acceptance_items.map(item => `<li>${{esc(item.acceptance_id)}} · ${{esc(item.status)}} · ${{esc(item.title)}}</li>`).join('') || '<li class="muted">none</li>'}}</ul></div>
        <div class="section"><h3>Validation</h3><ul>${{(task.validation || []).map(command => `<li><code>${{esc(typeof command === 'string' ? command : Object.entries(command || {{}}).map(([key, value]) => `${{key}}: ${{value}}`).join('; '))}}</code></li>`).join('') || '<li class="muted">none</li>'}}</ul></div>
        <div class="section"><h3>Evidence</h3><ul>${{detail.evidence.map(item => `<li>${{esc(item.kind)}} · <code>${{esc(item.path || '')}}</code></li>`).join('') || '<li class="muted">none</li>'}}</ul></div>
        <div class="section"><h3>Manual Review</h3>
          <input id="reviewer" placeholder="reviewer">
          <textarea id="reviewNotes" placeholder="notes"></textarea>
          <div class="row"><button class="primary" onclick="reviewTask('${{esc(task.task_id)}}','accepted')">Accept</button><button class="danger" onclick="reviewTask('${{esc(task.task_id)}}','rejected')">Reject</button></div>
          <ul>${{detail.manual_reviews.map(review => `<li>${{esc(review.result)}} by ${{esc(review.reviewer)}} · ${{esc(review.created_at)}}</li>`).join('') || '<li class="muted">none</li>'}}</ul>
        </div>
        <div class="section"><h3>Runs</h3><ul>${{detail.runs.map(run => `<li>${{esc(run.status)}} · <button onclick="showRunLog('${{esc(run.id)}}')">log</button></li>`).join('') || '<li class="muted">none</li>'}}</ul><div id="runLog" class="log"></div></div>
        <div class="section"><h3>Activity</h3><ul>${{detail.activity.map(event => `<li>${{esc(event.event_type)}} · ${{esc(event.created_at)}}</li>`).join('') || '<li class="muted">none</li>'}}</ul></div>
      `;
    }}
    async function reviewTask(taskId, result) {{
      try {{
        await post('/api/reviews/record_manual_review', {{
          project_id: selectedProject, requirement_id: selectedRequirement, task_id: taskId,
          reviewer: document.getElementById('reviewer').value || 'human',
          result, notes: document.getElementById('reviewNotes').value || '', evidence_reviewed: []
        }});
        await loadBoard();
      }} catch (error) {{ alert(error.message); }}
    }}
    async function runTask(taskId) {{
      try {{
        await post(`/api/tasks/${{encodeURIComponent(taskId)}}/runs`, {{project_id: selectedProject, requirement_id: selectedRequirement}});
        await loadBoard();
      }} catch (error) {{ alert(error.message); }}
    }}
    async function showRunLog(runId) {{
      const payload = await api(`/api/runs/${{encodeURIComponent(runId)}}/log`);
      document.getElementById('runLog').textContent = payload.log || '';
    }}
    document.getElementById('projectSelect').addEventListener('change', event => {{ selectedProject = event.target.value; selectedRequirement = ''; selectedTask = ''; loadRequirements(); }});
    document.getElementById('requirementSelect').addEventListener('change', event => {{ selectedRequirement = event.target.value; selectedTask = ''; loadBoard(); }});
    document.getElementById('refreshProject').addEventListener('click', async () => {{ if (selectedProject) await post('/api/projects/refresh', {{project_id: selectedProject}}); await loadRequirements(); }});
    document.getElementById('refreshRequirement').addEventListener('click', async () => {{ if (selectedProject && selectedRequirement) await post('/api/requirements/refresh', {{project_id: selectedProject, requirement_id: selectedRequirement}}); await loadRequirements(); await loadBoard(); }});
    document.getElementById('discoverEvidence').addEventListener('click', async () => {{ if (selectedRequirement) await post('/api/evidence/discover', {{project_id: selectedProject, requirement_id: selectedRequirement}}); await loadBoard(); }});
    document.getElementById('exportObsidian').addEventListener('click', async () => {{ if (selectedRequirement) alert((await post('/api/exports/obsidian', {{project_id: selectedProject, requirement_id: selectedRequirement}})).export.path); }});
    document.getElementById('exportLark').addEventListener('click', async () => {{ if (selectedRequirement) alert((await post('/api/exports/lark', {{project_id: selectedProject, requirement_id: selectedRequirement}})).export.path); }});
    loadProjects().catch(error => alert(error.message));
    new EventSource('/api/events/stream').onmessage = () => loadBoard().catch(() => {{}});
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

    def send_sse_events(self) -> None:
        events = list_activity(self.home, limit=EVENT_STREAM_LIMIT)
        body = "".join(f"data: {json.dumps(event, sort_keys=True)}\n\n" for event in reversed(events)).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_websocket_frame(self) -> tuple[int, bytes] | None:
        try:
            header = self.request.recv(2)
        except socket.timeout:
            return 0, b""
        except OSError:
            return None
        if not header:
            return None
        if len(header) < 2:
            return None
        opcode = header[0] & 0x0F
        masked = bool(header[1] & 0x80)
        length = header[1] & 0x7F
        if length == 126:
            extended = self.request.recv(2)
            if len(extended) != 2:
                return None
            length = struct.unpack("!H", extended)[0]
        elif length == 127:
            extended = self.request.recv(8)
            if len(extended) != 8:
                return None
            length = struct.unpack("!Q", extended)[0]
        mask = self.request.recv(4) if masked else b""
        payload = bytearray()
        while len(payload) < length:
            try:
                chunk = self.request.recv(length - len(payload))
            except OSError:
                return None
            if not chunk:
                return None
            payload.extend(chunk)
        if masked:
            payload = bytearray(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        return opcode, bytes(payload)

    def send_websocket_events(self) -> None:
        client_key = self.headers.get("Sec-WebSocket-Key")
        if not client_key:
            self.send_json({"error": "missing Sec-WebSocket-Key"}, 400)
            return
        self.send_response(101)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", websocket_accept_key(client_key))
        self.end_headers()
        self.request.settimeout(60)
        with WEBSOCKET_LOCK:
            WEBSOCKET_CLIENTS.add(self.request)
        websocket_send(self.request, {"type": "connected", "created_at": utc_now(), "payload": {"event_limit": EVENT_STREAM_LIMIT}})
        self.close_connection = True
        try:
            while True:
                frame = self.read_websocket_frame()
                if frame is None:
                    break
                opcode, payload = frame
                if opcode == 0:
                    continue
                if opcode == 8:
                    break
                if opcode == 9:
                    try:
                        self.request.sendall(bytes([0x8A, len(payload)]) + payload)
                    except OSError:
                        break
        finally:
            with WEBSOCKET_LOCK:
                WEBSOCKET_CLIENTS.discard(self.request)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def send_file(self, path: Path, content_type: str | None = None) -> None:
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_dashboard_asset(self, request_path: str) -> bool:
        if not DASHBOARD_DIST.exists():
            return False
        if request_path in {"/", "/dashboard", "/dashboard/"}:
            self.send_file(DASHBOARD_DIST / "index.html", "text/html; charset=utf-8")
            return True
        if request_path.startswith("/dashboard/"):
            relative = request_path.removeprefix("/dashboard/").lstrip("/")
            asset_path = (DASHBOARD_DIST / relative).resolve()
            if DASHBOARD_DIST.resolve() in asset_path.parents and asset_path.is_file():
                self.send_file(asset_path)
                return True
            if "." not in Path(relative).name:
                self.send_file(DASHBOARD_DIST / "index.html", "text/html; charset=utf-8")
                return True
        return False

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if self.send_dashboard_asset(parsed.path):
            return
        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if self.path == "/api/health":
            self.send_json({"ok": True})
            return
        if self.path == "/api/state":
            self.send_json(current_state(self.home, self.port))
            return
        if self.path == "/api/projects":
            self.send_json({"projects": list_projects(self.home)})
            return
        if self.path == "/api/events/stream":
            self.send_sse_events()
            return
        if parsed.path == "/api/events/ws":
            self.send_websocket_events()
            return
        if self.path.startswith("/api/requirements"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            project_id_value = params.get("project_id", [None])[0]
            self.send_json({"requirements": list_requirements(self.home, project_id_value)})
            return
        project_requirements_match = re.fullmatch(r"/api/projects/([^/]+)/requirements", parsed.path)
        if project_requirements_match:
            self.send_json({"requirements": list_requirements(self.home, urllib.parse.unquote(project_requirements_match.group(1)))})
            return
        if self.path.startswith("/api/requirement"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            self.send_json(
                get_requirement(
                    self.home,
                    params.get("project_id", [""])[0],
                    params.get("requirement_id", [""])[0],
                )
            )
            return
        if self.path.startswith("/api/board"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            project_id_value = params.get("project_id", [""])[0]
            requirement_id_value = params.get("requirement_id", [""])[0]
            self.send_json({"board": get_board(self.home, project_id_value, requirement_id_value)})
            return
        project_board_match = re.fullmatch(r"/api/projects/([^/]+)/board", parsed.path)
        if project_board_match:
            params = urllib.parse.parse_qs(parsed.query)
            self.send_json(
                {
                    "board": get_board(
                        self.home,
                        urllib.parse.unquote(project_board_match.group(1)),
                        params.get("requirement_id", [""])[0],
                    )
                }
            )
            return
        if self.path.startswith("/api/tasks/get"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            self.send_json(
                get_task(
                    self.home,
                    params.get("project_id", [""])[0],
                    params.get("requirement_id", [""])[0],
                    params.get("task_id", [""])[0],
                )
            )
            return
        task_match = re.fullmatch(r"/api/tasks/([^/]+)(?:/(acceptance|runs|evidence))?", parsed.path)
        if task_match:
            params = urllib.parse.parse_qs(parsed.query)
            detail = get_task(
                self.home,
                params.get("project_id", [""])[0],
                params.get("requirement_id", [""])[0],
                urllib.parse.unquote(task_match.group(1)),
            )
            suffix = task_match.group(2)
            if suffix == "acceptance":
                self.send_json({"acceptance_items": detail["acceptance_items"]})
            elif suffix == "runs":
                self.send_json({"runs": detail["runs"]})
            elif suffix == "evidence":
                self.send_json({"evidence": detail["evidence"]})
            else:
                self.send_json(detail)
            return
        if self.path.startswith("/api/acceptance/list"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            board = get_board(
                self.home,
                params.get("project_id", [""])[0],
                params.get("requirement_id", [""])[0],
            )
            self.send_json({"acceptance_items": board["acceptance_items"]})
            return
        if self.path.startswith("/api/evidence/list"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            self.send_json(
                {
                    "evidence": list_evidence(
                        self.home,
                        params.get("project_id", [""])[0],
                        params.get("requirement_id", [""])[0],
                        params.get("task_id", [None])[0],
                    )
                }
            )
            return
        if self.path.startswith("/api/runs/get_log"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            self.send_json(get_run_log(self.home, params.get("run_id", [""])[0]))
            return
        run_match = re.fullmatch(r"/api/runs/([^/]+)(?:/(events|log|diff|artifacts|codex-session))?", parsed.path)
        if run_match:
            run_id = urllib.parse.unquote(run_match.group(1))
            suffix = run_match.group(2)
            if suffix == "events":
                self.send_json({"events": list_run_events(self.home, run_id)})
            elif suffix == "log":
                self.send_json(get_run_log(self.home, run_id))
            elif suffix == "diff":
                self.send_json(get_run_diff(self.home, run_id))
            elif suffix == "artifacts":
                self.send_json(get_run_artifacts(self.home, run_id))
            elif suffix == "codex-session":
                self.send_json({"codex_session": get_run_codex_session(self.home, run_id)})
            else:
                self.send_json(get_run(self.home, run_id))
            return
        codex_session_match = re.fullmatch(r"/api/codex-sessions/([^/]+)(?:/(transcript|events|final|prompt))?", parsed.path)
        if codex_session_match:
            session_id = urllib.parse.unquote(codex_session_match.group(1))
            suffix = codex_session_match.group(2)
            if suffix:
                self.send_json(read_codex_session_file(self.home, session_id, suffix))
            else:
                self.send_json({"codex_session": get_codex_session(self.home, session_id)})
            return
        task_codex_sessions_match = re.fullmatch(r"/api/tasks/([^/]+)/codex-sessions", parsed.path)
        if task_codex_sessions_match:
            params = urllib.parse.parse_qs(parsed.query)
            self.send_json(
                {
                    "codex_sessions": list_task_codex_sessions(
                        self.home,
                        params.get("project_id", [""])[0],
                        params.get("requirement_id", [""])[0],
                        urllib.parse.unquote(task_codex_sessions_match.group(1)),
                    )
                }
            )
            return
        run_log_match = re.fullmatch(r"/api/runs/([^/]+)/log", parsed.path)
        if run_log_match:
            self.send_json(get_run_log(self.home, urllib.parse.unquote(run_log_match.group(1))))
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
            parsed = urllib.parse.urlparse(self.path)
            project_refresh_match = re.fullmatch(r"/api/projects/([^/]+)/refresh", parsed.path)
            if project_refresh_match:
                self.send_json({"refresh": refresh_project(self.home, urllib.parse.unquote(project_refresh_match.group(1)))})
                return
            requirement_refresh_match = re.fullmatch(r"/api/projects/([^/]+)/requirements/([^/]+)/refresh", parsed.path)
            if requirement_refresh_match:
                self.send_json(
                    {
                        "refresh": refresh_requirement(
                            self.home,
                            urllib.parse.unquote(requirement_refresh_match.group(1)),
                            urllib.parse.unquote(requirement_refresh_match.group(2)),
                        )
                    }
                )
                return
            task_run_action_match = re.fullmatch(r"/api/tasks/([^/]+)/runs/(continue_after_fix|continue-after-fix|resume|rerun)", parsed.path)
            if task_run_action_match:
                task_id_value = urllib.parse.unquote(task_run_action_match.group(1))
                action = task_run_action_match.group(2)
                if action in {"continue_after_fix", "continue-after-fix", "resume"}:
                    run = start_blocked_task_resume(
                        self.home,
                        payload["project_id"],
                        payload["requirement_id"],
                        task_id_value,
                        payload.get("comment") or "",
                    )
                else:
                    run = rerun_task(
                        self.home,
                        payload["project_id"],
                        payload["requirement_id"],
                        task_id_value,
                        payload.get("reason") or "rerun requested from dashboard",
                    )
                self.send_json({"run": run, "result": {"run": run}})
                return
            run_resume_match = re.fullmatch(r"/api/runs/([^/]+)/(continue_after_fix|continue-after-fix|resume)", parsed.path)
            if run_resume_match:
                run = start_run_resume(
                    self.home,
                    urllib.parse.unquote(run_resume_match.group(1)),
                    payload.get("comment") or "",
                )
                self.send_json({"run": run, "result": {"run": run}})
                return
            task_run_match = re.fullmatch(r"/api/tasks/([^/]+)/runs", parsed.path)
            if task_run_match:
                run = start_task_run(
                    self.home,
                    payload["project_id"],
                    payload["requirement_id"],
                    urllib.parse.unquote(task_run_match.group(1)),
                )
                self.send_json(
                    {
                        "run": run,
                        "result": {"run": run},
                    }
                )
                return
            task_review_match = re.fullmatch(r"/api/tasks/([^/]+)/manual-review", parsed.path)
            if task_review_match:
                self.send_json(
                    {
                        "review": record_manual_review(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            urllib.parse.unquote(task_review_match.group(1)),
                            payload["reviewer"],
                            payload["result"],
                            payload.get("notes") or "",
                            list(payload.get("evidence_reviewed") or []),
                            payload.get("residual_risks") or "",
                            True,
                        )
                    }
                )
                return
            run_cancel_match = re.fullmatch(r"/api/runs/([^/]+)/cancel", parsed.path)
            if run_cancel_match:
                self.send_json(
                    {
                        "run": cancel_run(
                            self.home,
                            urllib.parse.unquote(run_cancel_match.group(1)),
                            payload.get("reason") or "canceled by user",
                        )
                    }
                )
                return
            if self.path == "/api/projects/register":
                project_root = Path(payload["project_root"]).expanduser().resolve()
                plugin_root = Path(payload.get("plugin_root") or PLUGIN_ROOT).expanduser().resolve()
                name = payload.get("project_name") or project_root.name
                self.send_json({"project": save_project(self.home, project_root, name, plugin_root)})
                return
            if self.path == "/api/projects/delete":
                self.send_json({"project": remove_project(self.home, payload["project_id"])})
                return
            if self.path == "/api/projects/refresh":
                self.send_json({"refresh": refresh_project(self.home, payload["project_id"])})
                return
            if self.path == "/api/requirements/refresh":
                self.send_json({"refresh": refresh_requirement(self.home, payload["project_id"], payload["requirement_id"])})
                return
            if self.path == "/api/requirements/import":
                project = find_project(self.home, payload["project_id"])
                if not project:
                    raise ValueError(f"Unknown project: {payload['project_id']}")
                requirement_path = Path(payload["requirement_path"]).expanduser().resolve()
                self.send_json({"import": import_requirement(self.home, project, requirement_path)})
                return
            if self.path == "/api/tasks/update_status":
                self.send_json(
                    {
                        "task": update_task_status(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload["task_id"],
                            payload["status"],
                            bool(payload.get("auto_acceptable")),
                            payload.get("reason"),
                        )
                    }
                )
                return
            if self.path == "/api/tasks/move":
                self.send_json(
                    {
                        "task": update_task_status(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload["task_id"],
                            payload["status"],
                            bool(payload.get("auto_acceptable")),
                            payload.get("reason"),
                        )
                    }
                )
                return
            if self.path == "/api/tasks/update_order":
                self.send_json(
                    {
                        "order": update_task_order(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            list(payload.get("task_ids") or []),
                        )
                    }
                )
                return
            if self.path == "/api/acceptance/update_status":
                self.send_json(
                    {
                        "acceptance": update_acceptance_status(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload["acceptance_id"],
                            payload["status"],
                        )
                    }
                )
                return
            if self.path == "/api/evidence/record":
                self.send_json(
                    {
                        "evidence": record_evidence(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload.get("task_id"),
                            payload["kind"],
                            payload.get("summary") or "",
                            payload.get("path"),
                            payload.get("payload") or {},
                            payload.get("acceptance_id"),
                        )
                    }
                )
                return
            if self.path == "/api/evidence/discover":
                self.send_json(
                    {
                        "evidence": discover_evidence(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                        )
                    }
                )
                return
            if self.path == "/api/reviews/record_manual_review":
                self.send_json(
                    {
                        "review": record_manual_review(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload["task_id"],
                            payload["reviewer"],
                            payload["result"],
                            payload.get("notes") or "",
                            list(payload.get("evidence_reviewed") or []),
                            payload.get("residual_risks") or "",
                            True,
                        )
                    }
                )
                return
            if self.path == "/api/runs/create":
                self.send_json(
                    {
                        "run": create_run(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload["task_id"],
                            payload.get("worktree_path"),
                        )
                    }
                )
                return
            if self.path == "/api/runs/append_event":
                self.send_json(
                    {
                        "event": append_run_event(
                            self.home,
                            payload["run_id"],
                            payload["event_type"],
                            payload.get("message") or "",
                            payload.get("payload") or {},
                        )
                    }
                )
                return
            if self.path == "/api/runs/finish":
                self.send_json(
                    {
                        "run": finish_run(
                            self.home,
                            payload["run_id"],
                            payload["status"],
                            payload.get("summary") or "",
                        )
                    }
                )
                return
            if self.path == "/api/runs/execute_ready_task":
                self.send_json(
                    {
                        "result": execute_ready_task(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            payload["task_id"],
                        )
                    }
                )
                return
            if self.path == "/api/exports/linear":
                self.send_json(
                    {
                        "export": export_linear(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            bool(payload.get("dry_run", True)),
                        )
                    }
                )
                return
            if self.path == "/api/exports/obsidian":
                self.send_json(
                    {
                        "export": export_obsidian(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                        )
                    }
                )
                return
            if self.path == "/api/exports/lark":
                self.send_json(
                    {
                        "export": export_lark_report(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                        )
                    }
                )
                return
        except Exception as error:  # noqa: BLE001
            self.send_json({"error": str(error)}, 400)
            return
        self.send_json({"error": "not found"}, 404)

    def do_PATCH(self) -> None:
        try:
            payload = self.read_json_body()
            parsed = urllib.parse.urlparse(self.path)
            task_status_match = re.fullmatch(r"/api/tasks/([^/]+)/status", parsed.path)
            if task_status_match:
                self.send_json(
                    {
                        "task": update_task_status(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            urllib.parse.unquote(task_status_match.group(1)),
                            payload["status"],
                            bool(payload.get("auto_acceptable")),
                            payload.get("reason"),
                        )
                    }
                )
                return
            task_order_match = re.fullmatch(r"/api/tasks/([^/]+)/order", parsed.path)
            if task_order_match:
                self.send_json(
                    {
                        "order": update_task_order(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            list(payload.get("task_ids") or []),
                        )
                    }
                )
                return
            acceptance_match = re.fullmatch(r"/api/acceptance/([^/]+)/status", parsed.path)
            if acceptance_match:
                self.send_json(
                    {
                        "acceptance": update_acceptance_status(
                            self.home,
                            payload["project_id"],
                            payload["requirement_id"],
                            urllib.parse.unquote(acceptance_match.group(1)),
                            payload["status"],
                        )
                    }
                )
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


def refresh(args: argparse.Namespace) -> int:
    home = viberig_home()
    if args.via_daemon:
        start_daemon(home, args.port)
        response = post_json(args.port, "/api/projects/refresh", {"project_id": args.project_id})
        print(json.dumps(response, indent=2, sort_keys=True))
        return 0
    print(json.dumps(refresh_project(home, args.project_id), indent=2, sort_keys=True))
    return 0


def requirements(args: argparse.Namespace) -> int:
    home = viberig_home()
    print(json.dumps({"requirements": list_requirements(home, args.project_id)}, indent=2, sort_keys=True))
    return 0


def board(args: argparse.Namespace) -> int:
    home = viberig_home()
    print(json.dumps(get_board(home, args.project_id, args.requirement_id), indent=2, sort_keys=True))
    return 0


def task_status(args: argparse.Namespace) -> int:
    home = viberig_home()
    payload = update_task_status(
        home,
        args.project_id,
        args.requirement_id,
        args.task_id,
        args.status,
        auto_acceptable=args.auto_acceptable,
        reason=args.reason,
    )
    print(json.dumps({"task": payload}, indent=2, sort_keys=True))
    return 0


def evidence(args: argparse.Namespace) -> int:
    home = viberig_home()
    payload = record_evidence(
        home,
        args.project_id,
        args.requirement_id,
        args.task_id,
        args.kind,
        args.summary or "",
        args.path,
        {},
        args.acceptance_id,
    )
    print(json.dumps({"evidence": payload}, indent=2, sort_keys=True))
    return 0


def manual_review(args: argparse.Namespace) -> int:
    home = viberig_home()
    payload = record_manual_review(
        home,
        args.project_id,
        args.requirement_id,
        args.task_id,
        args.reviewer,
        args.result,
        args.notes or "",
        args.evidence_reviewed or [],
        args.residual_risks or "",
        True,
    )
    print(json.dumps({"review": payload}, indent=2, sort_keys=True))
    return 0


def task_get(args: argparse.Namespace) -> int:
    print(
        json.dumps(
            get_task(viberig_home(), args.project_id, args.requirement_id, args.task_id),
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def evidence_list(args: argparse.Namespace) -> int:
    print(
        json.dumps(
            {
                "evidence": list_evidence(
                    viberig_home(),
                    args.project_id,
                    args.requirement_id,
                    args.task_id,
                )
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def evidence_discover(args: argparse.Namespace) -> int:
    print(
        json.dumps(
            {"evidence": discover_evidence(viberig_home(), args.project_id, args.requirement_id)},
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def run_create(args: argparse.Namespace) -> int:
    print(
        json.dumps(
            {
                "run": create_run(
                    viberig_home(),
                    args.project_id,
                    args.requirement_id,
                    args.task_id,
                    args.worktree_path,
                )
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def run_execute(args: argparse.Namespace) -> int:
    print(
        json.dumps(
            {"result": execute_ready_task(viberig_home(), args.project_id, args.requirement_id, args.task_id)},
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def run_log(args: argparse.Namespace) -> int:
    print(json.dumps(get_run_log(viberig_home(), args.run_id), indent=2, sort_keys=True))
    return 0


def run_events(args: argparse.Namespace) -> int:
    print(json.dumps({"events": list_run_events(viberig_home(), args.run_id)}, indent=2, sort_keys=True))
    return 0


def run_artifacts(args: argparse.Namespace) -> int:
    print(json.dumps(get_run_artifacts(viberig_home(), args.run_id), indent=2, sort_keys=True))
    return 0


def run_diff(args: argparse.Namespace) -> int:
    print(json.dumps(get_run_diff(viberig_home(), args.run_id), indent=2, sort_keys=True))
    return 0


def codex_session(args: argparse.Namespace) -> int:
    home = viberig_home()
    if args.kind == "transcript":
        payload = read_codex_session_file(home, args.session_id, "transcript")
    elif args.kind == "events":
        payload = read_codex_session_file(home, args.session_id, "events")
    elif args.kind == "prompt":
        payload = read_codex_session_file(home, args.session_id, "prompt")
    elif args.kind == "final":
        payload = read_codex_session_file(home, args.session_id, "final")
    else:
        payload = {"codex_session": get_codex_session(home, args.session_id)}
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def export(args: argparse.Namespace) -> int:
    home = viberig_home()
    if args.kind == "linear":
        payload = export_linear(home, args.project_id, args.requirement_id, dry_run=args.dry_run)
    elif args.kind == "obsidian":
        payload = export_obsidian(home, args.project_id, args.requirement_id)
    else:
        payload = export_lark_report(home, args.project_id, args.requirement_id)
    print(json.dumps({"export": payload}, indent=2, sort_keys=True))
    return 0


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

    mcp_parser = subparsers.add_parser("mcp")
    mcp_parser.set_defaults(func=mcp)

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

    refresh_parser = subparsers.add_parser("refresh")
    refresh_parser.add_argument("project_id")
    refresh_parser.add_argument("--via-daemon", action="store_true")
    refresh_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    refresh_parser.set_defaults(func=refresh)

    requirements_parser = subparsers.add_parser("requirements")
    requirements_parser.add_argument("--project-id")
    requirements_parser.set_defaults(func=requirements)

    board_parser = subparsers.add_parser("board")
    board_parser.add_argument("project_id")
    board_parser.add_argument("requirement_id")
    board_parser.set_defaults(func=board)

    task_status_parser = subparsers.add_parser("task-status")
    task_status_parser.add_argument("project_id")
    task_status_parser.add_argument("requirement_id")
    task_status_parser.add_argument("task_id")
    task_status_parser.add_argument("status", choices=sorted(TASK_STATES))
    task_status_parser.add_argument("--auto-acceptable", action="store_true")
    task_status_parser.add_argument("--reason")
    task_status_parser.set_defaults(func=task_status)

    task_get_parser = subparsers.add_parser("task-get")
    task_get_parser.add_argument("project_id")
    task_get_parser.add_argument("requirement_id")
    task_get_parser.add_argument("task_id")
    task_get_parser.set_defaults(func=task_get)

    evidence_parser = subparsers.add_parser("evidence")
    evidence_parser.add_argument("project_id")
    evidence_parser.add_argument("requirement_id")
    evidence_parser.add_argument("--task-id")
    evidence_parser.add_argument("--acceptance-id")
    evidence_parser.add_argument("--kind", required=True)
    evidence_parser.add_argument("--summary")
    evidence_parser.add_argument("--path")
    evidence_parser.set_defaults(func=evidence)

    evidence_list_parser = subparsers.add_parser("evidence-list")
    evidence_list_parser.add_argument("project_id")
    evidence_list_parser.add_argument("requirement_id")
    evidence_list_parser.add_argument("--task-id")
    evidence_list_parser.set_defaults(func=evidence_list)

    evidence_discover_parser = subparsers.add_parser("evidence-discover")
    evidence_discover_parser.add_argument("project_id")
    evidence_discover_parser.add_argument("requirement_id")
    evidence_discover_parser.set_defaults(func=evidence_discover)

    manual_review_parser = subparsers.add_parser("manual-review")
    manual_review_parser.add_argument("project_id")
    manual_review_parser.add_argument("requirement_id")
    manual_review_parser.add_argument("task_id")
    manual_review_parser.add_argument("--reviewer", required=True)
    manual_review_parser.add_argument("--result", required=True, choices=["accepted", "rejected"])
    manual_review_parser.add_argument("--notes")
    manual_review_parser.add_argument("--evidence-reviewed", action="append")
    manual_review_parser.add_argument("--residual-risks")
    manual_review_parser.set_defaults(func=manual_review)

    run_create_parser = subparsers.add_parser("run-create")
    run_create_parser.add_argument("project_id")
    run_create_parser.add_argument("requirement_id")
    run_create_parser.add_argument("task_id")
    run_create_parser.add_argument("--worktree-path")
    run_create_parser.set_defaults(func=run_create)

    run_execute_parser = subparsers.add_parser("run-execute")
    run_execute_parser.add_argument("project_id")
    run_execute_parser.add_argument("requirement_id")
    run_execute_parser.add_argument("task_id")
    run_execute_parser.set_defaults(func=run_execute)

    run_log_parser = subparsers.add_parser("run-log")
    run_log_parser.add_argument("run_id")
    run_log_parser.set_defaults(func=run_log)

    run_events_parser = subparsers.add_parser("run-events")
    run_events_parser.add_argument("run_id")
    run_events_parser.set_defaults(func=run_events)

    run_artifacts_parser = subparsers.add_parser("run-artifacts")
    run_artifacts_parser.add_argument("run_id")
    run_artifacts_parser.set_defaults(func=run_artifacts)

    run_diff_parser = subparsers.add_parser("run-diff")
    run_diff_parser.add_argument("run_id")
    run_diff_parser.set_defaults(func=run_diff)

    codex_session_parser = subparsers.add_parser("codex-session")
    codex_session_parser.add_argument("session_id")
    codex_session_parser.add_argument("--kind", choices=["metadata", "prompt", "transcript", "events", "final"], default="metadata")
    codex_session_parser.set_defaults(func=codex_session)

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("kind", choices=["linear", "obsidian", "lark"])
    export_parser.add_argument("project_id")
    export_parser.add_argument("requirement_id")
    export_parser.add_argument("--dry-run", action="store_true")
    export_parser.set_defaults(func=export)

    stop_parser = subparsers.add_parser("stop")
    stop_parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    stop_parser.set_defaults(func=stop)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
