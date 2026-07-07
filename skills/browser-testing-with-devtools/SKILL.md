---
name: browser-testing-with-devtools
description: >-
  Use when debugging or testing a frontend feature in a live browser: inspecting
  network requests, analyzing console errors, examining DOM state, profiling page
  performance, or running automated browser checks via Claude in Chrome MCP
  tools. Key terms: devtools, network tab, console error, DOM inspect,
  performance profile, browser debug, chrome, XHR, fetch, layout shift, memory
  leak.
---

# Browser Testing with DevTools

Use this skill to investigate, debug, and validate frontend behavior directly in a running browser session.

## Contract

Use this skill to diagnose frontend issues using browser DevTools or the Claude in Chrome MCP, and to produce evidence-backed findings.

Do not use this skill for:
- Writing or running unit tests (use `vitest`).
- Running Playwright/Cypress E2E test suites (use `playwright-cli`).
- Debugging Node.js server-side code without a browser context.

Stop and report when the target page is inaccessible, the Chrome MCP is unavailable and the user cannot open a browser manually, or the issue requires backend/server access only.

## Input Contract

Required:
- Target URL or running dev server address.
- Description of the symptom or behavior to investigate (error, wrong value, slow render, etc.).

Optional:
- Specific DevTools panel to focus on (Network, Console, Elements, Performance).
- Reproduction steps or expected vs. actual behavior.
- Feature branch or commit under test.

If required inputs are missing, ask for the URL and symptom before proceeding.

## Output Contract

Return:
- Findings per panel used: what was observed, with screenshot or copied output as evidence.
- Root cause hypothesis with supporting evidence.
- Actionable next steps (code change, config fix, or further investigation needed).
- Any skipped checks and why.

Do not claim completion without captured evidence (screenshot, console output, or network log excerpt).

## Workflow

1. **Identify the investigation type** — choose the primary angle:
   - Network failure / unexpected request → Network panel
   - JS error / unexpected value → Console panel
   - Layout or style issue → Elements panel
   - Slow render / jank → Performance panel
   - Multiple angles → sequence them; start with Console for quick signal

2. **Check MCP availability** — attempt `mcp__Claude_in_Chrome__list_connected_browsers`. If connected, prefer MCP tools for automation. If not, guide the user to open DevTools manually and relay findings.

3. **Execute the investigation** — follow the relevant section in `references/devtools-workflow.md`. Capture all evidence before forming conclusions.

4. **Form a root cause hypothesis** — link observed data (status code, error message, layout offset, frame drop) to a specific cause in code or config.

5. **Report findings** — state what was observed, the hypothesis, and the next action. Include evidence inline (screenshot path, copied log line, or network payload excerpt).

## Context Loading

Read when needed:
- `references/devtools-workflow.md`: read for step-by-step panel procedures, MCP tool reference, and evidence capture patterns.

Do not load the reference at the start unless all four panels are in scope.

## Red Flags

- Stating a root cause without captured evidence → go back and capture a screenshot or log line first.
- Opening all panels at once before narrowing the symptom → pick the most likely panel first; parallelism wastes time and dilutes focus.
- Skipping MCP availability check and going straight to manual instructions → check first; MCP is faster and produces structured output.
- Describing what DevTools "should show" without actually observing it → take a screenshot or read console output; hypotheticals are not evidence.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| "The error is obvious, I don't need to open DevTools" | A visible symptom rarely shows the root cause. One network request or one console line often contradicts the obvious explanation. |
| "The MCP tools are overkill for a quick check" | One `read_console_messages` call is faster than guiding the user through F12 + copy-paste. Use the tool. |
| "I'll report findings without a screenshot to keep the response short" | Unverified findings send developers in the wrong direction. A screenshot or log excerpt is the minimum bar. |

## Validation

```bash
# Confirm MCP browser tools are available (run before starting)
# Expected: at least one connected browser listed, or clear "not connected" signal
# mcp__Claude_in_Chrome__list_connected_browsers
```

- [ ] Target URL confirmed reachable (200 or expected redirect, not connection refused).
- [ ] Investigation type selected before opening any panel.
- [ ] At least one piece of captured evidence (screenshot, log line, network entry) is included in the report.
- [ ] Root cause hypothesis is explicitly linked to the captured evidence.
- [ ] Next action is concrete: a specific file, config key, or follow-up investigation.
