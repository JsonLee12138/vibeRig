# scripts-yaml

## Overview

Directory-based community: scripts

- **Size**: 15 nodes
- **Cohesion**: 0.3974
- **Dominant Language**: python

## Members

| Name | Kind | File | Lines |
|------|------|------|-------|
| Check | Class | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 16-19 |
| read | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 22-23 |
| exists | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 26-27 |
| contains | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 30-32 |
| not_contains | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 35-37 |
| no_matching_file | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 40-46 |
| build_checks | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 49-303 |
| main | Function | /Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py | 306-319 |
| quote_yaml | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 17-19 |
| yaml_list | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 22-26 |
| git_remote_url | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 29-40 |
| project_yaml_template | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 43-95 |
| write_if_missing | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 98-103 |
| ensure_project_yaml | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 106-151 |
| main | Function | /Users/jsonlee/Projects/vb-plugin/scripts/init_project.py | 154-228 |

## Execution Flows

- **main** (criticality: 0.37, depth: 2)
- **main** (criticality: 0.37, depth: 2)

## Dependencies

### Outgoing

- `add_argument` (18 edge(s))
- `print` (14 edge(s))
- `mkdir` (5 edge(s))
- `get` (4 edge(s))
- `all` (4 edge(s))
- `append` (4 edge(s))
- `write_text` (3 edge(s))
- `strip` (3 edge(s))
- `str` (3 edge(s))
- `read_text` (2 edge(s))
- `exists` (2 edge(s))
- `list` (2 edge(s))
- `loads` (1 edge(s))
- `len` (1 edge(s))
- `rglob` (1 edge(s))

### Incoming

- `/Users/jsonlee/Projects/vb-plugin/scripts/audit_linear_native_plan.py` (8 edge(s))
- `/Users/jsonlee/Projects/vb-plugin/scripts/init_project.py` (7 edge(s))
