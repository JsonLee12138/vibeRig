---
name: confirm-design
description: Confirm or create DESIGN.md implementation readiness before UI coding. Use when a request mentions DESIGN.md, design tokens, typography, spacing, colors, component rules, Pencil components, HTML component patterns, responsive design specs, assets, icons, or when UI implementation needs a design source of truth.
argument-hint: "<DESIGN.md path, design source, screenshot, or implementation request>"
---

# /confirm-design

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](./CONNECTORS.md).

Confirm that the visual design contract is implementation-ready. `DESIGN.md` owns visual language and component rules; `UIFLOW.md` owns behavior and flow.

## Contract

Use this reference to inspect an existing `DESIGN.md`, create one from a design source, or ask for missing design decisions before UI implementation.

Do not use this for broad design-system audits unless the user asks to audit or extend the system. Route those requests to `design-system.md`.

## Required DESIGN.md Coverage

A production-ready `DESIGN.md` should cover:
- Overview: visual direction, density, tone, and design principles.
- Colors: brand, semantic, surface, text, border, focus, and dark-mode tokens when relevant.
- Typography: font stack, scale, weight, line height, letter spacing, and usage.
- Layout: spacing scale, containers, grids, section rhythm, and breakpoints.
- Elevation and depth: shadows, borders, overlays, blur, and z-index rules.
- Shapes: radius scale, image geometry, clipping, and touch target shape grammar.
- Components: component inventory, variants, states, token mapping, and composition rules.
- Inputs and forms: validation, helper text, errors, disabled/read-only states.
- Assets: image, icon, illustration, logo, avatar, and generated-asset rules.
- Do's and don'ts: non-negotiable visual rules.
- Responsive behavior: breakpoint-specific layout and component changes.
- Accessibility baseline: contrast, focus, target size, reduced motion, and semantic requirements.

## Component Model

Confirm how the design source represents components:

| Source | What to inspect | Implementation implication |
|--------|-----------------|----------------------------|
| Existing codebase | Local components, imports, style APIs, tests | Reuse first; extend only within established patterns. |
| Pencil/Figma | Component instances, variants, tokens, layer names | Preserve component boundaries and variant meaning when practical. |
| HTML design | Semantic DOM groups, repeated structures, CSS custom properties | Extract reusable components only when repetition or state warrants it. |
| Screenshot/image | Visual repetition, state hints, layout regions | Infer cautiously; ask when component boundaries affect implementation. |

## Readiness Checklist

Mark `ready` only when:
- Tokens are named or inferable without hardcoding arbitrary values.
- Component variants and states are documented or visible.
- Responsive behavior is explicit enough to implement.
- Asset strategy is clear: real assets, generated assets, existing files, or acceptable placeholders.
- Accessibility baseline is clear enough to implement focus, contrast, and target size.
- Any Pencil or HTML component mode is accounted for.

## Missing Spec Routing

When `DESIGN.md` is incomplete:
- Missing component props, states, or implementation specs -> route to `design-handoff.md`.
- Missing system-wide component rules -> route to `design-system.md`.
- Missing microcopy -> route to `ux-copy.md`.
- Missing accessibility requirements -> route to `accessibility-review.md`.

## Output

```markdown
## DESIGN.md Readiness
**Result:** ready | needs-update | blocked

### Source Reviewed
- DESIGN.md:
- Visual source:
- Component source mode: existing code | Pencil/Figma | HTML | screenshot | mixed

### Coverage
| Area | Status | Notes |
|------|--------|-------|
| Tokens | ready/partial/missing | |
| Typography | ready/partial/missing | |
| Layout and responsive | ready/partial/missing | |
| Components | ready/partial/missing | |
| Assets | ready/partial/missing | |
| Accessibility | ready/partial/missing | |

### Required Updates
1. Exact missing decision or section.
2. Exact missing decision or section.

### Implementation Notes
- Component reuse:
- Component extraction:
- Token mapping:
```

## Common Mistakes

- Treating `DESIGN.md` as a mood board instead of an implementation contract.
- Recording tokens but omitting component states.
- Ignoring Pencil/Figma variants and rebuilding every layer as one-off HTML.
- Over-extracting HTML into components before checking real reuse and state complexity.
