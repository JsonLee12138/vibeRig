---
name: vb-learn
description: >-
  Create or refine exactly one user-approved tool skill in ~/.vb-skills. Use
  only for direct “做成 skill / 创建工具” requests or an approved promotion
  packet handed off after vb-wiki persisted its decision; never for a bare
  proposal reply, generic learning, or note capture.
---

# VB Learn

Compile one explicitly authorized capability into a discoverable tool skill: the hammer plus its operating instructions. `vb-learn` is not the self-learning default and does not mine completed work for additional skill candidates.

## Contract

- Single responsibility: create or refine exactly one approved skill package under `~/.vb-skills`, update its lock entry, validate it, and commit it.
- Valid authority is either an explicit current-conversation request to create/refine a named capability as a skill, or one approved promotion packet handed off after `vb-wiki` persisted the candidate-bound approval and application phase. A bare yes/no reply belongs to `vb-wiki`, not this skill.
- “学习这个 Issue”, “记录经验”, “沉淀一下”, and “记录这个 pattern” mean knowledge capture and must route to `vb-wiki`.
- `accept-issue`, `accept-milestone`, `merge-issue`, and `insights` must never invoke this skill automatically.
- Do not discover, propose, or create a second candidate from the source material.
- A `vb-wiki` candidate ID is the application idempotency key. A retry must prove or resume that exact candidate, never create a second tool commit for it.

## Input Contract

Required: one approved promotion packet containing:

- `explicit_authorization`: the current-conversation user statement;
- `action`: the approved `create` or `refine` operation;
- `target_skill`: the exact approved kebab-case package name;
- `capability`: the independently invocable action;
- `why_wiki_insufficient`;
- `when` and `when_not`;
- `input` and `output`;
- `reusable_mechanism`: workflow, scripts, templates, APIs/tools, or a combination;
- `verify` and `safety_boundaries`;
- `evidence`: wiki pages, files, docs, or accepted work supporting this one capability.

For a `vb-wiki` handoff, also require `candidate_id`, `source_event`, `wiki_commit`, `packet_sha256`, `approval_record`, and persisted promotion state `approved` / `applying` / `failed`, all referring to the same immutable proposal/action/target. Recompute the canonical packet hash before any recovery or write. A direct user tool request uses its verbatim current-conversation authorization instead and does not fabricate wiki provenance.

For a direct user request, infer missing packet fields from the named capability and local sources. If the capability, authority, or target cannot be inferred safely, ask the single blocking question before any write. Never broaden a direct request into multiple candidates.

## Workflow

1. **Verify authority and routing**.
   - Explicit direct “create/refine this skill/tool” request → continue.
   - Complete `vb-wiki` handoff packet with persisted candidate-bound approval/application state → continue.
   - Bare yes/no to a pending `vb-wiki` proposal → stop with `redirect: vb-wiki`; zero writes. `vb-wiki` must bind the reply, persist phase transitions, and then hand off.
   - Generic learning/note language → stop with `redirect: vb-wiki`; zero writes.
   - Acceptance of delivered work without separate tool authorization → stop with `not_authorized`; zero writes.
2. **Normalize exactly one packet**. Fill [the skill-builder prompt](assets/skill-builder-prompt.md). Every required field must be concrete; task IDs may remain evidence references but must not leak into the reusable SKILL.md body.
3. **Verify the tool store**. Require `~/.vb-skills` to be a git repository with `vb-skill-lock.json`. If missing, return `blocked: run vb-init`; do not initialize an ad hoc store from this skill.
4. **Recover a `vb-wiki` handoff before editing**. For a packet with `candidate_id`, search all tool-store commit messages for the exact trailer `VibeRig-Candidate: <candidate_id>`.
   - Exactly one matching commit is reachable from current `HEAD`, contains only its approved target plus lock change, and its target plus lock validate → return `already_applied` with that commit, so the caller can persist `promotion: completed`.
   - Exactly one matching commit exists but its committed target is now missing, renamed, corrupt, or inconsistent with the current lock → return `blocked: candidate_commit_invalid` with zero writes. Never apply the candidate again or silently repair later drift; repair/refinement needs separate explicit authority.
   - More than one matching commit exists → return `blocked: candidate_history_ambiguous` with zero writes; do not guess which application is canonical.
   - A matching commit not reachable from current `HEAD` → return `blocked: candidate_commit_unreachable`; do not merge, cherry-pick, or reapply without separate authority.
   - With no matching commit, load the persisted tool transaction fields; never infer candidate ownership merely because only the target and lock are dirty.
   - Direct user tool requests have no fabricated candidate ID and use normal pre-existing-change checks instead.
