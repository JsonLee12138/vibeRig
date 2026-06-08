# Architecture

## Selected Approach

Add a lightweight Python validator for one requirement directory. The expected entry point is a script under `scripts/`, with reusable functions that tests can import.

The validator should report diagnostics instead of throwing raw exceptions. The CLI should print diagnostics and return a process exit code.

## Affected Modules

- `scripts/`: add a requirements validation script or module.
- `tests/`: add pytest coverage using temporary requirement directories.
- `.vibeRig/requirements/requirements-doctor/`: source requirement docs for `write-plan`.

No changes are expected in `skills/`, Linear integration, dashboard code, runner code, or plugin metadata.

## Data Flow

1. CLI receives a requirement directory path.
2. Validator checks that the directory exists.
3. Validator checks required file presence.
4. Validator parses `contract.json` and `acceptance.json`.
5. Validator performs structural checks required by `write-plan`.
6. Validator emits diagnostics sorted by file and code.
7. CLI exits `0` if all diagnostics are warnings or informational, and non-zero if any error exists.

## Diagnostic Model

Each diagnostic should include:

- `code`: stable identifier such as `VRD001`.
- `severity`: `error`, `warning`, or `info`.
- `path`: file or directory path related to the issue.
- `message`: concise human-readable explanation.

Required initial diagnostic codes:

- `VRD001`: requirement directory does not exist.
- `VRD002`: required file is missing.
- `VRD003`: JSON file cannot be parsed.
- `VRD004`: expected top-level JSON field is missing or has the wrong type.
- `VRD005`: acceptance item is missing a required field.
- `VRD006`: acceptance item does not reference a source requirement or rule.

## Structural Checks

The first implementation must check:

- `contract.json` has arrays for `goals` and `rules`.
- Every goal and rule has an `id`.
- `acceptance.json` has an `items` array.
- Every acceptance item has `id`, `source`, `precondition`, `action`, `expected_result`, `evidence`, `validation_mode`, and `risk_covered`.
- Every acceptance `source` references at least one known goal or rule id.

## Boundaries

- Do not call Linear tools.
- Do not create, update, or delete local requirement files.
- Do not generate tasks or proof packets.
- Do not require the command to validate every Markdown heading.

## Failure Modes

- Missing directory: print `VRD001`, exit non-zero.
- Missing required file: print one `VRD002` per file, exit non-zero.
- Invalid JSON: print `VRD003`, exit non-zero.
- Missing structural field: print `VRD004` or `VRD005`, exit non-zero.
- Acceptance source does not map to a known goal or rule: print `VRD006`, exit non-zero.

## Migration Notes

This is an additive utility. Existing VibeRig skills remain compatible. `write-plan` may optionally mention this command later, but that is not required for the first implementation.

## Integration Points

- `write-plan`: the command validates its required local input contract before Linear writes.
- `agent-sop`: implementation should require tests because the feature adds behavior, parsing, and exit-code handling.
- `subagent-routing`: likely phases are implementation, test authoring, QA, and code review.
