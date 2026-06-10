# tests-project

## Overview

Directory-based community: tests

- **Size**: 6 nodes
- **Cohesion**: 0.0472
- **Dominant Language**: python

## Members

| Name | Kind | File | Lines |
|------|------|------|-------|
| load_init_project_module | Function | /Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py | 16-22 |
| InitProjectTest | Class | /Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py | 25-120 |
| test_plugin_is_skill_only_without_viberig_mcp_server | Test | /Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py | 26-32 |
| test_init_writes_linear_native_project_yaml_and_keeps_codex_config_unmanaged | Test | /Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py | 34-89 |
| test_existing_project_yaml_is_migrated_with_required_sections | Test | /Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py | 91-108 |
| test_linear_native_plan_audit_passes | Test | /Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py | 110-120 |

## Execution Flows

No execution flows pass through this community.

## Dependencies

### Outgoing

- `assertIn` (22 edge(s))
- `assertNotIn` (5 edge(s))
- `read_text` (4 edge(s))
- `assertTrue` (3 edge(s))
- `str` (3 edge(s))
- `run` (3 edge(s))
- `TemporaryDirectory` (2 edge(s))
- `Path` (2 edge(s))
- `mkdir` (2 edge(s))
- `write_text` (2 edge(s))
- `is_dir` (2 edge(s))
- `assertEqual` (2 edge(s))
- `unittest.TestCase` (1 edge(s))
- `ensure_project_yaml` (1 edge(s))
- `lstrip` (1 edge(s))

### Incoming

- `assertIn` (22 edge(s))
- `assertNotIn` (5 edge(s))
- `read_text` (4 edge(s))
- `assertTrue` (3 edge(s))
- `str` (3 edge(s))
- `run` (3 edge(s))
- `/Users/jsonlee/Projects/vb-plugin/tests/test_init_project.py` (2 edge(s))
- `TemporaryDirectory` (2 edge(s))
- `Path` (2 edge(s))
- `mkdir` (2 edge(s))
- `write_text` (2 edge(s))
- `is_dir` (2 edge(s))
- `assertEqual` (2 edge(s))
- `ensure_project_yaml` (1 edge(s))
- `lstrip` (1 edge(s))
