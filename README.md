# VibeRig

VibeRig is a Codex plugin for turning rough requirements into reviewable
planning artifacts, local execution tasks, isolated worktrees, and
post-acceptance learning notes.

Repository: [JsonLee12138/vibeRig](https://github.com/JsonLee12138/vibeRig)

中文文档: [README.zh-CN.md](./README.zh-CN.md)

## What It Provides

- `brainstorm`: turns a requirement into `requirement.md`, `research.md`,
  `acceptance.md`, `roadmap.md`, and `spec.md`.
- `write-plan`: turns brainstorm output into `plan.md`, `tasks.yaml`, optional
  Linear child issue drafts, worktree strategy, validation commands, and
  subagent assignments.
- `init-viberig`: initializes a target project with `.vibeRig/`, local
  worktree folders, global panel registration, and default runtime config.
- `insights`: records conservative learning candidates after accepted work.
- `api/server.py`: runs the local VibeRig backend and panel at
  `http://127.0.0.1:49160`.

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
git submodule update --init plugins/vibe-rig
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
    viberig
  requirements/
  insights/
.codex/agents/
worktrees/
.gitignore
```

The default worktree root is `./worktrees`. VibeRig also ensures the global
local panel is available at a fixed URL:

```text
http://127.0.0.1:49160
```

Project initialization starts the global VibeRig daemon if needed, installs a
macOS LaunchAgent for login autostart when supported, and registers the current
project.

## Run Planning And Implementation

Use the global VibeRig panel:

```text
http://127.0.0.1:49160
```

From there, select a project, import requirement tasks, review the board, run
ready local task flows, and record evidence and acceptance.

## Global State

VibeRig stores local service state outside project repositories:

```text
~/.viberig/
  projects.json
  runtime/
    daemon.json
  logs/
  runs/
  exports/
```

Business code and implementation work stay under each project's
`worktrees/` directory.

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

5. Import the requirement into the VibeRig panel and review the task board.
6. Run each task in its own branch and `./worktrees/<task>` directory.
7. Record validation evidence, acceptance review, and code review.
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
  local runtime artifacts and usually should not be committed.
