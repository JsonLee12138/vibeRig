---
name: vb-init
description: Initialize or reconcile a project for the Linear-native VibeRig workflow. Use when the user asks to set up VibeRig, create .vibeRig project registration, connect to Linear, configure CI gates, set up the agent team, or wire the global ~/.vb-skills learned-skill store. Do not use to create requirements, tasks, or implementation branches.
---

# VB Init

Prepare a project for the Linear-native VibeRig workflow: local docs structure, `.vibeRig/project.yaml`, Linear registration, Codex agent team, and the global learned-skill store at `~/.vb-skills`.

All steps are **idempotent** — re-running skips what already exists.

## Contract

Single responsibility: initialise or reconcile **one project** and its global skill store. Stop and ask when the Linear team/project choice cannot be inferred safely.

Do not create requirements, tasks, branches, dashboards, or MCP runner config.

## Output

```text
<project-root>/
├── AGENTS.md                    (VibeRig inject block from assets/agents-md-inject.md)
├── CLAUDE.md  ->  AGENTS.md
├── .vibeRig/project.yaml        (see references/project-config-template.md)
├── .vibeRig/prd/                (PRD 目录，含 archive/)
├── .vibeRig/requirements/       (需求目录，含 archive/)
├── .gitignore                   (".worktrees/" entry ensured)
├── .agents/skills/              (pre-installed: insights, skill-builder, skillos-lite)
├── .claude/skills  ->  ../.agents/skills
├── .codex/agents/*.toml         (baseline team, all 3 platforms rendered by built-in-agents)
├── .claude/agents/*.md
├── .cursor/agents/*.md
└── .worktrees/                  (fixed path — not configurable)

~/.vb-skills/                    (global learned-skill git repo, one per machine)
├── .git/
└── vb-skill-lock.json

~/.agents/skills/vb  ->  ~/.vb-skills   (Codex discovery symlink)
~/.claude/skills/vb  ->  ~/.vb-skills   (Claude Code discovery symlink)
```

## Workflow

### 1. Locate project root
Use current workspace or git root unless the user provides a path.
Inspect existing `AGENTS.md`, `.vibeRig/project.yaml`, and `.vibeRig/requirements/`.

### 2. Project scaffolding

```bash
mkdir -p .vibeRig/requirements/archive .vibeRig/prd/archive .worktrees
mkdir -p .agents/skills
[ ! -L .claude/skills ] && { mkdir -p .claude; ln -s ../.agents/skills .claude/skills; }

# .worktrees is a fixed path, always ignored — not a config option
grep -qxF '.worktrees/' .gitignore 2>/dev/null || printf '%s\n' '.worktrees/' >> .gitignore
```

Pre-install `insights`, `skill-builder`, `skillos-lite` at project level via `find-skills`.
Log missing skills in the init report; do not abort.

### 3. Global learned-skill store (idempotent)

```bash
# a. Init git repo
git -C ~/.vb-skills rev-parse --git-dir 2>/dev/null \
  || git init ~/.vb-skills

# b. Create empty lock if absent
if [ ! -f ~/.vb-skills/vb-skill-lock.json ]; then
  printf '{\n  "version": 1,\n  "skills": {}\n}\n' \
    > ~/.vb-skills/vb-skill-lock.json
  git -C ~/.vb-skills add vb-skill-lock.json
  git -C ~/.vb-skills commit -m "chore: init vb-skill-lock"
fi

# c. Codex discovery symlink — MUST be inside ~/.agents/skills/
mkdir -p ~/.agents/skills
[ ! -L ~/.agents/skills/vb ] \
  && ln -s ~/.vb-skills ~/.agents/skills/vb

# d. Claude Code discovery symlink
mkdir -p ~/.claude/skills
[ ! -L ~/.claude/skills/vb ] \
  && ln -s ~/.vb-skills ~/.claude/skills/vb
```

> **Critical**: symlinks must be `~/.agents/skills/vb → ~/.vb-skills` and `~/.claude/skills/vb → ~/.vb-skills`.
> `~/.agents/vb` (sibling of `skills/`) is outside Codex scan depth and will never be discovered.

### 4. project.yaml

Create or update `.vibeRig/project.yaml` from [references/project-config-template.md](./references/project-config-template.md).
Required fields: `output.language` (BCP 47), pull request policy, gate policy, Linear ids, the four `subagents` defaults (`default_research`, `default_qa`, `default_security_audit`, `default_review`).
There is no `workspace` section — the worktree root is always the fixed project path `.worktrees/`.

### 5. AGENTS.md

Copy the inject block from [assets/agents-md-inject.md](./assets/agents-md-inject.md) between
`<!-- inject:viberig:start -->` and `<!-- inject:viberig:end -->` tags.
Preserve all unrelated project rules already in `AGENTS.md`.

```bash
[ ! -L CLAUDE.md ] && [ ! -e CLAUDE.md ] && ln -s AGENTS.md CLAUDE.md
```

