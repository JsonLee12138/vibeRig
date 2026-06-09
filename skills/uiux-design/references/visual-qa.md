---
name: visual-qa
description: Compare an implemented UI against a design source, screenshot, Figma/Pencil frame, HTML mock, DESIGN.md, or handoff spec. Use for visual QA, screenshot comparison, design fidelity review, responsive visual checks, or implementation polish before handoff.
argument-hint: "<source design and implementation URL/screenshot/files>"
---

# /visual-qa

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](./CONNECTORS.md).

Review visual fidelity after implementation. This is a quality gate only when the user requests it, a high-fidelity source exists, or `ui-to-codex.md` selected visual recreation as the implementation mode.

## Contract

Use this reference after there is both:
- Source truth: Figma/Pencil frame, screenshot, HTML mock, `DESIGN.md`, or handoff spec.
- Rendered implementation: local URL, deployed URL, screenshot, app screen, or component preview.

Do not use this for broad UX critique before implementation. Route that to `design-critique.md`.

## Required Checks

Compare the implementation against the source on:
- Layout and spacing: frame size, grid, alignment, padding, density, section rhythm.
- Typography: family, weight, size, line height, letter spacing, wrapping, truncation.
- Colors and tokens: surface, text, border, accent, semantic states, contrast.
- Components: variants, states, props, radius, elevation, motion, icon style.
- Flow states: loading, empty, error, disabled, selected, focus, success.
- Assets: image choice, crop, scale, quality, icon library, logos, generated assets.
- Responsive behavior: desktop, tablet, mobile, and any breakpoint defined in `DESIGN.md`.
- Accessibility-visible behavior: focus ring, target size, contrast, reduced motion where visible.

## Severity

| Severity | Meaning |
|----------|---------|
| `P0` | Broken layout, unusable interaction, severe accessibility failure, or impossible core task. |
| `P1` | Major design mismatch or usability regression likely to be noticed by users. |
| `P2` | Moderate visual drift, missing state, responsive issue, or fixable polish gap. |
| `P3` | Minor polish that can remain for human review. |

## Output

```markdown
## Visual QA
**Result:** passed | needs-fixes | blocked | human-review-needed

### Evidence
- Source:
- Implementation:
- Viewport:
- State:

### Findings
| Severity | Location | Difference | Fix |
|----------|----------|------------|-----|
| P1 | Component/screen | Source does X, implementation does Y | Concrete patch direction |

### Required Fixes
1. P0/P1/P2 fix.
2. P0/P1/P2 fix.

### Human Review Notes
- P3 or subjective design judgement that should be reviewed by a person.
```

Use `passed` when no actionable P0/P1/P2 findings remain.
Use `needs-fixes` when actionable P0/P1/P2 findings remain.
Use `blocked` when source or implementation evidence cannot be opened or captured.
Use `human-review-needed` when the remaining judgement is subjective or cannot be validated without product/design owner input.

## Optional Gate Policy

- Mandatory: user asks for QA, high-fidelity recreation, or explicit source-to-render comparison.
- Recommended: major responsive redesign, new shared component, complex visual states.
- Skippable: small business UI changes, copy-only changes, backend-driven state wiring, or when no reliable visual source exists.

## Common Mistakes

- Comparing from memory instead of visible evidence.
- Passing QA without checking responsive states.
- Treating subjective polish as a blocking defect without user acceptance criteria.
- Ignoring component state mismatches because the default state looks close.
