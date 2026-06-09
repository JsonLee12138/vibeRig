---
name: design-handoff
description: Generate developer handoff specs from a design. Use when a design is ready for engineering and needs a spec sheet covering layout, design tokens, component model, Pencil/Figma or HTML source modes, component props, interaction states, responsive breakpoints, edge cases, and animation details.
argument-hint: "<Figma URL or design description>"
---

# /design-handoff

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](./CONNECTORS.md).

Generate comprehensive developer handoff documentation from a design.

## Usage

```
/design-handoff $ARGUMENTS
```

Generate handoff specs for: @$1

If a Figma URL is provided, pull the design from Figma. Otherwise, work from the provided description or screenshot.

## What to Include

### Visual Specifications
- Exact measurements (padding, margins, widths)
- Design token references (colors, typography, spacing)
- Responsive breakpoints and behavior
- Component variants and states

### Component Model
- Component inventory for every repeated or stateful UI region
- Component source: existing code, Pencil/Figma component, HTML structure, screenshot inference, or new component
- Props, slots, content model, and data dependencies
- Variants, sizes, density, tone, and composition rules
- State ownership: local state, parent state, form state, URL state, server/query state
- Reuse recommendation: reuse existing, extend existing, create shared component, or keep local

### Interaction Specifications
- Click/tap behavior
- Hover states
- Transitions and animations (duration, easing)
- Gesture support (swipe, pinch, long-press)

### Content Specifications
- Character limits
- Truncation behavior
- Empty states
- Loading states
- Error states

### Edge Cases
- Minimum/maximum content
- International text (longer strings)
- Slow connections
- Missing data

### Accessibility
- Focus order
- ARIA labels and roles
- Keyboard interactions
- Screen reader announcements

## Principles

1. **Don't assume** — If it's not specified, the developer will guess. Specify everything.
2. **Use tokens, not values** — Reference `spacing-md` not `16px`.
3. **Show all states** — Default, hover, active, disabled, loading, error, empty.
4. **Describe the why** — "This collapses on mobile because users primarily use one-handed" helps developers make good judgment calls.

## Output

```markdown
## Handoff Spec: [Feature/Screen Name]

### Overview
[What this screen/feature does, user context]

### Layout
[Grid system, breakpoints, responsive behavior]

### Design Tokens Used
| Token | Value | Usage |
|-------|-------|-------|
| `color-primary` | #[hex] | CTA buttons, links |
| `spacing-md` | [X]px | Between sections |
| `font-heading-lg` | [size/weight/family] | Page title |

### Component Model
| Component | Source | Reuse Decision | Props / Slots | State Owner | Notes |
|-----------|--------|----------------|---------------|-------------|-------|
| [Component] | existing code / Pencil / HTML / new | reuse / extend / create / local | [Props and slots] | local / parent / form / URL / server | [Special behavior] |

### Component Variants And States
| Component | Variant | State | Visual Spec | Behavior |
|-----------|---------|-------|-------------|----------|
| [Button] | primary | loading | [Token-based visual] | Disabled, announces loading |

### States and Interactions
| Element | State | Behavior |
|---------|-------|----------|
| [CTA Button] | Hover | [Background darken 10%] |
| [CTA Button] | Loading | [Spinner, disabled] |
| [Form] | Error | [Red border, error message below] |

### Responsive Behavior
| Breakpoint | Changes |
|------------|---------|
| Desktop (>1024px) | [Default layout] |
| Tablet (768-1024px) | [What changes] |
| Mobile (<768px) | [What changes] |

### Edge Cases
- **Empty state**: [What to show when no data]
- **Long text**: [Truncation rules]
- **Loading**: [Skeleton or spinner]
- **Error**: [Error state appearance]

### Animation / Motion
| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| [Element] | [Trigger] | [Description] | [ms] | [easing] |

### Accessibility Notes
- [Focus order]
- [ARIA labels needed]
- [Keyboard interactions]
```

## Component Source Modes

### Existing Codebase
- Prefer existing components and local helper APIs before creating new ones.
- Extend shared components only when the new variant belongs to the system.
- Keep one-off layout local when extraction adds no reuse, state isolation, or testing value.

### Pencil / Figma
- Preserve named component instances, variants, and token meanings when they map cleanly to the implementation.
- Record layer/component names only when they help engineering map the source design to code.
- Do not flatten a stateful Pencil component into unrelated static markup.

### HTML
- Treat semantic regions, repeated blocks, and custom properties as component signals.
- Extract reusable components only when repetition, state, or future reuse justifies it.
- Keep simple non-repeated HTML structure local to the page or container.

### Mixed Source
- State which source wins when Pencil, HTML, screenshot, and existing code disagree.
- Default priority: existing product behavior, then UIFLOW.md, then DESIGN.md, then handoff/source visual.

## If Connectors Available

If **~~design tool** is connected:
- Pull exact measurements, tokens, and component specs from Figma
- Export assets and generate a complete spec sheet

If **~~project tracker** is connected:
- Link the handoff to the implementation ticket
- Create sub-tasks for each section of the spec

## Tips

1. **Share the Figma link** — I can pull exact measurements, tokens, and component info.
2. **Mention edge cases** — "What happens with 100 items?" helps me spec boundary conditions.
3. **Specify the tech stack** — "We use React + Tailwind" helps me give relevant implementation notes.
