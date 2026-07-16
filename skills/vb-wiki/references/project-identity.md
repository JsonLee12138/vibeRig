# Project identity matching (Step 3b details)

Resolves `PROJECT_KEY` so a renamed or relocated clone of the same repo
reuses its original `~/.vb-wiki/projects/<key>/` directory instead of
forking a new one.

## Extract the current repo's identity

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
CURRENT_GITHUB_REPO=$(echo "$REMOTE_URL" | sed -E 's#^(https?://[^/]+/|git@[^:]+:|ssh://git@[^/]+/)##; s#\.git$##')

CURRENT_LINEAR_PROJECT_ID=$(awk '
  /^linear:/ { in_linear=1; next }
  /^[^ ]/ { in_linear=0 }
  in_linear && /^[ ]+project_id:/ {
    sub(/^[ ]+project_id:[ ]*/, "");
    gsub(/"/,"");
    print;
    exit
  }
' .vibeRig/project.yaml)
```

- `CURRENT_GITHUB_REPO` is the `owner/repo` slug (handles `https://`,
  `git@host:`, and `ssh://` remote forms). This is a deliberate
  simplification of "GitHub repo id" — the numeric id needs an API call,
  and the slug is stable across local renames/relocations (it only changes
  if the repo is renamed *on GitHub*, in which case matching falls back to
  the Linear id). No `origin` remote → empty, that half of the match is
  simply unavailable.
- `CURRENT_LINEAR_PROJECT_ID` is empty if `.vibeRig/project.yaml` has no
  `linear.project_id`.

## Scan existing projects for a match

```bash
CANDIDATE_KEY=$(awk -F': *' '/^project:/{p=1} p && /name:/{gsub(/"/,"",$2); print $2; exit}' .vibeRig/project.yaml)

PROJECT_KEY=""
for META in ~/.vb-wiki/projects/*/meta.md; do
  [ -f "$META" ] || continue
  EXISTING_GITHUB_REPO=$(awk -F': *' '/^github_repo:/{gsub(/"/,"",$2); print $2; exit}' "$META")
  EXISTING_LINEAR_PROJECT_ID=$(awk -F': *' '/^linear_project_id:/{gsub(/"/,"",$2); print $2; exit}' "$META")
  if { [ -n "$CURRENT_GITHUB_REPO" ] && [ "$CURRENT_GITHUB_REPO" = "$EXISTING_GITHUB_REPO" ]; } \
     || { [ -n "$CURRENT_LINEAR_PROJECT_ID" ] && [ "$CURRENT_LINEAR_PROJECT_ID" = "$EXISTING_LINEAR_PROJECT_ID" ]; }; then
    PROJECT_KEY=$(basename "$(dirname "$META")")
    break
  fi
done

if [ -z "$PROJECT_KEY" ]; then
  PROJECT_KEY="$CANDIDATE_KEY"
  NEW_PROJECT_META=true    # first-ever write for this project: Step 4 must also create its meta.md
else
  NEW_PROJECT_META=false   # matched — reuse; never create a second directory
fi
```

## Rules and edge cases

- **Either field matching is sufficient** — `github_repo` OR
  `linear_project_id`, never require both. An empty current field is
  excluded from comparison, not treated as a wildcard.
- On a match, `PROJECT_KEY` is the **existing** directory's name even when
  it differs from `CANDIDATE_KEY` — the renamed clone's derived name is
  discarded.
- Both identity fields empty (no remote, no Linear id) → no match is ever
  possible; a new directory is created. Degraded but safe: knowledge forks
  rather than being lost.
- Two `meta.md` files matching the same identity is a pre-existing dedup
  problem: the scan takes the first match in glob order and does not try to
  repair it.