5. **Validate the exact approved target**. Read `~/.vb-skills/vb-skill-lock.json` and semantically inspect close existing skills.
   - `vb-wiki` handoff → verify the persisted `action` and `target_skill` are still safe and exact. If another target would now be preferable, a create target now exists, a refine target disappeared, or the capability maps differently, return `blocked: target_reauthorization_required` with zero writes. Never retarget an approved candidate.
   - Direct request with an explicit action/package → keep that target; if safety or duplication suggests a different package, ask for new target-specific authorization before writing.
   - Direct request naming only a capability → infer one action/target when unambiguous; otherwise ask the single blocking question. Never fan out.
6. **Establish the tool-store transaction before editing**.
   - Require no staged change anywhere in `~/.vb-skills`; never clear or absorb a user's index. Require the exact target and `vb-skill-lock.json` to have no unstaged change. Unrelated unstaged paths may remain untouched and must be reported.
   - For a fresh `vb-wiki` application, capture full `tool_base_commit`, event paths, target baseline tree OID (or `absent`), and lock baseline blob OID, then ask `vb-wiki` to persist them with `promotion: applying` before invoking the builder.
   - On retry with no candidate commit: `HEAD`, target, and lock must match the persisted baselines. Clean baseline paths with no `tool_staged_tree` may restart generation; a recorded staged tree may resume only when the exact staged path set, `git write-tree`, and absence of unstaged target/lock changes match. Any dirty path without that proof returns `blocked: candidate_worktree_conflict`; an advanced base returns `blocked: candidate_store_advanced`.
   - A direct request applies the same clean-index/target/lock preflight. Pre-existing target/lock changes block it; they are never presumed to be this request's draft.
7. **Invoke `skill-builder` once per proven generation attempt** with the complete packet and exact target directory. Let it choose concise SKILL.md content plus only the scripts/references/assets needed to make the capability executable and verifiable. A retry already holding a matching `tool_staged_tree` skips generation and resumes validation/commit only.
8. **Run the trigger quality gate**. Test at least three should-trigger and three should-not-trigger prompts. Require a clear contract, inputs/outputs, stop rules, validation commands, and no unresolved placeholders outside marked examples.
9. **Update and validate the lock**.

   ```bash
   npx vibe-rig skill-lock update <target_skill>
   npx vibe-rig skill-lock validate
   ```

   Hard stop on either failure.
10. **Stage and persist identity**. Run `git add` exactly once for `<target_skill>/` and `vb-skill-lock.json`; require that exact staged path set and no unstaged change on either. For a `vb-wiki` handoff, run `git write-tree` and persist the full OID as `tool_staged_tree` before commit. A mismatch or unpersisted dirty draft fails closed.
11. **Commit only this approved tool**. Refuse to absorb unrelated or pre-existing changes. A `vb-wiki` handoff must include its exact stable candidate trailer:

   ```bash
   git -C ~/.vb-skills diff --cached --name-only
   git -C ~/.vb-skills diff --quiet -- <target_skill> vb-skill-lock.json
   git -C ~/.vb-skills write-tree # must still equal persisted tool_staged_tree; do not run git add again
   git -C ~/.vb-skills commit -m "vb-learn: <action> <target_skill>" -m "VibeRig-Candidate: <candidate_id>"
   ```

   Use the packet's approved `action` and `target_skill`; do not switch them during implementation. For a `vb-wiki` handoff, require the commit's first parent/tree to match `tool_base_commit` / `tool_staged_tree`, and require it to be reachable from current `HEAD`. For a direct user request, omit the candidate trailer rather than inventing wiki provenance. After commit, re-run the exact trailer search and lock validation; only that proof permits `completed`. Later dirty target/lock paths are reported but never folded into this candidate commit.

