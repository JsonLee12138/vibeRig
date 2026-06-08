# Research

## Facts

- F-001: `write-plan` requires these files in `.vibeRig/requirements/<requirement-id>/`: `brief.md`, `contract.schema.json`, `contract.json`, `architecture.md`, `acceptance.schema.json`, `acceptance.json`, `acceptance.md`, and `validation.md`.
- F-002: `write-plan` maps acceptance IDs and validation gates into Linear issue descriptions and final plan sync comments.
- F-003: The repository currently uses Python scripts under `scripts/` and pytest tests under `tests/`.
- F-004: `.vibeRig/project.yaml` defines `docs.root` as `.vibeRig/requirements` and records Linear project metadata.

## Inferences

- I-001: A local preflight validator reduces failed or partial `write-plan` runs because missing inputs can be caught before Linear writes.
- I-002: A standard-library Python implementation is enough for a first version because the required schema is small and the core risk is missing or malformed planning data.
- I-003: Deterministic diagnostic codes make the command easier for Codex and tests to reason about.

## Hypotheses

- H-001: A narrow validator focused on `write-plan` readiness will be more useful than a broad documentation linter.
- H-002: Tests using temporary requirement directories can cover the behavior without depending on the real `.vibeRig/requirements/` contents.

## Confidence

- F-001 to F-004: high, based on current repository skill and project files.
- I-001 to I-003: medium, based on the current Linear-native workflow.
- H-001 to H-002: medium, requires implementation feedback.

## Source Links

- `.vibeRig/project.yaml`
- `skills/write-plan/SKILL.md`
- `scripts/init_project.py`
- `tests/test_init_project.py`
