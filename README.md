# VibeRig

VibeRig is a project-local Codex plugin for turning rough requirements into
reviewable planning artifacts, Symphony-ready execution tasks, isolated
worktrees, and post-acceptance learning notes.

Repository: [JsonLee12138/vibeRig](https://github.com/JsonLee12138/vibeRig)

中文文档: [README.zh-CN.md](./README.zh-CN.md)

## What It Provides

- `brainstorm`: turns a requirement into `requirement.md`, `research.md`,
  `acceptance.md`, `roadmap.md`, and `spec.md`.
- `write-plan`: turns brainstorm output into `plan.md`, `tasks.yaml`, Linear
  child issue drafts, worktree strategy, and Symphony workflow inputs.
- `init-viberig`: initializes a target project with `.vibeRig/`, workflow
  files, local worktree folders, and default runtime config.
- `insights`: records conservative learning candidates after accepted work.
- `vendor/symphony`: pinned Symphony reference runtime used by the helper
  scripts.

## Install From The Marketplace

This repository includes a marketplace file at
`.agents/plugins/marketplace.json`, so Codex can track it as a marketplace
source:

```sh
codex plugin marketplace add JsonLee12138/vibeRig --ref main
codex plugin marketplace list
```

Restart Codex, open the plugin directory, choose the `VibeRig` marketplace, and
install the `VibeRig` plugin. Codex installs enabled plugins into its plugin
cache; it does not execute directly from this source repository.

## Install For One Codex Project

Use a repo-scoped marketplace when you only want VibeRig available in one
project. In the target project, create `.agents/plugins/marketplace.json`:

```json
{
  "name": "viberig-project",
  "interface": {
    "displayName": "VibeRig Project"
  },
  "plugins": [
    {
      "name": "vibe-rig",
      "source": {
        "source": "url",
        "url": "https://github.com/JsonLee12138/vibeRig.git",
        "ref": "main"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Restart Codex, open the plugin directory, choose the `VibeRig Project`
marketplace, and install the plugin. The plugin technical name is `vibe-rig`;
the display name is `VibeRig`.

If you need a deterministic local path for running helper scripts directly,
store the plugin under the target repo and point the marketplace at that local
folder:

```sh
mkdir -p .agents/plugins plugins
git submodule add https://github.com/JsonLee12138/vibeRig plugins/vibe-rig
git submodule update --init --recursive plugins/vibe-rig
```

Use this local-source marketplace entry instead:

```json
{
  "name": "viberig-project",
  "interface": {
    "displayName": "VibeRig Project"
  },
  "plugins": [
    {
      "name": "vibe-rig",
      "source": {
        "source": "local",
        "path": "./plugins/vibe-rig"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

`source.path` is resolved relative to the repo root, not relative to the
`.agents/plugins/` directory. After changing the source plugin files, restart
Codex so the installed cache picks up the new version.

## Initialize A Target Project

After installing the plugin, ask Codex to run the `init-viberig` skill for the
target project.

If you installed VibeRig as a local source under `plugins/vibe-rig`, you can
also run the initializer directly:

```sh
python3 plugins/vibe-rig/scripts/init_project.py . \
  --project-name "<project-name>" \
  --test-command "npm test"
```

This creates or ensures:

```text
.vibeRig/
  config.yaml
  bin/
    symphony-setup
    symphony-planning
    symphony-implementation
  requirements/
  insights/
.codex/agents/
WORKFLOW.planning.md
WORKFLOW.implementation.md
worktrees/
.gitignore
```

The default worktree root is `./worktrees`. VibeRig uses high, less common
ports and checks for the next free one before starting Symphony dashboards:

- planning dashboard starts at `49170`
- implementation dashboard starts at `49180`
- app preview convention starts at `49200`

## Set Up Symphony

Symphony should live inside the VibeRig plugin, not inside each business
project. During project initialization, VibeRig creates project-local command
wrappers under `.vibeRig/bin/`; those wrappers call the plugin runtime and pass
the current project as the target.

If you use the recommended local-source install, VibeRig expects the plugin at
`plugins/vibe-rig/` and Symphony at `plugins/vibe-rig/vendor/symphony`. Because
this repository vendors Symphony as a submodule, make sure recursive submodules
are initialized:

```sh
git submodule update --init --recursive plugins/vibe-rig
```

Then build the Symphony runtime:

```sh
.vibeRig/bin/symphony-setup
```

To build the bundled Symphony runtime during project initialization, run:

```sh
python3 plugins/vibe-rig/scripts/init_project.py . --setup-symphony
```

The setup script uses `mise` inside `vendor/symphony/elixir`, so `mise` must be
installed locally.

If you installed only from a Git-backed marketplace, Codex will run the plugin
from its cache. Use the plugin skills from Codex, or use the local-source
install when you want to run the helper scripts by path in your shell.

## Run Planning And Implementation

Symphony requires Linear access:

```sh
export LINEAR_API_KEY="<your-linear-api-key>"
```

Start the planning workflow:

```sh
.vibeRig/bin/symphony-planning
```

Start the implementation workflow:

```sh
.vibeRig/bin/symphony-implementation
```

The selected dashboard ports are written to `.vibeRig/runtime.json`.

## Typical Workflow

1. Ask Codex to run VibeRig brainstorm for a requirement.
2. Review the generated requirement documents under
   `.vibeRig/requirements/<requirement-name>/`.
3. Ask Codex to run VibeRig write-plan for that requirement.
4. Validate `tasks.yaml`:

   ```sh
   python3 plugins/vibe-rig/scripts/validate_tasks.py \
     .vibeRig/requirements/<requirement-name>/tasks.yaml
   ```

5. Render Linear child issue drafts if needed:

   ```sh
   python3 plugins/vibe-rig/scripts/render_linear_children.py \
     .vibeRig/requirements/<requirement-name>/tasks.yaml
   ```

6. Run Symphony planning or implementation workflows.
7. Review each task in its own branch and `./worktrees/<task>` directory before
   merging.
8. After accepted work, run VibeRig insights to record learning candidates.

## Notes

- Keep `brainstorm` and `write-plan` separate. Brainstorm produces requirement
  truth; write-plan produces execution contracts.
- Commit each completed task branch before starting dependent work, so later
  tasks can base on a stable branch or `origin/main`.
- Always sync the worktree base before implementation. VibeRig task contracts
  default to `origin/main`.
- Missing specialized subagents should be created deliberately with the
  `agent-creator` skill instead of overloading one general agent.
- `worktrees/`, `.vibeRig/runtime.json`, and `.vibeRig/context-mode.md` are
  local runtime artifacts and should stay out of normal commits.