## Output Contract

Return:

- authorization reference, source evidence, and candidate ID/application status when handed off by `vb-wiki`;
- created/refined skill name and path;
- capability, When, and When NOT captured;
- reusable resources added or intentionally omitted;
- trigger tests, validation result, lock result, and the proven candidate-tagged commit hash when applicable.

Do not claim success unless exactly one target skill changed, lock validation passed, and the proven commit contains only that skill plus the lock. The target/lock must be clean at commit completion; unrelated user paths may remain and are reported without being staged.

## Red Flags

- A Linear key alone is treated as permission to create a skill → redirect to `vb-wiki` unless the user explicitly requested tool creation.
- A bare yes to a `vb-wiki` proposal enters this skill before `approval_record` and promotion state are persisted → redirect to `vb-wiki`; do not infer or bind the candidate here.
- A close skill with a different name is selected after the user approved the candidate → stop with `target_reauthorization_required`; similarity does not authorize another package.
- The workflow summarizes all task details before choosing a tool → wrong direction; consume only the approved capability packet.
- Several “reusable lessons” become several skills → stop; this invocation is exactly one tool.
- A documentation-only package is accepted even though reading the wiki would suffice → return to `vb-wiki`; the hammer is missing.
- Existing unrelated `~/.vb-skills` changes are staged → stop and report; never rewrite the user's index to make this invocation proceed.
- A retry of an approved candidate creates a second commit or regenerates a different packet → search the exact candidate trailer first and resume only the persisted target.
- Dirty target/lock paths are treated as the approved candidate merely because no other paths changed → return `candidate_worktree_conflict` unless exact base and staged-tree proof exists.
- An existing candidate-tagged commit no longer validates, so the workflow reapplies or repairs it implicitly → fail closed with `candidate_commit_invalid`; historical application and later maintenance are separate authorities.

## Anti-Rationalization

| Rationalization | Reality |
|---|---|
| “The work was accepted, so creating its skill is implied.” | Delivery acceptance and global tool installation are separate authorities. |
| “I found another good candidate while reading the source.” | It was not approved. Ignore it or let a later `vb-wiki` event evaluate it. |
| “A long checklist is a tool.” | A tool must perform an action through a stable contract; passive guidance belongs in the wiki. |

## Validation

```bash
npx vibe-rig skill-lock validate
git -C ~/.vb-skills show --name-only --format= HEAD
git -C ~/.vb-skills log --all --fixed-strings --grep="VibeRig-Candidate: <candidate_id>" --format="%H"
git -C ~/.vb-skills status --porcelain
```

- [ ] Current-conversation authorization is explicit and attached to one packet.
- [ ] A `vb-wiki` handoff was recovered by exact candidate ID; an existing proven commit returned `already_applied` instead of writing again.
- [ ] Exactly one skill was created/refined; no extra candidate was mined.
- [ ] Trigger tests include at least three positive and three negative examples.
- [ ] Skill contents are reusable and contain no task-specific IDs or unresolved placeholders outside examples.
- [ ] Candidate recovery verified base/baselines and staged tree; no user change was inferred, cleared, absorbed, or recommitted.
- [ ] Commit contains only the target skill and `vb-skill-lock.json`, carries the exact candidate trailer when applicable, and its target/lock paths are clean.