Claude Code reads `CLAUDE.md` by convention; symlink it to `AGENTS.md` so both platforms share one source of truth. Skip if `CLAUDE.md` already exists as a real file (do not overwrite user content).

### 6. Linear registration

See the `linear` skill for tool mapping and fallback behavior.

**6a. 登录校验（先于任何 project 操作）**

调用任意只读 Linear 工具（如 `_list_teams`）探测登录态：
- 工具返回正常 → 已登录，进入 6b。
- 工具报鉴权/未授权错误，或 Linear MCP 未连接 → 未登录，触发 Linear OAuth 登录流程，等待用户完成授权后重试探测一次。仍失败则按 Linear 工具不可用处理（见下）。

**6b. Project 注册**（仅在 6a 确认已登录后执行）
- `_list_teams` / `_get_team` → confirm team.
- `_search` + `_list_projects` → find existing project (search before creating).
- `_save_project` → create only if none found. 该 Project 是**常驻容器**：后续所有需求的 Milestone / Issue 都挂在它下面（里程碑原生工作流），不要按需求另建 Project。
- `_list_documents` + `_save_document` → create/update Project Document.
- Write resolved Linear ids to `project.yaml`.

Report as **partial** when Linear tools are unavailable (including login declined/failed); do not claim full registration.

### 7. Agent team

**7a. 安装插件基线 agents**

调用 `built-in-agents`，将 vb-plugin 自带的 8 个基线 agent 渲染到 Codex（`.codex/agents/*.toml`）、Claude Code（`.claude/agents/*.md`）、Cursor（`.cursor/agents/*.md`）三个平台（已存在的跳过）。

**7b. 调用 `update-team` 分析项目**

调用 `update-team`，基于 `.vibeRig/requirements/` 或 `.vibeRig/prd/` 和 Linear 未执行 issues 或 milestones 推理出项目所需的额外 agent 角色，并完成创建与 `project.yaml` 的 `subagents` 更新。

### 8. Report

Project YAML, AGENTS.md, docs root, output language, Linear Project/Document status,
gate policy, agent team (created / existed / skipped), global store status.

## Validation

```bash
# Local project
ls .vibeRig/project.yaml .vibeRig/requirements/ .worktrees/ AGENTS.md
grep "language:" .vibeRig/project.yaml
grep -qxF '.worktrees/' .gitignore && echo "gitignore ok"
test -L CLAUDE.md && readlink CLAUDE.md | grep -q AGENTS.md && echo "symlink ok"
test -L .claude/skills && echo "symlink ok"
ls .agents/skills/insights/ .agents/skills/skill-builder/ .agents/skills/skillos-lite/
ls .codex/agents/*.toml .claude/agents/*.md .cursor/agents/*.md

# Global learned-skill store
git -C ~/.vb-skills rev-parse --git-dir && echo "vb-skills git ok"
ls ~/.vb-skills/vb-skill-lock.json
test -L ~/.agents/skills/vb \
  && readlink ~/.agents/skills/vb | grep -q vb-skills \
  && echo "symlink ok" || echo "SYMLINK MISSING"
test -L ~/.claude/skills/vb \
  && readlink ~/.claude/skills/vb | grep -q vb-skills \
  && echo "symlink ok" || echo "SYMLINK MISSING"
```

- [ ] `.vibeRig/project.yaml` has all required sections including `output.language`; no `workspace` section present.
- [ ] Root `AGENTS.md` contains the VibeRig inject block.
- [ ] `CLAUDE.md` symlinks to `AGENTS.md` (or was already a real file, left untouched).
- [ ] `.claude/skills` symlinks to `../.agents/skills`.
- [ ] `insights`, `skill-builder`, `skillos-lite` present in `.agents/skills/`.
- [ ] Baseline agents present across `.codex/agents/`, `.claude/agents/`, `.cursor/agents/` (or gaps reported).
- [ ] `.worktrees/` exists and is listed in `.gitignore`.
- [ ] `~/.vb-skills` is a git repo with `vb-skill-lock.json`.
- [ ] `~/.agents/skills/vb` and `~/.claude/skills/vb` both symlink to `~/.vb-skills`.
- [ ] Linear login was verified (or login was triggered) before any `_save_project` call.
- [ ] Linear registration complete, or partial explicitly reported.

## Hard Rules

- Do not add VibeRig MCP settings to `.codex/config.toml`.
- Do not start or register a local VibeRig dashboard.
- Do not place the Codex symlink at `~/.agents/vb` — it must be `~/.agents/skills/vb`.
- Do not report full initialization when Linear tools were available but registration was skipped.
- Do not make CI mandatory for all projects — record the project's own gate policy.
- Do not add a `workspace` section or a `worktrees_root` setting to `project.yaml` — the worktree path is always the fixed `.worktrees/`.
- Do not overwrite an existing real `CLAUDE.md` file with a symlink.
- Do not call `_save_project` (or any Linear write) before verifying login in step 6a; if not logged in, trigger the OAuth flow first.
