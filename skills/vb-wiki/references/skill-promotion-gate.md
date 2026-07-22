# Skill Promotion Gate

Apply this gate exactly once and only after the knowledge commit succeeds. Default to `wiki_only`. A reusable lesson is not automatically a tool.

The candidate's complete factual and operational basis must come from one or more
canonical pages whose committed `status` is `current`. A `needs_revalidation` or
`superseded` page, unresolved conflict, fired invalidation signal, or claim that exists
only in retrieval metadata is ineligible and returns `wiki_only`. Unrelated current
pages from the same event do not make a conflicted basis eligible.

## Core Test

First ask internally:

> When the situation recurs, is reading the committed canonical wiki page sufficient for an agent to act correctly?

- **Yes** → `wiki_only`.
- **No** → continue through every eligibility gate below.

## Eligibility Gates

`propose_skill` is allowed only when all are true:

1. **Action-oriented** — the artifact performs a task; it does not merely explain a fact, decision, convention, root cause, or preference.
2. **Independently invocable** — a user intent, task context, symptom, or code signal can trigger it without requiring the original Issue story.
3. **Stable contract** — input, operation, output, and failure boundary can be stated.
4. **Reusable mechanism** — there is a packageable mechanism: a stable operational workflow, script, template, API/tool orchestration, or combination. Documentation alone is not the mechanism.
5. **Verifiable and safe** — correctness checks, stop conditions, authority limits, and destructive-action boundaries can be stated.
6. **Wiki insufficient** — explain concretely what execution value the skill adds beyond retrieving and reading the note.
7. **Value evidence** — either the need recurred, or the first occurrence exposes an obviously repeated, costly, error-prone, or automation-worthy capability gap.

Recurrence strengthens gate 7 but never bypasses gates 1–6. A first occurrence may qualify when the tool gap is already explicit—for example, the user asks to create a reusable hammer rather than record how a nail behaved.

## Bind The Exact Tool Target

Before returning `propose_skill`, read `~/.vb-skills/vb-skill-lock.json` and close skill packages without modifying them. The proposal—not `vb-learn`—must bind the exact action and package the user is authorizing:

- exactly one existing skill covers the capability → `action: refine` and `target_skill: <that-exact-name>`;
- no existing skill covers it → `action: create` and one collision-free `target_skill`;
- more than one plausible target, an unreadable/invalid lock, or an unsafe create/refine decision → return `wiki_only` with the ambiguity in `reason`; do not ask a target-vague question.

Once proposed, the whole approval packet is immutable. Normalize all packet strings with Unicode NFC and LF line endings; deduplicate/sort list fields by raw UTF-8 bytes; hash the UTF-8 RFC 8785/JCS packet core with full lowercase SHA-256 as `packet_sha256`. A later library or contract change requires a new packet hash and candidate-bound approval; downstream code may not silently retarget or reuse an old decision.

Search metadata, `index.md`, qmd snippets, the operation log, and a retrospective
are not substitutes for the canonical page and cannot satisfy or strengthen a
promotion gate.

## Knowledge Boundary

This gate runs only on knowledge already retained by the knowledge editor. It
does not rescue a discarded/zero-atom candidate merely because it looks
tool-like. Unless the full gate passes, the committed page remains passive
knowledge:

- facts, domain explanations, accepted decisions, trade-offs, and project conventions;
- proven root causes, gotchas, diagnostic signals, and bounded corrective guidance;
- command snippets or checklists that become sufficient once read;
- explicitly authoritative user/project conventions already retained as knowledge;
- anything whose tool When, input/output, validation, or authority boundary is unclear.

One-off narrative, speculative workflow ideas, unsupported preferences, and
ordinary commands may have been discarded before the knowledge commit. Their
absence is not a reason to create a skill candidate.

## Structured Decision

Produce exactly one internal result:

```yaml
decision: wiki_only | propose_skill
reason: <why reading the wiki is sufficient, or why it is not>
evidence: [<wiki page/source>, ...]
candidate: # omit completely for wiki_only
  id: promotion:<source-event-fingerprint>:<action>:<target-skill>:<packet-sha256>:<wiki-commit>
  source_event: <acceptance-event-id>
  wiki_commit: <knowledge-commit>
  action: create | refine
  target_skill: <exact-kebab-case-package-name>
  packet_sha256: <64-char-lowercase-sha256-of-immutable-packet-core>
  evidence_pages:
    - {page_id: <exact-id>, path: <committed-path>, blob_oid: <full-git-blob-oid>, content_fingerprint: <sha256:...>, status: current}
  capability: <the action this tool performs>
  why_wiki_insufficient: <specific execution gap>
  when: [<trigger condition>, ...]
  when_not: [<adjacent non-trigger>, ...]
  input: [<required input>, ...]
  output: [<artifact or state change>, ...]
  reusable_mechanism: [<workflow/script/template/API orchestration>, ...]
  verify: [<check with pass condition>, ...]
  safety_boundaries: [<authority/stop rule>, ...]
```

