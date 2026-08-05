---
name: vb-test-review
description: Independently audit whether tests cover every observable requirement and risk boundary.
---

# Test Coverage Review

Read the requirements, production behavior, and tests without modifying them.

Build a compact requirement-to-test map and report only material gaps:

- boundary equivalence classes such as empty, whitespace-only, null, wrong type, and structurally valid unusual inputs;
- errors before side effects;
- asynchronous failure and rollback;
- tenant, identity, mutation, replay, and atomicity behavior;
- exact public output shape and secret exclusion;
- valid behavior that an over-specific test would incorrectly forbid.

Return structured gaps with the requirement, missing observable assertion, failure impact, and recommended test owner. Do not propose tests for private representation or stylistic preferences.
