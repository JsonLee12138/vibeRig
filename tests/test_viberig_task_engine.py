from __future__ import annotations

import json
import os
import subprocess
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


class VibeRigTaskEngineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.project_root = self.root / "project"
        self.requirement_root = self.project_root / ".vibeRig" / "requirements" / "REQ-1"
        self.requirement_root.mkdir(parents=True)
        os.environ["VIBERIG_CODEX_ADAPTER"] = "fake"
        self.project = viberig_service.save_project(
            self.home,
            self.project_root,
            "Example",
            Path(__file__).resolve().parents[1],
        )
        (self.requirement_root / "acceptance.md").write_text(
            "# Acceptance\n\n## AC-1: Import board\n\n## AC-2: Review evidence\n",
            encoding="utf-8",
        )
        (self.requirement_root / "roadmap.md").write_text("# Roadmap\n\n## R1: Local board foundation\n", encoding="utf-8")
        (self.requirement_root / "tasks.yaml").write_text(
            """
requirement_id: REQ-1
title: Local board
source_docs:
  requirement: requirement.md
  research: research.md
  acceptance: acceptance.md
  roadmap: roadmap.md
  spec: spec.md
  plan: plan.md
base_policy:
  default_base: origin/main
  worktree_root: ./worktrees
  require_fetch_before_worktree: true
  require_base_sha_record: true
  require_sync_before_pr: true
agents:
  task_splitter: default
  implementation_default: default
  acceptance_default: default
  code_review_default: default
tasks:
  - id: T1
    title: Build database
    type: backend
    suggested_agent: default
    acceptance_agent: default
    review_agent: default
    priority: 1
    depends_on: []
    parallelizable: false
    branch: viberig/req-1-t1
    worktree_hint: ./worktrees/req-1-t1
    scope:
      include: ["api/server.py"]
      exclude: []
    acceptance_refs: ["AC-1"]
    roadmap_id: R1
    validation: ["python3 -c \\"print('ok')\\""]
    review:
      ai_review_required: true
      human_runtime_check: manual
    linear:
      parent: REQ-1
      labels: []
  - id: T2
    title: Review flow
    type: backend
    suggested_agent: default
    acceptance_agent: default
    review_agent: default
    priority: 2
    depends_on: ["T1"]
    parallelizable: false
    branch: viberig/req-1-t2
    worktree_hint: ./worktrees/req-1-t2
    scope:
      include: ["api/server.py"]
      exclude: []
    acceptance_refs: ["AC-2"]
    roadmap_id: R1
    validation: ["python3 -c \\"print('ok')\\""]
    review:
      ai_review_required: true
      human_runtime_check: manual
    linear:
      parent: REQ-1
      labels: []
""".lstrip(),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        os.environ.pop("VIBERIG_CODEX_ADAPTER", None)
        os.environ.pop("VIBERIG_FAKE_CODEX_WRITE_FILE", None)
        self.temp.cleanup()

    def initialize_git_with_origin_main(self, include_viberig: bool = False) -> None:
        origin = self.root / "origin.git"
        subprocess.run(["git", "init", "--bare", str(origin)], check=True, capture_output=True)
        subprocess.run(["git", "init"], cwd=self.project_root, check=True, capture_output=True)
        subprocess.run(["git", "checkout", "-b", "main"], cwd=self.project_root, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=self.project_root, check=True)
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=self.project_root, check=True)
        (self.project_root / "README.md").write_text("# Example\n", encoding="utf-8")
        paths = ["README.md"]
        if include_viberig:
            paths.append(".vibeRig")
        subprocess.run(["git", "add", *paths], cwd=self.project_root, check=True)
        subprocess.run(["git", "commit", "-m", "initial"], cwd=self.project_root, check=True, capture_output=True)
        subprocess.run(["git", "remote", "add", "origin", str(origin)], cwd=self.project_root, check=True)
        subprocess.run(["git", "push", "-u", "origin", "main"], cwd=self.project_root, check=True, capture_output=True)

    def test_import_board_and_acceptance_flow(self) -> None:
        result = viberig_service.import_requirement(self.home, self.project, self.requirement_root)

        self.assertEqual(result["tasks_imported"], 2)
        board = viberig_service.get_board(self.home, self.project["id"], "REQ-1")
        self.assertEqual(len(board["tasks"]), 2)
        self.assertEqual({item["acceptance_id"] for item in board["acceptance_items"]}, {"AC-1", "AC-2"})

        with self.assertRaisesRegex(ValueError, "dependencies"):
            viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T2", "ready")

        viberig_service.record_evidence(
            self.home,
            self.project["id"],
            "REQ-1",
            "T1",
            "self_acceptance",
            "validation passed",
        )
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "running")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "self_accepted")

        with self.assertRaisesRegex(ValueError, "manual review"):
            viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "accepted")

        viberig_service.record_manual_review(
            self.home,
            self.project["id"],
            "REQ-1",
            "T1",
            "tester",
            "accepted",
            evidence_reviewed=["self_acceptance"],
            apply_task_status=True,
        )
        ready = viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T2", "ready")
        self.assertEqual(ready["status"], "ready")

    def test_reimport_preserves_state_and_records_source_revisions(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.record_evidence(self.home, self.project["id"], "REQ-1", "T1", "validation")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "running")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "self_accepted")

        result = viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        board = viberig_service.get_board(self.home, self.project["id"], "REQ-1")
        task = next(item for item in board["tasks"] if item["task_id"] == "T1")
        requirement = viberig_service.get_requirement(self.home, self.project["id"], "REQ-1")

        self.assertEqual(result["roadmap_items_imported"], 1)
        self.assertEqual(task["status"], "self_accepted")
        self.assertEqual({item["source_name"] for item in requirement["source_revisions"]}, {"tasks", "roadmap", "acceptance"})
        self.assertEqual(requirement["roadmap_items"][0]["roadmap_id"], "R1")

    def test_reimport_marks_changed_accepted_task_definition_stale_without_losing_state(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.record_evidence(self.home, self.project["id"], "REQ-1", "T1", "validation")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "running")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "self_accepted")

        tasks_path = self.requirement_root / "tasks.yaml"
        tasks_path.write_text(
            tasks_path.read_text(encoding="utf-8").replace("title: Build database", "title: Build durable database"),
            encoding="utf-8",
        )

        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        board = viberig_service.get_board(self.home, self.project["id"], "REQ-1")
        task = next(item for item in board["tasks"] if item["task_id"] == "T1")
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-1", "T1")

        self.assertEqual(task["status"], "self_accepted")
        self.assertTrue(task["definition_stale"])
        self.assertTrue(task["definition_changed_at"])
        self.assertTrue(any(item["event_type"] == "task.definition_changed" for item in detail["activity"]))

        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready", reason="rerun changed task")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "running")
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-1", "T1")
        self.assertFalse(detail["task"]["definition_stale"])

    def test_requirement_refresh_endpoint_resyncs_selected_requirement(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        board = viberig_service.get_board(self.home, self.project["id"], "REQ-1")
        self.assertTrue(next(item for item in board["tasks"] if item["task_id"] == "T1")["validation"])

        tasks_path = self.requirement_root / "tasks.yaml"
        updated_lines = [
            f"{line[: len(line) - len(line.lstrip())]}validation: []" if line.lstrip().startswith("validation:") else line
            for line in tasks_path.read_text(encoding="utf-8").splitlines()
        ]
        tasks_path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")

        viberig_service.Handler.home = self.home
        viberig_service.Handler.port = 0
        server = ThreadingHTTPServer(("127.0.0.1", 0), viberig_service.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            request = urllib.request.Request(
                f"http://127.0.0.1:{server.server_port}/api/requirements/refresh",
                data=json.dumps({"project_id": self.project["id"], "requirement_id": "REQ-1"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request) as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(payload["refresh"]["requirement_id"], "REQ-1")
        finally:
            server.shutdown()
            server.server_close()

        board = viberig_service.get_board(self.home, self.project["id"], "REQ-1")
        self.assertEqual(next(item for item in board["tasks"] if item["task_id"] == "T1")["validation"], [])

    def test_task_detail_activity_evidence_discovery_and_exports(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        evidence_dir = self.requirement_root / "evidence" / "T1"
        evidence_dir.mkdir(parents=True)
        (evidence_dir / "validation.json").write_text('[{"command": "test", "exit_code": 0}]', encoding="utf-8")
        (evidence_dir / "self-acceptance.md").write_text("# Self Acceptance\n", encoding="utf-8")

        discovered = viberig_service.discover_evidence(self.home, self.project["id"], "REQ-1")
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-1", "T1")
        linear = viberig_service.export_linear(self.home, self.project["id"], "REQ-1", dry_run=True)
        obsidian = viberig_service.export_obsidian(self.home, self.project["id"], "REQ-1")
        lark = viberig_service.export_lark_report(self.home, self.project["id"], "REQ-1")

        self.assertEqual(len(discovered["recorded"]), 2)
        self.assertGreaterEqual(len(detail["evidence"]), 2)
        self.assertTrue(detail["activity"])
        self.assertEqual(len(linear["items"]), 2)
        self.assertTrue(Path(obsidian["path"]).exists())
        self.assertTrue(Path(lark["path"]).exists())

    def test_runner_creates_evidence_and_moves_ready_task_to_human_review(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-1", "T1")
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-1", "T1")

        self.assertEqual(result["run"]["status"], "success")
        self.assertEqual(detail["task"]["status"], "human_review")
        self.assertTrue((self.requirement_root / "evidence" / "T1" / "self-acceptance.md").exists())
        self.assertTrue(viberig_service.get_run_log(self.home, result["run"]["id"])["log"])

    def test_manual_review_rejection_returns_task_to_ready_with_reason(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "running")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "human_review")

        review = viberig_service.record_manual_review(
            self.home,
            self.project["id"],
            "REQ-1",
            "T1",
            "tester",
            "rejected",
            notes="missing regression coverage",
            apply_task_status=True,
        )
        detail = viberig_service.get_task(self.home, self.project["id"], "REQ-1", "T1")

        self.assertEqual(review["result"], "rejected")
        self.assertEqual(detail["task"]["status"], "ready")
        self.assertEqual(detail["task"]["status_reason"], "missing regression coverage")
        self.assertTrue(
            any(
                item["event_type"] == "task.status_updated"
                and json.loads(item["payload_json"]).get("status") == "ready"
                and json.loads(item["payload_json"]).get("reason") == "missing regression coverage"
                for item in detail["activity"]
            )
        )

    def test_runner_uses_origin_main_without_copying_untracked_requirement_files(self) -> None:
        self.initialize_git_with_origin_main(include_viberig=False)

        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-1", "T1")
        worktree_path = Path(result["run"]["worktree_path"])
        events = viberig_service.list_run_events(self.home, result["run"]["id"])

        self.assertEqual(result["run"]["status"], "success")
        self.assertEqual(result["run"]["base_ref"], "origin/main")
        self.assertFalse((worktree_path / ".vibeRig" / "requirements" / "REQ-1" / "tasks.yaml").exists())
        self.assertTrue(any("origin/main" in event.get("payload_json", "") for event in events))

    def test_runner_uses_tracked_requirement_files_in_git_worktree(self) -> None:
        self.initialize_git_with_origin_main(include_viberig=True)

        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-1", "T1")
        worktree_path = Path(result["run"]["worktree_path"])

        self.assertEqual(result["run"]["status"], "success")
        self.assertTrue((worktree_path / ".vibeRig" / "requirements" / "REQ-1" / "tasks.yaml").exists())

    def test_runner_rejects_codex_changes_under_viberig_directory(self) -> None:
        self.initialize_git_with_origin_main(include_viberig=True)
        os.environ["VIBERIG_FAKE_CODEX_WRITE_FILE"] = ".vibeRig/requirements/REQ-1/tasks.yaml"

        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")

        result = viberig_service.execute_ready_task(self.home, self.project["id"], "REQ-1", "T1")
        events = viberig_service.list_run_events(self.home, result["run"]["id"])

        self.assertEqual(result["run"]["status"], "failed")
        self.assertIn("forbidden .vibeRig", result["run"]["summary"])
        self.assertIn("forbidden_changes_detected", [event["event_type"] for event in events])

    def test_transition_reasons_mcp_and_http_event_bridge(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "blocked")
        with self.assertRaisesRegex(ValueError, "requires a reason"):
            viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready", reason="unblocked")

        mcp_board = viberig_service.call_mcp_tool(
            self.home,
            "viberig.board.get",
            {"project_id": self.project["id"], "requirement_id": "REQ-1"},
        )
        self.assertEqual(len(mcp_board["board"]["tasks"]), 2)
        resources = viberig_service.mcp_resources(self.home)
        self.assertTrue(any(item["uri"].endswith("/board") for item in resources))

        viberig_service.Handler.home = self.home
        viberig_service.Handler.port = 0
        server = ThreadingHTTPServer(("127.0.0.1", 0), viberig_service.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}"
            with urllib.request.urlopen(f"{base}/api/board?project_id={self.project['id']}&requirement_id=REQ-1") as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(len(payload["board"]["tasks"]), 2)
            with urllib.request.urlopen(f"{base}/api/projects/{self.project['id']}/requirements") as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(payload["requirements"][0]["requirement_id"], "REQ-1")
            with urllib.request.urlopen(
                f"{base}/api/tasks/T1?project_id={self.project['id']}&requirement_id=REQ-1"
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(payload["task"]["task_id"], "T1")
            request = urllib.request.Request(
                f"{base}/api/tasks/T1/status",
                data=json.dumps(
                    {"project_id": self.project["id"], "requirement_id": "REQ-1", "status": "running"}
                ).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PATCH",
            )
            with urllib.request.urlopen(request) as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.assertEqual(payload["task"]["status"], "running")
            with urllib.request.urlopen(f"{base}/api/events/stream") as response:
                events = response.read().decode("utf-8")
            self.assertIn("task.status_updated", events)
        finally:
            server.shutdown()
            server.server_close()

    def test_self_accepted_task_can_return_to_ready_for_rerun(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.record_evidence(self.home, self.project["id"], "REQ-1", "T1", "validation")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "running")
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "self_accepted")

        task = viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")

        self.assertEqual(task["status"], "ready")

    def test_canceled_task_can_return_to_ready_for_rerun_with_reason(self) -> None:
        viberig_service.import_requirement(self.home, self.project, self.requirement_root)
        viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")
        viberig_service.update_task_status(
            self.home,
            self.project["id"],
            "REQ-1",
            "T1",
            "canceled",
            reason="user canceled run",
        )

        with self.assertRaises(ValueError):
            viberig_service.update_task_status(self.home, self.project["id"], "REQ-1", "T1", "ready")

        task = viberig_service.update_task_status(
            self.home,
            self.project["id"],
            "REQ-1",
            "T1",
            "ready",
            reason="rerun canceled task",
        )

        self.assertEqual(task["status"], "ready")


if __name__ == "__main__":
    unittest.main()