If any required candidate field would be empty or speculative, return `wiki_only`.
Include every canonical page needed to support the packet, not merely one convenient
page. Atomically persist the exact candidate ID, immutable render payload, evidence-page
bindings, and `promotion: proposal_pending` in a durable queued outbox before returning
it. Final-response delivery cannot be atomic with state persistence, so retries may
replay the same candidate ID until an explicit bound yes/no acknowledges it. Never
generate a replacement candidate merely to avoid replay.

Evaluate and persist this result only while holding the event-scoped atomic promotion
ownership defined by the operation journal. Normalize and hash the complete `wiki_only`
or candidate result, persist its `promotion_decision_sha256` locally before a Linear
overlay/final response, and use zero/one/conflict adoption: zero permits the one decision;
one matching decision is replayed; a mismatching local/Linear decision returns
`blocked: promotion_decision_conflict`. Concurrent recovery never runs a second gate.

## Staleness Guard

Before every proposal replay, approval acknowledgment, `vb-learn` invocation, and
retry of `approved` / `applying` / `failed`, resolve each bound `page_id` in current
wiki `HEAD`. Require exactly one page with the same path, full blob OID,
`content_fingerprint`, and `status: current`, with no fired invalidation signal. Any
missing, moved, changed, superseded, conflicting, or `needs_revalidation` page makes
the old packet stale even when its historical wiki commit remains valid.

If stale before a tool commit is proven, atomically acknowledge the old outbox and set
the phase to terminal `promotion: wiki_only` with `reason: candidate_stale`, while
retaining the original candidate and `promotion_decision_sha256` as audit history; do not
generate a replacement, invoke `vb-learn`, or reuse the old approval. If an uncommitted
tool draft already exists, preserve it and return `blocked: stale_candidate_tool_draft`
until it is resolved; never commit it. A later accepted event may run a new gate. A
tool commit already proven for this candidate remains historical `completed`; later
skill invalidation/remediation requires a separate authorized workflow.

## Trigger Examples

| Evidence | Decision | Why |
|---|---|---|
| “This repository requires all extension data reads through background RPC.” | `wiki_only` | A project convention; reading it is sufficient. |
| “The migration failed because payload collection data was removed before the compatibility reader shipped.” | `wiki_only` | Root cause and ordering knowledge, not yet a tool. |
| “For a clean committed wiki, these two commands refresh qmd and these outputs prove success.” | `wiki_only` | Bounded command guidance; reading it is sufficient. |
| “Every release requires collecting changed packages, generating changesets, validating versions, and producing a proof report; manual execution repeatedly misses packages.” | `propose_skill` | Independently invocable, multi-step, error-prone capability with outputs and validation. |
| “The user explicitly needs a reusable tool that reads an API schema and generates synchronized SDK contracts with drift checks.” | `propose_skill` | The hammer is explicit even on first occurrence; wiki guidance alone cannot perform it. |

## User Confirmation

Evaluate and enqueue at most once per event, only for `propose_skill`, after the wiki commit. The queued wording may be delivered at least once with the same candidate ID until acknowledged. Render it in `.vibeRig/project.yaml` `output.language`; the Chinese text below is the canonical field order, not a fixed output language:

```text
知识库沉淀已经完成。另外发现一个可能值得工具化的能力：<capability>。
候选 ID：<candidate-id>。
仅靠 wiki 不够，因为：<why_wiki_insufficient>。
<action=create 时写“拟创建”；action=refine 时写“拟更新”> `<target_skill>`：
- When：<when>
- When NOT：<when_not>
- 输入 / 输出：<input> → <output>
- 可复用机制：<reusable_mechanism>
- 验证与安全边界：<verify>; <safety_boundaries>

是否授权创建或更新这一个 skill？
```

- Explicit yes → pass the staleness guard, recompute/verify `packet_sha256`, then persist an `approval_record` tied to the same candidate ID, source event, wiki commit, evidence-page bindings, action, target skill, and packet hash; set `promotion: approved`, then `applying`, and send exactly that immutable packet to `vb-learn`. A retry reuses the candidate ID and reruns the staleness guard. Only a proven tool commit carrying `VibeRig-Candidate: <candidate-id>` sets `promotion: completed`; interruption/error sets `failed` and resumes the same application.
- Explicit no → atomically acknowledge the outbox with `promotion: declined` and stop. Ambiguity or no answer → keep the same queued `proposal_pending`; a later eligible report may replay that exact candidate, and a later explicit bound reply may resolve it. In every case, do not invoke `vb-learn`, and keep `~/.vb-skills` / `vb-skill-lock.json` byte-identical unless explicit approval is recorded.
- Acceptance of the original work never counts as this confirmation.
