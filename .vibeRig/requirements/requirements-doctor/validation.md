# Validation

## Required Automated Checks

- `python3 -m pytest -q`

## Targeted Checks

- `python3 -m pytest tests/test_requirements_doctor.py -q`
- `python3 scripts/requirements_doctor.py .vibeRig/requirements/requirements-doctor`

## Manual Checks

- Confirm the validator does not call Linear tools.
- Confirm no local task file, dashboard data, runner config, or proof packet directory is created.
- Confirm diagnostics are deterministic enough for a Linear proof comment.

## CI Gate Policy

The current project policy is `ci_required: project_decides`. For this requirement, local pytest output is sufficient unless the project later adds a CI gate.

## Evidence Expectations

The final Linear Proof Packet comment should include:

- Changed files.
- AC coverage: `AC-001` through `AC-006`.
- Commands run and pass/fail result.
- Any skipped checks with reason.
- Residual risks, especially if full JSON Schema validation is not implemented.
