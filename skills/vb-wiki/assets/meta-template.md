---
github_repo: <owner/repo slug, or empty if no origin remote>
linear_project_id: <uuid, or empty if not set in .vibeRig/project.yaml>
created: <ISO 8601 date>
updated: <ISO 8601 date>
---

# <project-key> — project meta

Identity fields used for cross-path project matching (`JSO-272`):

- `github_repo` — derived from `git remote get-url origin`, parsed to an
  `owner/repo` slug (strips the `https://github.com/`, `git@github.com:`, or
  `ssh://git@github.com/` prefix and any trailing `.git`). Empty if the repo
  has no `origin` remote.
- `linear_project_id` — read from this repo's `.vibeRig/project.yaml`,
  `linear.project_id` field. Empty if not set.

A renamed or relocated clone of this repo is matched back to this same
`<project-key>` directory whenever **either** field still matches — see
`skills/vb-wiki/SKILL.md` Step 2b.

Base architecture: <brief description, filled in / extended as project notes
accumulate over time — not required on first write>.
