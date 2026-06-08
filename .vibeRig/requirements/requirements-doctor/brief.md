# Requirements Doctor

## Goal

Add a small local validation command that checks whether a VibeRig requirement directory is ready for `write-plan`.

The command should help users catch missing required files, invalid JSON, schema mismatch, and acceptance coverage problems before asking Codex to create Linear issues.

## Users And Stakeholders

- Primary user: the main Codex agent using VibeRig skills inside this repository.
- Secondary user: a human maintainer reviewing why `write-plan` accepted or rejected a requirement.
- Downstream consumer: `write-plan`, which depends on complete local Docs as Code inputs.

## Success Signals

- A maintainer can run one command against `.vibeRig/requirements/<requirement-id>/`.
- The command exits `0` for a valid requirement and non-zero for invalid input.
- Failure output names the exact missing or invalid file and includes stable diagnostic codes.
- The validator checks both JSON syntax and schema conformance when schemas are present.
- Tests cover at least one valid requirement, one missing-file case, one invalid JSON case, and one acceptance coverage case.

## Non-Goals

- Do not create or update Linear issues.
- Do not replace `write-plan`; this is only a preflight validator.
- Do not add a local dashboard, task runner, API service, or proof packet directory.
- Do not auto-generate missing requirement documents.
- Do not require a new third-party dependency if Python standard library support is enough.

## Constraints

- The feature must fit the current skill-only plugin architecture.
- Local requirement docs remain under `.vibeRig/requirements/`.
- The implementation should be a script or lightweight module that can be tested with `pytest`.
- The command must not mutate requirement files.
- Error messages should be deterministic enough for tests.
- Subagents used during SOP execution must not use context-mode or update Linear.

## Decisions

- D-001: Use local validation only; Linear remains out of scope for this command.
- D-002: Prefer Python standard library validation for required files and JSON syntax.
- D-003: If full JSON Schema validation is unavailable, the implementation must still perform structural checks that cover the fields `write-plan` relies on.
- D-004: Report diagnostics as line-oriented text plus process exit status instead of writing report files.

## Risks

- R-001: Full JSON Schema validation may require an optional dependency. Mitigation: implement deterministic structural checks and document any skipped full-schema validation.
- R-002: Overly strict checks may reject useful requirements. Mitigation: validate only the required files and fields needed by `write-plan`.
- R-003: The command could drift from `write-plan` expectations. Mitigation: tests should encode the current required input contract.

## Open Questions

- Q-001: Should this command later become part of `write-plan` preflight, or remain a standalone maintainer utility?
- Q-002: Should the validator eventually support all requirement directories at once?
