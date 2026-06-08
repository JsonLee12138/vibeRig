from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INIT_PROJECT_PATH = ROOT / "scripts" / "init_project.py"
AUDIT_PLAN_PATH = ROOT / "scripts" / "audit_linear_native_plan.py"


def load_init_project_module():
    spec = importlib.util.spec_from_file_location("init_project", INIT_PROJECT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load init_project module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class InitProjectTest(unittest.TestCase):
    def test_plugin_is_skill_only_without_viberig_mcp_server(self) -> None:
        import json

        plugin_manifest = json.loads((ROOT / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))

        self.assertNotIn("mcpServers", plugin_manifest)
        self.assertEqual(plugin_manifest["skills"], "./skills/")

    def test_init_writes_linear_native_project_yaml_and_keeps_codex_config_unmanaged(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            project_root = Path(temp) / "project"
            codex_config = project_root / ".codex" / "config.toml"
            codex_config.parent.mkdir(parents=True)
            codex_config.write_text(
                """
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"

[mcp_servers.stitch.http_headers]
"X-Goog-Api-Key" = "redacted"
""".lstrip(),
                encoding="utf-8",
            )

            command = [
                sys.executable,
                str(INIT_PROJECT_PATH),
                str(project_root),
                "--project-name",
                "Example",
                "--linear-team-id",
                "team-123",
                "--linear-project-id",
                "project-123",
                "--test-command",
                "npm test",
            ]
            subprocess.run(command, check=True, cwd=ROOT)
            subprocess.run(command, check=True, cwd=ROOT)

            content = codex_config.read_text(encoding="utf-8")
            self.assertIn("[mcp_servers.stitch]", content)
            self.assertIn("[mcp_servers.stitch.http_headers]", content)
            self.assertNotIn("[features]", content)
            self.assertNotIn("hooks = true", content)
            self.assertNotIn("[mcp_servers.viberig]", content)

            project_yaml = (project_root / ".vibeRig" / "project.yaml").read_text(encoding="utf-8")
            self.assertIn('name: "Example"', project_yaml)
            self.assertIn('root: ".vibeRig/requirements"', project_yaml)
            self.assertIn('worktrees_root: ".worktrees"', project_yaml)
            self.assertIn("pull_request:", project_yaml)
            self.assertIn('required: "true"', project_yaml)
            self.assertIn('provider: "auto"', project_yaml)
            self.assertIn('draft: "false"', project_yaml)
            self.assertIn('team_id: "team-123"', project_yaml)
            self.assertIn('project_id: "project-123"', project_yaml)
            self.assertIn('ci_required: "project_decides"', project_yaml)
            self.assertIn('- "npm test"', project_yaml)
            self.assertIn("main_agent_only: true", project_yaml)
            self.assertNotIn("codex-cli-mcp", project_yaml)
            self.assertFalse((project_root / ".vibeRig" / "config.yaml").exists())
            self.assertTrue((project_root / ".vibeRig" / "requirements").is_dir())
            self.assertTrue((project_root / ".worktrees").is_dir())

    def test_existing_project_yaml_is_migrated_with_required_sections(self) -> None:
        module = load_init_project_module()
        with tempfile.TemporaryDirectory() as temp:
            project_root = Path(temp) / "project"
            project_yaml = project_root / ".vibeRig" / "project.yaml"
            project_yaml.parent.mkdir(parents=True)
            project_yaml.write_text("version: 1\nproject:\n  name: Existing\n", encoding="utf-8")

            self.assertTrue(module.ensure_project_yaml(project_yaml, "ignored"))
            content = project_yaml.read_text(encoding="utf-8")

            self.assertIn("docs:", content)
            self.assertIn("workspace:", content)
            self.assertIn("pull_request:", content)
            self.assertIn("linear:", content)
            self.assertIn("gate_policy:", content)
            self.assertIn("subagents:", content)
            self.assertIn("context_mode:", content)

    def test_linear_native_plan_audit_passes(self) -> None:
        result = subprocess.run(
            [sys.executable, str(AUDIT_PLAN_PATH)],
            check=False,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, msg=result.stdout + result.stderr)
        self.assertIn("Linear-native redesign local audit passed.", result.stdout)


if __name__ == "__main__":
    unittest.main()
