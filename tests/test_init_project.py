from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
import json
import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INIT_PROJECT_PATH = ROOT / "scripts" / "init_project.py"


def load_init_project_module():
    spec = importlib.util.spec_from_file_location("init_project", INIT_PROJECT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load init_project module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class InitProjectTest(unittest.TestCase):
    def test_plugin_declares_viberig_mcp_server(self) -> None:
        plugin_manifest = json.loads((ROOT / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
        mcp_manifest = json.loads((ROOT / ".mcp.json").read_text(encoding="utf-8"))

        self.assertEqual(plugin_manifest["mcpServers"], "./.mcp.json")
        self.assertEqual(
            mcp_manifest["mcpServers"]["viberig"],
            {
                "command": "python3",
                "args": ["./api/server.py", "mcp"],
                "cwd": ".",
            },
        )

    def test_init_keeps_project_codex_config_unmanaged(self) -> None:
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
                "--skip-global-service",
            ]
            subprocess.run(command, check=True, cwd=ROOT)
            subprocess.run(command, check=True, cwd=ROOT)

            content = codex_config.read_text(encoding="utf-8")
            self.assertIn("[mcp_servers.stitch]", content)
            self.assertIn("[mcp_servers.stitch.http_headers]", content)
            self.assertIn("[features]", content)
            self.assertIn("hooks = true", content)
            self.assertEqual(content.count("hooks = true"), 1)
            self.assertNotIn("[mcp_servers.viberig]", content)

            viberig_config = (project_root / ".vibeRig" / "config.yaml").read_text(encoding="utf-8")
            self.assertIn("adapter: codex-cli-mcp", viberig_config)
            self.assertIn("mcp_command: npx -y codex-mcp-server", viberig_config)
            self.assertIn("mcp_initialize_timeout_ms: 60000", viberig_config)
            self.assertIn("mcp_tool_timeout_ms: 600000", viberig_config)

    def test_registered_project_for_root_requires_exact_normalized_match(self) -> None:
        module = load_init_project_module()
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "project"
            target.mkdir()
            other = Path(temp) / "other"
            other.mkdir()

            def fake_get_json(port: int, path: str) -> dict:
                self.assertEqual(port, 49160)
                self.assertEqual(path, "/api/projects")
                return {
                    "projects": [
                        {"id": "other", "project_root": str(other)},
                        {"id": "target", "project_root": str(target / ".." / "project")},
                    ]
                }

            module.get_json = fake_get_json

            self.assertEqual(module.registered_project_for_root(49160, target)["id"], "target")
            self.assertIsNone(module.registered_project_for_root(49160, target / "nested"))


if __name__ == "__main__":
    unittest.main()
