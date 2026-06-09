---
name: ui-to-codex
description: Implement UI in an existing codebase from UIFLOW.md, DESIGN.md, Figma/Pencil, HTML, screenshot, or handoff specs. Use for design-to-code, UI implementation, Codex UI build, applying tokens/components, or turning a confirmed design and flow into working frontend code.
argument-hint: "<feature request, design source, UIFLOW.md, DESIGN.md, or target files>"
---

# /ui-to-codex

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](./CONNECTORS.md).

Implement UI in the local codebase from confirmed flow and design contracts.

## Contract

Use this reference for production-oriented UI implementation. It coordinates `UIFLOW.md`, `DESIGN.md`, handoff specs, existing code patterns, implementation, validation, and optional visual QA.

Do not start coding from a vague visual preference. Confirm that `UIFLOW.md` and `DESIGN.md` both exist and are implementation-ready first, or stop and report the missing contract decisions.

## Input Contract

Required before editing:
- Target codebase and target screen/component/route.
- Implementation-ready `UIFLOW.md`.
- Implementation-ready `DESIGN.md`.
- Interaction depth: `spec_only`, `static`, `interactive`, or `full_interactive`.

Optional:
- Figma/Pencil source, screenshot, HTML mock, existing component docs, Storybook, issue/task link.

## Workflow

1. Inspect current state and local patterns.
   - Read target files, route structure, component library, styling system, and test/build conventions.
   - Protect unrelated user changes.
2. Confirm the flow contract.
   - If `UIFLOW.md` exists, run `confirm-uiflow.md` mentally against it.
   - If it is missing or incomplete, route to `confirm-uiflow.md` and stop before coding.
3. Confirm the design contract.
   - If `DESIGN.md` exists, run `confirm-design.md` mentally against it.
   - If it is missing or incomplete, route to `confirm-design.md` and stop before coding.
4. Decide component strategy.
   - Do not reopen visual or flow decisions here; route back to `confirm-uiflow.md`, `confirm-design.md`, or `design-handoff.md` if a decision is missing.
   - Reuse existing codebase components first.
   - Reuse `DESIGN.md` or design-system components next.
   - Preserve Pencil/Figma component boundaries when they map cleanly to existing UI architecture.
   - Convert HTML design structure into components only when repetition, state, or reuse justifies it.
   - Create a new component when it is repeated, stateful, independently testable, or likely to be reused.
   - Keep simple one-off layout local when extraction adds ceremony without reducing complexity.
5. Implement the smallest scoped change.
   - Apply tokens and component rules from `DESIGN.md`.
   - Apply behavior, state, data, permissions, and responsive flow from `UIFLOW.md`.
   - Implement required empty, loading, error, disabled, success, focus, and responsive states.
6. Validate.
   - Run the repo-appropriate build, typecheck, lint, tests, or smoke check.
   - If no automated check exists, run the smallest manual/browser check available and report the gap.
7. Run visual QA when appropriate.
   - Use `visual-qa.md` when the user asks for it, when a high-fidelity visual source exists, or when the implementation is a visual recreation.
   - Treat visual QA as optional for ordinary business UI unless the user makes it an acceptance gate.

## Component Decision Matrix

| Situation | Default decision |
|-----------|------------------|
| Existing matching component exists | Reuse it and adapt via supported props/tokens. |
| Existing component is close but lacks a variant | Extend it if the variant belongs to the shared system. |
| Pencil/Figma exposes a named reusable component | Map it to an existing component or create a matching component boundary. |
| HTML mock has repeated semantic regions | Extract if repeated or stateful; otherwise keep local. |
| Component is used once and has no independent state | Keep local to the page/container. |
| Component has complex interaction, async state, or accessibility behavior | Encapsulate it with clear props and tests/checks. |

## Output Contract

Return:
- Changed files.
- Flow/design contracts used.
- Component reuse/extraction decisions.
- Validation run and pass/fail evidence.
- Whether visual QA was run, skipped, or blocked.

Do not claim completion unless the implementation exists and the selected validation path has run or the skipped check is explicitly justified.

## Common Mistakes

- Coding before `UIFLOW.md` clarifies states and interaction depth.
- Applying tokens but ignoring component variants and behavior.
- Recreating Pencil components as unstructured HTML.
- Extracting every visual group into a component without reuse or state pressure.
- Making new design decisions inside implementation instead of returning to the relevant confirmation or handoff reference.
- Treating visual QA as always mandatory for normal business UI.
