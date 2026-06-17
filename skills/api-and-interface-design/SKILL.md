---
name: api-and-interface-design
description: Guides stable API and interface design. Use when designing REST or GraphQL endpoints, defining TypeScript type contracts, setting module boundaries, or reviewing public interfaces between frontend and backend. Triggers on requests like "design this API", "define the contract for", "create endpoint for", "how should this interface look", or "add pagination to".
---

# API and Interface Design

Design stable, well-documented interfaces that are hard to misuse. Good interfaces make the right thing easy and the wrong thing hard.

## Contract

Use this skill when:
- Designing new REST/GraphQL endpoints or TypeScript module interfaces
- Establishing type contracts between frontend and backend
- Reviewing or changing existing public interfaces
- Adding pagination, filtering, or error handling patterns

Do not use this skill for:
- Internal implementation details not exposed as interfaces
- Database schema design not tied to API shape
- GraphQL resolver implementation (use a GraphQL-specific skill)

## Core Principles

**Hyrum's Law** — every observable behavior becomes a de facto contract once users depend on it. Be intentional about what you expose; every public behavior is a potential commitment.

**One-Version Rule** — extend rather than fork. Design for a world where only one version exists at a time to avoid diamond dependency problems.

**Contract First** — define the interface before implementing it. The contract is the spec.

**Validate at Boundaries** — trust internal code; validate only at system edges (user input, external APIs, env config). Third-party API responses are always untrusted data.

## Workflow

1. **Read the existing codebase** — identify existing API patterns, error formats, naming conventions, and validation libraries in use. Follow them.

2. **Define the contract** — write typed input/output shapes before writing implementation. See [patterns reference](./references/patterns.md) for REST, TypeScript, and GraphQL examples.

3. **Apply the five rules**:
   - Consistent error semantics — one error shape, always
   - Validate at boundaries only
   - Prefer addition over modification (backward compatible)
   - Predictable naming (plural nouns for REST, camelCase fields, is/has/can for booleans)
   - Paginate list endpoints from the start

4. **Review against red flags**:
   - Endpoints returning different shapes depending on conditions
   - Inconsistent error formats across endpoints
   - Validation scattered through internal code
   - Breaking changes (type changes, field removals)
   - List endpoints without pagination
   - Verbs in REST URLs (`/api/createTask`)
   - Third-party responses used without validation

5. **Verify** using the checklist below.

## Verification Checklist

- [ ] Every endpoint has typed input and output schemas
- [ ] Error responses follow a single consistent format project-wide
- [ ] Validation occurs at system boundaries only
- [ ] List endpoints support pagination
- [ ] New fields are additive and optional (backward compatible)
- [ ] Naming is consistent across all endpoints
- [ ] Types or API docs committed alongside implementation

## References

- [API & Interface Patterns](./references/patterns.md) — REST resource design, pagination, partial updates, TypeScript discriminated unions, branded IDs, input/output separation
