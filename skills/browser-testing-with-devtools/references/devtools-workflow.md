# DevTools Workflow Reference

Step-by-step procedures for each investigation panel, plus Claude in Chrome MCP tool reference.

---

## Claude in Chrome MCP Tools

Load schema via `ToolSearch` with query `select:mcp__Claude_in_Chrome__list_connected_browsers` before calling.

| Tool | Purpose |
|---|---|
| `list_connected_browsers` | Check if a browser tab is connected |
| `navigate` | Go to a URL |
| `read_console_messages` | Get all console output (errors, warnings, logs) |
| `read_network_requests` | Get network activity (URL, status, timing) |
| `read_page` | Get current DOM as structured text |
| `get_page_text` | Get visible text content |
| `javascript_tool` | Execute JS in page context (use for measuring, not mutation) |
| `find` | Find elements by CSS selector or text |
| `get_screenshot` | Capture current visible viewport |

**Preferred sequence for unknown issues:**
1. `read_console_messages` → quick error signal
2. `read_network_requests` → API/asset failures
3. `get_screenshot` → visual state capture
4. `javascript_tool` → measure computed values if needed

---

## Network Panel — Request Failures & API Calls

**Goal:** identify failed requests, unexpected status codes, missing headers, or large payloads.

**MCP path:**
```
mcp__Claude_in_Chrome__read_network_requests
```
Filter by URL pattern or status code in the response. Look for 4xx/5xx, CORS preflight failures (OPTIONS → 403/405), or unexpected redirects.

**Manual path (if MCP unavailable):**
1. Open DevTools → Network tab.
2. Reload page with DevTools open to capture all requests.
3. Filter by XHR/Fetch for API calls; All for asset loading.
4. Click failing request → inspect Status, Headers (check `Authorization`, `Content-Type`), Preview, Response.
5. Copy `curl` equivalent via right-click → Copy → Copy as cURL for reproduction.

**Evidence to capture:** status code, request URL, response body (first 200 chars), and any CORS or auth header values.

---

## Console Panel — JS Errors & Unexpected Values

**Goal:** find thrown errors, unhandled promise rejections, or unexpected runtime values.

**MCP path:**
```
mcp__Claude_in_Chrome__read_console_messages
```
Look for `error` level entries first. Note the file and line reference in the stack trace.

**Manual path:**
1. Open DevTools → Console tab.
2. Set filter to `Errors` first; then `Warnings`.
3. Click the file:line reference to jump to source.
4. Use `console.log` injection or `debugger` statement in source for step-through.

**Common patterns:**
- `Cannot read properties of undefined` → check the data shape from the API response; it differs from the expected schema.
- `TypeError: X is not a function` → import missing or wrong export name.
- Unhandled promise rejection → missing `.catch()` or `try/catch` around an async call.

**Evidence to capture:** full error message, file path, line number, and stack trace (top 3 frames).

---

## Elements Panel — DOM & Style Inspection

**Goal:** identify incorrect DOM structure, missing elements, or misapplied styles.

**MCP path:**
```
mcp__Claude_in_Chrome__read_page       # DOM structure
mcp__Claude_in_Chrome__find            # locate specific element by selector
mcp__Claude_in_Chrome__javascript_tool # getComputedStyle for CSS values
```

Example — get computed style:
```js
// Pass to javascript_tool
const el = document.querySelector('.target-class');
const style = window.getComputedStyle(el);
return { display: style.display, visibility: style.visibility, height: style.height };
```

**Manual path:**
1. Open DevTools → Elements tab.
2. Right-click the visual element → Inspect.
3. Check computed styles in the Styles pane; toggle CSS rules on/off to isolate.
4. Use the accessibility tree (Accessibility pane) for screen reader / ARIA issues.

**Evidence to capture:** screenshot of the element highlighted, computed style values, and the CSS rule that is applying (file and line).

---

## Performance Panel — Render & Runtime Profiling

**Goal:** identify long tasks, layout thrashing, excessive re-renders, or slow resource loading.

**MCP path:**
```js
// javascript_tool — measure long task presence
const entries = performance.getEntriesByType('longtask');
return entries.map(e => ({ name: e.name, duration: e.duration, startTime: e.startTime }));
```

```js
// javascript_tool — measure cumulative layout shift (CLS)
let cls = 0;
new PerformanceObserver(list => {
  list.getEntries().forEach(e => { if (!e.hadRecentInput) cls += e.value; });
}).observe({ type: 'layout-shift', buffered: true });
return { cls };
```

**Manual path:**
1. Open DevTools → Performance tab.
2. Click Record → perform the interaction → Stop.
3. Inspect the Main thread flame chart: look for long orange/red blocks (> 50ms = long task).
4. Check Timings row for LCP, FID, CLS markers.
5. Use Memory checkbox to record heap snapshots alongside the trace.

**Key thresholds (Core Web Vitals):**

| Metric | Good | Needs Work | Poor |
|---|---|---|---|
| LCP | < 2.5s | 2.5–4s | > 4s |
| INP | < 200ms | 200–500ms | > 500ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |

**Evidence to capture:** screenshot of flame chart with offending task highlighted, metric values, and the JS function or resource identified as the bottleneck.

---

## Evidence Capture Patterns

**Screenshot:** always use `get_screenshot` or instruct the user to take one before closing DevTools. Label it with the panel name and timestamp.

**Network log excerpt format:**
```
GET /api/users/42  →  404  (123ms)
Response: {"error": "User not found"}
```

**Console error format:**
```
[ERROR] Uncaught TypeError: Cannot read properties of undefined (reading 'id')
  at UserCard.jsx:34
  at renderWithHooks (react-dom.development.js:14985)
```

Always include at least one of the above in the findings report.
