# Human Acceptance Comment Template

Render in `.vibeRig/project.yaml` `output.language`. The English headings below are structural examples, not required literal text.

```markdown
## Human Acceptance

Decision: <accepted | partially accepted | rejected | blocked>
Accepted by: <user-provided name or current user>

## AC Coverage
- Accepted: AC-...
- Rejected/unverified: AC-...

## Manual Checks
- <check/result>

## Risk Decision
- <accepted residual risks or rejection reasons>

## PR And Linear
- PR: <merged | not merged | not required | blocked: reason>
- Linear status: <done | accepted | completed | unchanged | blocked: reason>

## Follow-up
- Insights: <generated | skipped with reason>
- Skill updates: <applied through skill-builder | proposed | none>
- Skill curation proposals: <insert/update/deprecate/noop | none>
- Requirement docs archive: <moved source -> destination | skipped | blocked: reason>
- Worktree cleanup: <removed | skipped | blocked: reason>
```
