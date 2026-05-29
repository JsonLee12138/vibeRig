from __future__ import annotations

import json
import os
import tempfile
import threading
import urllib.request
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api import server as viberig_service


class VibeRigCodexRunnerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.project_root = self.root / "project"
        self.requirement_root = self.project_root / ".vibeRig" / "requirements" / "REQ-CODEX"
        self.requirement_root.mkdir(parents=True)
        os.environ["VIBERIG_HOME"] = str(self.home)
        os.environ["VIBERIG_CODEX_ADAPTER"] = "fake"
        self.project = viberig_service.save_project(
            self.home,
            self.project_root,
            "Runner",
            ROOT,
        )
        (self.requirement_root / "acceptance.md").write_text(
            "# Acceptance\n\n## AC-1: Runner implements before validation\n",
            encoding="utf-8",
        )
        (self.requirement_root / "roadmap.md").write_text("# Roadmap\n\n## R1: Runner\n", encoding="utf-8")
        (self.requirement_root / "tasks.yaml").write_text(
            """
requirement_id: REQ-CODEX
title: Codex runner
tasks:
  - id: T1
    title: Implement runner task
    type: backend
    suggested_agent: implementer
    acceptance_agent: acceptor
    review_agent: reviewer
    priority: 1
    depends_on: []
    branch: viberig/req-codex-t1
    worktree_hint: ./worktrees/REQ-CODEX-T1
    scope:
      include: ["api/server.py"]
      exclude: ["~/.viberig"]
    acceptance_refs: ["AC-1"]
    roadmap_id: R1
    validation: ["python3 -c \\"print('validation ok')\\""]
    review:
      ai_review_required: true
      human_runtime_check: manual
""".lstrip(),
            encoding="utf-8",
        )
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)

    def tearDown(self) -> None:
        for key in [
            "VIBERIG_CODEX_ADAPTER",
            "VIBERIG_CODEX_COMMAND",
            "VIBERIG_CODEX_MCP_COMMAND",
            "VIBERIG_CODEX_MCP_TOOL",
            "VIBERIG_CODEX_FULL_AUTO",
            "VIBERIG_CODEX_CALLBACK_URI",
            "VIBERIG_FAKE_CODEX_STATUS",
            "VIBERIG_FAKE_CODEX_WRITE_FILE",
            "VIBERIG_FAKE_MCP_CAPTURE",
            "VIBERIG_HOME",
            "VIBERIG_TEST_ROOT",
            "VIBERIG_TEST_PROJECT_ID",
            "VIBERIG_TEST_REQUIREMENT_ID",
            "VIBERIG_TEST_TASK_ID",
            "CODEX_HOME",
        ]:
            os.environ.pop(key, None)
        self.temp.cleanup()

    def ready_task(self) -> None:
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-CODEX", "T1", "ready")

    def test_codex_model_defaults_to_user_codex_config_then_gpt_55(self) -> None:
        codex_home = self.root / "codex-home"
        codex_home.mkdir()
        os.environ["CODEX_HOME"] = str(codex_home)

        self.assertEqual(viberig_service.codex_runner_config(self.project_root)["model"], "gpt-5.5")
        self.assertEqual(viberig_service.codex_runner_config(self.project_root)["enable_features"], ["hooks"])

        (codex_home / "config.toml").write_text('model = "gpt-user-config"\n', encoding="utf-8")
        self.assertEqual(viberig_service.codex_runner_config(self.project_root)["model"], "gpt-user-config")

    def test_runner_persists_codex_session_prompt_events_diff_and_self_acceptance(self) -> None:
        self.ready_task()

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        run_id = result["run"]["id"]
        run = viberig_service.get_run(self.home, run_id)
        events = viberig_service.list_run_events(self.home, run_id)
        event_types = [event["event_type"] for event in events]
        session = run["codex_session"]
        artifacts = run["artifacts"]

        self.assertEqual(result["run"]["status"], "success")
        self.assertEqual(result["run"]["implementation_status"], "success")
        self.assertIsNotNone(session)
        self.assertEqual(session["adapter"], "fake")
        self.assertIn("codex_completed", event_types)
        self.assertIn("validation_started", event_types)
        self.assertLess(event_types.index("codex_completed"), event_types.index("validation_started"))
        self.assertTrue(Path(artifacts["paths"]["prompt"]).exists())
        self.assertTrue(Path(artifacts["paths"]["events"]).exists())
        self.assertTrue(Path(artifacts["paths"]["final"]).exists())
        self.assertTrue(Path(artifacts["paths"]["changed_files"]).exists())
        self.assertTrue(Path(artifacts["paths"]["diff"]).exists())

        prompt = Path(artifacts["paths"]["prompt"]).read_text(encoding="utf-8")
        self.assertIn(f"- project_id: {self.project['id']}", prompt)
        self.assertIn("Implement runner task", prompt)
        self.assertIn("worktree_path", prompt)
        self.assertIn("base_ref: origin/main", prompt)
        self.assertIn("Do not edit any file under `.vibeRig/`", prompt)
        self.assertIn("task state is owned by the VibeRig backend database", prompt)
        self.assertIn("AC-1", prompt)
        self.assertIn("python3 -c", prompt)
        self.assertIn("hooks = true", (self.project_root / ".codex" / "config.toml").read_text(encoding="utf-8"))

        evidence_path = self.requirement_root / "evidence" / "T1" / "self-acceptance.md"
        evidence = evidence_path.read_text(encoding="utf-8")
        self.assertIn(run_id, evidence)
        self.assertIn(session["id"], evidence)
        self.assertIn("Adapter: `fake`", evidence)

    def test_fake_adapter_blocked_skips_validation_and_marks_task_blocked(self) -> None:
        os.environ["VIBERIG_FAKE_CODEX_STATUS"] = "input_required"
        self.ready_task()

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        events = viberig_service.list_run_events(self.home, result["run"]["id"])
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-CODEX", "T1")

        self.assertEqual(result["run"]["status"], "blocked")
        self.assertEqual(detail["task"]["status"], "blocked")
        self.assertNotIn("validation_started", [event["event_type"] for event in events])
        self.assertIn("input required", result["run"]["summary"])

    def test_blocked_task_resume_reuses_existing_codex_session(self) -> None:
        os.environ["VIBERIG_FAKE_CODEX_STATUS"] = "input_required"
        self.ready_task()

        blocked = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        blocked_session_id = blocked["codex"]["session_id"]
        os.environ["VIBERIG_FAKE_CODEX_STATUS"] = "success"

        result = viberig_service.execute_blocked_task_resume(
            self.home,
            self.project["id"],
            "REQ-CODEX",
            "T1",
            "credentials are now available",
        )
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        events = viberig_service.list_run_events(self.home, blocked["run"]["id"])
        event_types = [event["event_type"] for event in events]
        resumed_session = viberig_service.get_codex_session(self.home, blocked_session_id)

        self.assertEqual(result["run"]["status"], "success")
        self.assertEqual(detail["task"]["status"], "human_review")
        self.assertEqual(result["codex"]["session_id"], blocked_session_id)
        self.assertIn("resume_started", event_types)
        self.assertIn("codex_session_resumed", event_types)
        self.assertIn("codex-resume-prompt.md", resumed_session["prompt_path"])
        self.assertIn(
            "credentials are now available",
            Path(resumed_session["prompt_path"]).read_text(encoding="utf-8"),
        )

    def test_manual_validation_moves_task_to_human_review_not_failed(self) -> None:
        task_file = self.requirement_root / "tasks.yaml"
        task_file.write_text(
            task_file.read_text(encoding="utf-8").replace(
                'validation: ["python3 -c \\"print(\'validation ok\')\\""]',
                'validation:\n      - "python3 -c \\"print(\'validation ok\')\\""\n      - Manual: "confirm SOUL write boundaries"',
            ),
            encoding="utf-8",
        )
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        self.ready_task()

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        event_types = [event["event_type"] for event in viberig_service.list_run_events(self.home, result["run"]["id"])]

        self.assertEqual(result["run"]["status"], "success")
        self.assertEqual(detail["task"]["status"], "human_review")
        self.assertIn("human review is pending", result["run"]["summary"])
        self.assertIn("manual_validation_required", event_types)

    def test_mcp_adapter_uses_codex_cli_mcp_arguments_and_persists_thread_id(self) -> None:
        fake_mcp = self.root / "fake_codex_mcp.py"
        capture_path = self.root / "mcp-capture.json"
        fake_mcp.write_text(
            """
from __future__ import annotations
import json
import os
import sys
from pathlib import Path

ROOT = Path(os.environ["VIBERIG_TEST_ROOT"])
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from api import server as viberig_service

def read_message():
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line)

def write_message(payload):
    sys.stdout.write(json.dumps(payload) + "\\n")
    sys.stdout.flush()

while True:
    message = read_message()
    if message is None:
        break
    method = message.get("method")
    if method == "initialize":
        write_message({"jsonrpc": "2.0", "id": message["id"], "result": {"protocolVersion": "2025-06-18", "capabilities": {}, "serverInfo": {"name": "fake-codex-mcp", "version": "0.1.0"}}})
    elif method == "tools/call":
        params = message.get("params") or {}
        arguments = params.get("arguments") or {}
        prompt = arguments.get("prompt") or ""
        write_message({"jsonrpc": "2.0", "method": "codex/event", "params": {"_meta": {"requestId": message["id"], "threadId": "thread-mcp-1"}, "msg": {"type": "session_configured", "thread_id": "thread-mcp-1"}}})
        capture = {
            "server_cwd": os.getcwd(),
            "params": params,
        }
        captures = []
        if os.path.exists(os.environ["VIBERIG_FAKE_MCP_CAPTURE"]):
            with open(os.environ["VIBERIG_FAKE_MCP_CAPTURE"], "r", encoding="utf-8") as handle:
                captures = json.load(handle)
        captures.append(capture)
        with open(os.environ["VIBERIG_FAKE_MCP_CAPTURE"], "w", encoding="utf-8") as handle:
            json.dump(captures, handle, sort_keys=True)
        if "Acceptance Review Prompt" in prompt:
            home = Path(os.environ["VIBERIG_HOME"])
            project_id = os.environ["VIBERIG_TEST_PROJECT_ID"]
            requirement_id = os.environ["VIBERIG_TEST_REQUIREMENT_ID"]
            task_id = os.environ["VIBERIG_TEST_TASK_ID"]
            viberig_service.update_acceptance_status(home, project_id, requirement_id, "AC-1", "passed")
            viberig_service.record_manual_review(
                home,
                project_id,
                requirement_id,
                task_id,
                "reviewer",
                "accepted",
                "fake MCP acceptance review accepted the task",
                [],
                "",
            )
        write_message({
            "jsonrpc": "2.0",
            "id": message["id"],
            "result": {
                "structuredContent": {
                    "usage": {"output_tokens": 3},
                },
                "content": [{"type": "text", "text": "MCP final", "_meta": {"threadId": "thread-mcp-1"}}],
            },
        })
""".lstrip(),
            encoding="utf-8",
        )
        os.environ["VIBERIG_CODEX_ADAPTER"] = "codex-cli-mcp"
        os.environ["VIBERIG_CODEX_MCP_COMMAND"] = f"{sys.executable} {fake_mcp}"
        os.environ["VIBERIG_FAKE_MCP_CAPTURE"] = str(capture_path)
        os.environ["VIBERIG_TEST_ROOT"] = str(ROOT)
        os.environ["VIBERIG_TEST_PROJECT_ID"] = self.project["id"]
        os.environ["VIBERIG_TEST_REQUIREMENT_ID"] = "REQ-CODEX"
        os.environ["VIBERIG_TEST_TASK_ID"] = "T1"
        self.ready_task()

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        run = viberig_service.get_run(self.home, result["run"]["id"])
        session = run["codex_session"]
        final = Path(session["final_message_path"]).read_text(encoding="utf-8")
        captures = json.loads(capture_path.read_text(encoding="utf-8"))
        capture = captures[0]
        arguments = capture["params"]["arguments"]

        self.assertEqual(result["run"]["status"], "success")
        self.assertEqual(session["adapter"], "codex-cli-mcp")
        self.assertEqual(session["thread_id"], "thread-mcp-1")
        self.assertIn("MCP final", final)
        self.assertEqual(run["run"]["codex_exit_code"], 0)
        self.assertEqual(capture["params"]["name"], "codex")
        self.assertEqual(arguments["workingDirectory"], run["run"]["worktree_path"])
        self.assertEqual(arguments["sessionId"], viberig_service.codex_mcp_session_id(session["id"]))
        self.assertNotIn(":", arguments["sessionId"])
        self.assertEqual(arguments["sandbox"], "workspace-write")
        self.assertNotIn("cwd", arguments)
        self.assertNotIn("approval-policy", arguments)
        self.assertNotIn("config", arguments)
        self.assertNotIn("enableFeatures", arguments)
        self.assertIn("--enable hooks", viberig_service.get_run_log(self.home, result["run"]["id"])["log"])

    def test_mcp_adapter_treats_tool_is_error_as_failure(self) -> None:
        fake_mcp = self.root / "fake_codex_mcp_error.py"
        fake_mcp.write_text(
            """
from __future__ import annotations
import json
import sys

def read_message():
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line)

def write_message(payload):
    sys.stdout.write(json.dumps(payload) + "\\n")
    sys.stdout.flush()

while True:
    message = read_message()
    if message is None:
        break
    method = message.get("method")
    if method == "initialize":
        write_message({"jsonrpc": "2.0", "id": message["id"], "result": {"protocolVersion": "2025-06-18", "capabilities": {}, "serverInfo": {"name": "fake-codex-mcp", "version": "0.1.0"}}})
    elif method == "tools/call":
        write_message({
            "jsonrpc": "2.0",
            "id": message["id"],
            "result": {
                "content": [{"type": "text", "text": "schema validation failed"}],
                "isError": True,
            },
        })
""".lstrip(),
            encoding="utf-8",
        )
        os.environ["VIBERIG_CODEX_ADAPTER"] = "codex-cli-mcp"
        os.environ["VIBERIG_CODEX_MCP_COMMAND"] = f"{sys.executable} {fake_mcp}"
        self.ready_task()

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        run = viberig_service.get_run(self.home, result["run"]["id"])
        session = run["codex_session"]
        final = Path(session["final_message_path"]).read_text(encoding="utf-8")

        self.assertEqual(result["run"]["status"], "failed")
        self.assertEqual(session["status"], "failed")
        self.assertIn("schema validation failed", final)
        self.assertEqual(run["run"]["codex_exit_code"], 1)

    def test_cli_adapter_is_rejected_for_real_runs(self) -> None:
        os.environ["VIBERIG_CODEX_ADAPTER"] = "cli"
        self.ready_task()

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        run = viberig_service.get_run(self.home, result["run"]["id"])

        self.assertEqual(result["run"]["status"], "failed")
        self.assertEqual(run["run"]["codex_adapter"], "cli")
        self.assertIn("CLI adapter is disabled", run["run"]["summary"])

    def test_http_and_mcp_run_investigation_surface(self) -> None:
        self.ready_task()
        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-CODEX", "T1")
        run_id = result["run"]["id"]
        session_id = result["run"]["codex_session_id"]

        self.assertTrue(viberig_service.call_mcp_tool(self.home, "viberig.runs.events", {"run_id": run_id})["events"])
        self.assertTrue(viberig_service.call_mcp_tool(self.home, "viberig.runs.artifacts", {"run_id": run_id})["paths"])
        self.assertIn("codex_session", viberig_service.call_mcp_tool(self.home, "viberig.codex_sessions.for_run", {"run_id": run_id}))
        resources = viberig_service.mcp_resources(self.home)
        self.assertTrue(any(item["uri"] == f"viberig://runs/{run_id}/artifacts" for item in resources))
        self.assertTrue(viberig_service.read_mcp_resource(self.home, f"viberig://codex-sessions/{session_id}/transcript")["content"])

        viberig_service.Handler.home = self.home
        viberig_service.Handler.port = 0
        server = ThreadingHTTPServer(("127.0.0.1", 0), viberig_service.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}"
            for suffix in ["", "/events", "/artifacts", "/diff", "/codex-session"]:
                with urllib.request.urlopen(f"{base}/api/runs/{run_id}{suffix}") as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self.assertTrue(payload)
            with urllib.request.urlopen(f"{base}/api/codex-sessions/{session_id}/transcript") as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertIn("content", payload)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
