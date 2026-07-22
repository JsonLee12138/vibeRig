# Project Identity Matching And Safe Routing

Resolve a stable, path-safe `PROJECT_KEY` so one repository reuses its existing
`~/.vb-wiki/projects/<key>/` subtree while unrelated repositories never collide.
This protocol returns an identity decision; it does not create directories.

## 1. Extract Stable Identity

Read the current repository's normalized identity:

- `github_repo`: lowercase `owner/repo` parsed from the exact `origin` URL after
  removing transport/host syntax and one trailing `.git`; empty when unavailable.
- `linear_project_id`: exact non-empty `.vibeRig/project.yaml`
  `linear.project_id`; empty when unavailable.
- `repo_root_fingerprint`: full lowercase SHA-256 of the repository's sorted root
  commit OIDs, each followed by LF. Compute it only when both external fields are
  empty. No root commit means `blocked: project_identity_unavailable`.

Never treat an empty value as a wildcard. Preserve the exact extracted values in
the planned `meta.md`; do not guess a GitHub numeric ID or infer Linear identity
from a project name.

## 2. Match Existing Projects

Inventory every committed `projects/*/meta.md` from the selected wiki tree. Before
reading a record, validate its directory basename as a single safe component:

```text
^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$
```

Reject `.`, `..`, empty names, absolute paths, separators, control characters,
backslashes, percent-encoded separators, or a path whose real parent is not the
wiki's exact `projects/` directory with `blocked: project_key_unsafe`. Symlinked
project directories are not valid identity records.

An existing record matches when one non-empty current external identity equals the
same normalized field in `meta.md`. Either exact external field is sufficient. If
external identities are both empty, match only a stored
`repo_root_fingerprint` with exact equality; a display/project name is never identity.

- More than one matching record → `blocked: project_identity_ambiguous`.
- One matching record → reuse its validated directory basename byte-for-byte.
- No matching record → derive a new key as described below.

If current GitHub and Linear fields individually point to different existing records,
that is also `blocked: project_identity_ambiguous`; never pick by scan order.

## 3. Derive A Collision-Resistant New Key

Make a display stem from `.vibeRig/project.yaml` `project.name`: Unicode NFKD,
lowercase, retain ASCII `a-z0-9`, replace each other run with one `-`, trim `-`,
and cap at 48 characters without leaving a trailing `-`. Use `project` if empty.
The stem is navigation only, not identity.

Build the identity seed with UTF-8/LF exactly:

```text
github_repo=<normalized value or ->
linear_project_id=<exact value or ->
repo_root_fingerprint=<full digest or ->
```

At least one line must have a non-`-` value. Set
`PROJECT_KEY = <stem>--<first-12-hex-of-sha256(identity-seed)>` and validate the
final key/path again with the rules above. This makes two identity-less repositories
named `app` fork by stable root history instead of sharing `projects/app/`.

If the derived directory already exists but did not match the current identity,
return `blocked: project_key_collision`; do not reuse, overwrite, or add a numeric
suffix. Otherwise return `NEW_PROJECT_META: true` and plan `meta.md` in the same
knowledge transaction. Store `repo_root_fingerprint` when it supplied identity.

## 4. Route Proof

Before a page plan can use a project route, prove all of the following:

1. `PROJECT_KEY` came from the unique-match or new-key procedure above.
2. Joining `projects/<PROJECT_KEY>` and the validated relative page components,
   then resolving the existing parent, remains strictly beneath the wiki root's
   exact `projects/` directory.
3. `tech-dir` and slug are safe single components; the slug is kebab-case ASCII.
4. The page's `project_key` and path segment agree; its opaque `page_id` is valid,
   unique, and unchanged, never derived again from the current path.

Any failed proof is a zero-write block. A rename/relocation reuses a uniquely matched
existing key; identity changes without a surviving match intentionally fork instead
of contaminating another project's knowledge.
