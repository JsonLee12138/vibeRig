# Acceptance Matrix

## AC-001 Valid Requirement Passes

- Source: `G-001`, `RULE-002`
- Precondition: A complete requirement directory exists and includes all `write-plan` required files.
- Action: Run the requirements doctor command against that directory.
- Expected result: The command exits `0` and prints a success summary or no error diagnostics.
- Evidence: Pytest case using a temporary valid requirement directory.
- Validation mode: automated-test
- Risk covered: `R-001`

## AC-002 Missing Required File Fails

- Source: `G-002`, `RULE-002`
- Precondition: A requirement directory is missing at least one required `write-plan` input file.
- Action: Run the requirements doctor command against that directory.
- Expected result: The command exits non-zero and reports `VRD002` with the missing file path.
- Evidence: Pytest case asserting exit code and diagnostic output.
- Validation mode: automated-test
- Risk covered: `R-001`

## AC-003 Invalid JSON Fails

- Source: `G-002`, `RULE-003`
- Precondition: A requirement directory contains invalid JSON in `contract.json` or `acceptance.json`.
- Action: Run the requirements doctor command against that directory.
- Expected result: The command exits non-zero and reports `VRD003` for the invalid JSON file.
- Evidence: Pytest case asserting deterministic JSON parse diagnostics.
- Validation mode: automated-test
- Risk covered: `R-001`

## AC-004 Acceptance Source Coverage Fails

- Source: `G-002`, `RULE-004`
- Precondition: `acceptance.json` contains an item whose source does not reference a known goal or rule id from `contract.json`.
- Action: Run the requirements doctor command against that directory.
- Expected result: The command exits non-zero and reports `VRD006` for the acceptance item.
- Evidence: Pytest case asserting acceptance coverage diagnostics.
- Validation mode: automated-test
- Risk covered: `R-001`

## AC-005 Repository Tests Pass

- Source: `G-003`, `RULE-005`
- Precondition: The feature has been implemented.
- Action: Run the repository test suite.
- Expected result: All existing tests plus the new requirements doctor tests pass.
- Evidence: `python3 -m pytest -q` output.
- Validation mode: command-output
- Risk covered: `R-001`, `R-002`

## AC-006 Validator Is Read-Only

- Source: `RULE-001`, `D-001`
- Precondition: A requirement directory contains valid source files.
- Action: Run the requirements doctor command.
- Expected result: No requirement source file is created, edited, or deleted by the command.
- Evidence: Code review plus automated test or temporary-directory content comparison.
- Validation mode: review
- Risk covered: `R-002`
