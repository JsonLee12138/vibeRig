---
name: uiux-design
description: Design workflow router for UI design, redesign, critique, a11y review, handoff, design system, visual QA, UX copy, user research, and research synthesis. Use when the user asks for design feedback, mockup review, a11y audit, handoff specs, UI implementation, design-to-code, UX writing, research planning, or mentions Figma, Pencil, HTML, DESIGN.md, or UIFLOW.md.
---

# UIUX Design

Use this skill as the single entry point for design-related requests.
Route the request to the most relevant reference prompt instead of asking the user to invoke separate design skills.
Keep the reference prompts as the source of detailed guidance; this file only decides which reference(s) to load and which tool path to lock.

## Readiness gate
Before creating a new UI design, materially changing an existing UI, producing implementation-ready design artifacts, or coding UI, check whether the target scope has both `UIFLOW.md` and `DESIGN.md`.

- Look in the user-specified path first, then the feature/requirement directory, then the project root when no narrower scope is given.
- If `UIFLOW.md` is missing or incomplete, load `references/confirm-uiflow.md` and guide the user to confirm or create the flow contract first.
- If `DESIGN.md` is missing or incomplete, load `references/confirm-design.md` and guide the user to confirm or create the design contract first.
- If either contract is missing or blocked, do not create mockups, visual directions, screens, components, handoff specs, or code yet. Return only the missing-contract status, exact decisions needed, and the next confirmation step.
- Continue past this gate only after both contracts are present and implementation-ready, or after the user explicitly limits the request to `spec_only` contract drafting.

This gate does not block critique, accessibility review, visual QA of an existing artifact, UX copy, user research, or research synthesis when the user is not asking to create or change UI.

## Tool selection rules
1. If the user explicitly chooses a tool, lock to that tool and do not fall back automatically.
2. If the user specifies Figma or Pencil, execute design operations through the Pencil MCP toolchain.
3. Treat Figma as a design source/context and Pencil MCP as the execution interface.
4. If the user explicitly chooses HTML, stay in HTML mode and do not switch back to a design-tool flow.
5. If no design-tool connection is available, ask the user before using HTML mode.

Use this exact confirmation when there is no available design-tool connection:
> There is no available design-tool connection right now. Do you want me to continue in HTML design mode?

Read `references/CONNECTORS.md` whenever you need to interpret `~~design tool` semantics for this skill.

## Routing rules
Default to one best-matching reference.
Only combine multiple references when the user request clearly spans multiple design stages.
If the request is ambiguous, ask one minimal clarifying question before loading references.
Do not expand scope implicitly.

### Route mapping
- Design review, critique, screen feedback, mockup feedback → `references/design-critique.md`
- Accessibility, a11y, WCAG, contrast, keyboard review → `references/accessibility-review.md`
- UI flow confirmation, UIFLOW.md review, page/state/navigation flow contract → `references/confirm-uiflow.md`
- DESIGN.md confirmation, token/component/responsive design readiness → `references/confirm-design.md`
- Developer handoff, implementation specs, component model, tokens, responsive states → run the readiness gate, then `references/design-handoff.md` only after required contracts are ready
- New UI design, UI redesign, implementation-ready mockups, developer handoff, UI implementation, design-to-code, Figma/Pencil/HTML/screenshot to code, Codex UI build → run the readiness gate, then `references/ui-to-codex.md` or `references/design-handoff.md` only after required contracts are ready
- Visual QA, screenshot comparison, implementation fidelity review → `references/visual-qa.md`
- Design system audit, documentation, or extension → `references/design-system.md`
- CTA copy, error messages, empty states, dialog wording, onboarding copy → `references/ux-copy.md`
- User interviews, research plans, survey design, usability-test planning → `references/user-research.md`
- Research synthesis, transcript synthesis, support-feedback synthesis, NPS analysis → `references/research-synthesis.md`

### Combination rules
Default to a single reference. Combine multiple references when the user request clearly spans multiple design stages.

Examples:
- Review + accessibility → `references/design-critique.md` + `references/accessibility-review.md`
- Review + handoff → `references/design-critique.md`, then readiness gate before `references/design-handoff.md`
- New UI design or UI implementation with ready specs → readiness gate + `references/ui-to-codex.md`
- New UI design or UI implementation with missing specs → `references/confirm-uiflow.md` + `references/confirm-design.md`; stop before design, handoff, or code
- UI implementation with requested or high-fidelity visual comparison → `references/ui-to-codex.md` + optional `references/visual-qa.md`
- Research synthesis + next-round planning → `references/research-synthesis.md` + `references/user-research.md`

Other multi-stage pairings follow the same pattern when the request warrants it.

## Red Flags

- Implementation or code was produced before both `UIFLOW.md` and `DESIGN.md` readiness gates passed → only critique, a11y review, visual QA, UX copy, and research may bypass the gate.
- Multiple references were loaded for a single-stage request → default to one best-matching reference; combination requires a clearly multi-stage user request.
- A design tool was switched mid-task without the user asking (e.g., started in Pencil, switched to HTML) → lock to the chosen tool and do not auto-fallback.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The user asked for a mockup, so I'll skip the readiness gate to save time" | The readiness gate prevents building the wrong thing. A missing `UIFLOW.md` means the navigation or state model is undefined — any mockup built on that is throwaway work. |
| "I'll load two references since the request touches design and accessibility" | Default to one. Combining references is justified only when the request clearly spans multiple design stages. When in doubt, ask one clarifying question. |

## Validation

- [ ] Readiness gate was checked (both `UIFLOW.md` and `DESIGN.md` present) before producing any new UI design, mockup, or code — or the request is confirmed as gate-exempt (critique, a11y review, visual QA, UX copy, or research).
- [ ] The correct reference(s) were loaded from the route map; no reference was loaded speculatively.
- [ ] The chosen design tool (Pencil/HTML) was locked for the session and not switched without user request.

When combining, keep this order:
1. Evaluate or synthesize first
2. Confirm flow and design contracts before implementation
3. Apply focused secondary review next
4. Produce the delivery artifact last
