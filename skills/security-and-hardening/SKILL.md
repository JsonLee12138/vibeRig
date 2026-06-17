---
name: security-and-hardening
description: Harden code against vulnerabilities. Use when handling user input, authentication, data storage, external integrations, or LLM/AI features. Use when building anything that accepts untrusted data, manages user sessions, or interacts with third-party services.
---

# Security and Hardening

Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory. Security is a constraint on every line of code that touches user data, auth, or external systems — not a post-launch add-on.

## Contract

Use this skill for features with external inputs, auth implementations, data storage changes, API integrations, and AI/LLM features.

Do not use for documentation-only or internal-only config changes with no external attack surface.

Stop and ask when a security decision requires human approval (see Ask First tier below).

## Threat Model First

Before hardening any feature, spend five minutes thinking like an attacker:

1. **Map trust boundaries** — where does untrusted data cross into the system? HTTP requests, file uploads, webhooks, third-party APIs, message queues, and **LLM output**.
2. **Name the assets** — what's worth stealing or breaking? Credentials, PII, payment data, admin actions.
3. **Run STRIDE over each boundary:**

| Threat | Ask |
|--------|-----|
| **S**poofing | Can someone impersonate a user or service? |
| **T**ampering | Can data be altered in transit or at rest? |
| **R**epudiation | Can an action be denied later? |
| **I**nformation disclosure | Can data leak? |
| **D**enial of service | Can it be overwhelmed? |
| **E**levation of privilege | Can a user gain unauthorized rights? |

If you can't name the trust boundaries for a feature, you're not ready to secure it.

## Three-Tier Boundary System

**Always do (no exceptions):**
- Validate all external input at the system boundary (API routes, form handlers)
- Parameterize all database queries — never concatenate user input into SQL
- Encode output to prevent XSS (use framework auto-escaping; don't bypass it)
- Use HTTPS for all external communication
- Hash passwords with bcrypt/scrypt/argon2 (never store plaintext; salt rounds ≥ 12)
- Set security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Use httpOnly, secure, sameSite cookies for sessions
- Run dependency audit (`npm audit` or equivalent) before every release

**Ask first (requires human approval):**
- Adding new authentication flows or changing auth logic
- Storing new categories of sensitive data (PII, payment info)
- Adding new external service integrations
- Changing CORS configuration
- Adding file upload handlers
- Modifying rate limiting or throttling
- Granting elevated permissions or roles

**Never do:**
- Never commit secrets to version control (API keys, passwords, tokens)
- Never log sensitive data (passwords, tokens, full card numbers)
- Never trust client-side validation as a security boundary
- Never use `eval()` or `innerHTML` with user-provided data
- Never store session tokens in localStorage
- Never expose stack traces or internal error details to users

## Key OWASP Prevention Patterns

See `references/security-checklist.md` for full code examples and the supply-chain hygiene checklist.

- **Injection** — parameterized queries or ORM; never concatenate input into SQL, shell commands, or template strings.
- **Broken auth** — bcrypt ≥ 12 salt rounds; httpOnly/secure/sameSite cookies; rate-limit login endpoints.
- **XSS** — framework auto-escaping by default; DOMPurify for any required HTML rendering; never `innerHTML` with user data.
- **Access control** — check authorization (ownership/role), not just authentication, on every endpoint.
- **SSRF** — allowlist scheme + host + resolved IPs before any server-side URL fetch; reject redirects; validate after DNS resolution.
- **Sensitive data** — strip sensitive fields from API responses; environment variables for secrets; rotate any secret ever committed.

## Securing AI / LLM Features

If the app calls an LLM, uses agents, or does RAG:

- **Treat all model output as untrusted input** — never pass LLM output into `eval`, SQL, shell, `innerHTML`, or a file path. Validate and encode it exactly like raw user input.
- **Assume prompts can be hijacked (Prompt Injection)** — untrusted text in the context window (user messages, fetched pages, PDFs) can carry instructions. Enforce permissions in code, not the prompt.
- **Keep secrets out of prompts** — API keys, cross-tenant data, PII, and the full system prompt can be echoed back. Don't put them in the context window.
- **Constrain tool/agent permissions** — scope tools to the minimum needed, require confirmation for destructive or irreversible actions, validate every tool argument.
- **Bound consumption** — cap tokens, request rate, and loop/recursion depth to prevent cost runaway from crafted inputs.
- **Isolate retrieval data (RAG)** — partition embeddings per tenant so one user can't retrieve another's data; validate documents before indexing.

## Red Flags

- User input passed directly to database queries, shell commands, or HTML rendering
- Secrets in source code or commit history
- API endpoints without authorization checks
- No rate limiting on authentication endpoints
- Stack traces or internal errors exposed to users
- Dependencies with known critical vulnerabilities
- Server fetches user-supplied URLs without an allowlist (SSRF)
- LLM/model output passed into a query, the DOM, a shell, or `eval`
- Secrets, PII, or the full system prompt placed in an LLM context window

## Verification

After implementing security-relevant code:

```bash
npm audit  # no critical or high vulnerabilities
git diff --cached | grep -i "password\|secret\|api_key\|token"  # no staged secrets
```

- [ ] All user input validated at system boundaries
- [ ] Authentication and authorization checked on every protected endpoint
- [ ] Security headers present (verify with browser DevTools Network tab)
- [ ] Error responses don't expose internal details
- [ ] Rate limiting active on auth endpoints
- [ ] No secrets in source code or git history
- [ ] LLM output validated and encoded before use (if AI features present)
- [ ] Supply chain: lockfile committed; new dependencies reviewed for maintenance and postinstall scripts
