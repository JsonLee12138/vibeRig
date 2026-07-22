---
github_repo: <owner/repo slug, or empty if no origin remote>
linear_project_id: <uuid, or empty if not set in .vibeRig/project.yaml>
repo_root_fingerprint: <sha256 digest used only when both external identities are empty>
created: <ISO 8601 date>
updated: <ISO 8601 date>
---

# <project-key> — project meta

Identity fields used for cross-path project matching:

- `github_repo` — derived from `git remote get-url origin`, parsed to an
  `owner/repo` slug (strips the `https://github.com/`, `git@github.com:`, or
  `ssh://git@github.com/` prefix and any trailing `.git`). Empty if the repo
  has no `origin` remote.
- `linear_project_id` — read from this repo's `.vibeRig/project.yaml`,
  `linear.project_id` field. Empty if not set.
- `repo_root_fingerprint` — deterministic digest of sorted root commit OIDs; set
  only when both external identities are unavailable, never used to override an
  external identity match.

A renamed or relocated clone of this repo is matched back to this same
`<project-key>` directory only through the unique valid identity match defined by
the project-identity protocol. Architecture,
conventions, and other usable knowledge belong in canonical content pages; this
identity file is excluded from retrieval.
