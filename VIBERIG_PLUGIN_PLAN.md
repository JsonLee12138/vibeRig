# VibeRig Plugin Plan

## 目标

把当前目录整理成一个 Codex 插件，用户可在 Codex 中启用 `VibeRig`，用它完成从需求脑暴到 Symphony 执行编排的前置规划。

插件的职责边界：

- `brainstorm` 负责把模糊需求编译成可审查的需求、调研、验收、路线和技术方案文档。
- `write-plan` 负责把 `brainstorm` 的结果继续编译成 `plan.md`、`tasks.yaml`、Linear child issues、worktree 执行策略和验收入口。
- Symphony 负责执行调度：每个 child issue 一个 workspace/worktree、一个 branch、一次 agent run、一个 PR 或 handoff。
- Linear/GitHub 作为状态、依赖、审查和合并来源。
- Subagents 负责分工执行：需求分析、技术调研、任务拆分、实现、验收、代码审查、集成收敛应尽量交给不同职责的 agent。

不在插件内实现一套新的 TODO 调度器、worktree 生命周期管理器或 Symphony fork。

## 命名

Codex 插件的技术名需要小写 hyphen-case。建议：

- 插件技术名：`vibe-rig`
- 展示名：`VibeRig`
- 当前用户口头名称 `vibeRig` 作为展示名/品牌名保留，不直接作为 manifest `name`。

如果直接用脚本输入 `vibeRig`，需要先确认 scaffold 脚本是否会归一化成 `viberig`。为了可读性和后续 marketplace 路径稳定，建议显式使用 `vibe-rig`。

## 推荐目录结构

当前目录直接作为插件根时，目标结构如下：

```text
.
├── .codex-plugin/
│   └── plugin.json
├── skills/
│   ├── init-viberig/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── project-config-template.md
│   │       └── gitignore-snippet.md
│   ├── brainstorm/
│   │   ├── SKILL.md
│   │   ├── agents/
│   │   └── references/
│   └── write-plan/
│       ├── SKILL.md
│       └── references/
│           ├── plan-template.md
│           ├── tasks-yaml-template.md
│           ├── linear-child-issue-template.md
│           ├── symphony-workflow-planning.md
│           └── symphony-workflow-implementation.md
├── schemas/
│   └── tasks.schema.json
├── scripts/
│   ├── init_project.py
│   ├── find_free_port.py
│   ├── symphony_setup.sh
│   ├── symphony_run_planning.sh
│   ├── symphony_run_implementation.sh
│   ├── validate_tasks.py
│   └── render_linear_children.py
├── vendor/
│   └── symphony/
└── VIBERIG_PLUGIN_PLAN.md
```

迁移策略：

- 推荐把现有 `.agents/skills/brainstorm` 移到 `skills/brainstorm`，让插件结构更标准。
- 如果想先最小改动，也可以在 `plugin.json` 里把 `"skills"` 指向 `"./.agents/skills/"`，但长期不建议混用项目级 `.agents` 和插件级 `skills`。
- `vendor/symphony` 建议作为可选 git submodule，pin 到明确 commit。插件脚本需要在缺失 submodule 时提示初始化，而不是静默失败。

## Init VibeRig Skill

新增 `init-viberig` skill，专门负责把某个业务项目初始化成可被 VibeRig + Symphony 使用的项目。

输入：

- 目标项目目录。
- Linear project/team 配置或用户稍后手填。
- 是否启用 Symphony reference runtime。
- 是否创建默认 subagents。
- 项目技术栈与默认运行/测试命令。

输出到目标项目：

```text
<project-root>/
├── .vibeRig/
│   ├── config.yaml
│   └── requirements/
├── .codex/
│   └── agents/
├── WORKFLOW.planning.md
├── WORKFLOW.implementation.md
├── worktrees/
└── .gitignore
```

`init-viberig` 职责：

- 创建 `.vibeRig/config.yaml`，记录 worktree root、默认 base、端口范围、workflow 路径和 validation 命令。
- 创建 `.vibeRig/requirements/`。
- 确保 `worktrees/` 写入项目 `.gitignore`。
- 渲染 `WORKFLOW.planning.md` 和 `WORKFLOW.implementation.md`。
- 检查是否存在推荐 subagents；缺少时询问用户是否调用 `agent-creator` 创建。
- 检查 Symphony runtime 是否可用；如果使用 submodule runtime，提示或执行 `git submodule update --init --recursive`。
- 不强制启动 daemon；初始化完成后给出明确启动命令。

`.vibeRig/config.yaml` 草案：

```yaml
project:
  name: example-project
  root: .
worktrees:
  root: ./worktrees
  default_base: origin/main
  sync_before_pr: merge
symphony:
  runtime: plugin-submodule
  workflow_planning: ./WORKFLOW.planning.md
  workflow_implementation: ./WORKFLOW.implementation.md
  dashboard_ports:
    planning_start: 49170
    implementation_start: 49180
ports:
  preview_start: 49200
  strategy: find-next-free
linear:
  project_slug: ""
  planning_states:
    - Planning
  implementation_states:
    - Todo
    - In Progress
    - Rework
commands:
  install: ""
  dev: ""
  test: ""
```

端口策略：

- 不使用常见端口如 `3000`、`5173`、`8000`、`8080` 作为 Symphony dashboard 默认端口。
- 默认从高位临时端口段开始，例如 planning `49170`、implementation `49180`、业务预览 `49200`。
- 每次启动前检查端口是否占用。
- 如果端口占用，递增查找下一个空闲端口。
- 实际使用端口写回 `.vibeRig/runtime.json` 或输出到终端，便于用户打开 dashboard/preview。

## plugin.json 草案

```json
{
  "name": "vibe-rig",
  "version": "0.1.0",
  "description": "Requirement planning and Symphony execution prep for VibeRig workflows.",
  "author": {
    "name": "jsonlee"
  },
  "license": "MIT",
  "keywords": [
    "requirements",
    "planning",
    "symphony",
    "linear",
    "worktree"
  ],
  "skills": "./skills/",
  "interface": {
    "displayName": "VibeRig",
    "shortDescription": "Turn requirements into Symphony-ready execution plans.",
    "longDescription": "VibeRig helps Codex turn ambiguous requirements into reviewable requirement docs, acceptance criteria, task graphs, Linear child issues, and worktree execution plans for Symphony.",
    "developerName": "jsonlee",
    "category": "Productivity",
    "capabilities": [
      "Write",
      "Planning"
    ],
    "defaultPrompt": [
      "Brainstorm a VibeRig requirement",
      "Write a VibeRig implementation plan",
      "Split this spec into child tasks"
    ]
  }
}
```

注意：`plugin-creator` 的 validator 要求 manifest 不留占位符，并且 `name`、`version`、`description`、`author.name`、`interface` 必须是真实值。后续真正生成时需要跑 validator。

## Brainstorm 与 Write Plan 分工

现有 `brainstorm` 已输出：

```text
.vibeRig/requirements/<requirement-name>/
├── requirement.md
├── research.md
├── acceptance.md
├── roadmap.md
└── spec.md
```

保持这个边界，不让 `brainstorm` 直接生成执行计划。原因：

- `brainstorm` 关注需求收敛、技术事实、验收标准和实现方案。
- `write-plan` 关注执行拆分、agent 分派、worktree 策略、依赖顺序和 Linear/Symphony 契约。
- 两者分开后，需求文档可以稳定复用，执行计划可以在实现策略变化时单独重写。

新增 `write-plan` skill，输入为 `brainstorm` 的五份结果文档，输出：

```text
.vibeRig/requirements/<requirement-name>/
├── plan.md
└── tasks.yaml
```

`plan.md` 给人审，`tasks.yaml` 给 Symphony/Linear/agent 使用。

`write-plan` 不应该改写 `requirement.md`、`research.md`、`acceptance.md`、`roadmap.md`、`spec.md`。如果发现上游文档缺失或互相矛盾，应停止并报告需要先重跑 `brainstorm` 的具体 phase。

## tasks.yaml 契约

建议把 `tasks.yaml` 设计成稳定的机器契约，而不是普通 Markdown TODO。

```yaml
requirement_id: VB-123
title: Example requirement
source_docs:
  requirement: .vibeRig/requirements/VB-123/requirement.md
  research: .vibeRig/requirements/VB-123/research.md
  acceptance: .vibeRig/requirements/VB-123/acceptance.md
  roadmap: .vibeRig/requirements/VB-123/roadmap.md
  spec: .vibeRig/requirements/VB-123/spec.md
  plan: .vibeRig/requirements/VB-123/plan.md
base_policy:
  default_base: origin/main
  worktree_root: ./worktrees
  require_fetch_before_worktree: true
  require_base_sha_record: true
  require_sync_before_pr: true
agents:
  task_splitter: planning_task_splitter
  implementation_default: implementation_engineer
  acceptance_default: acceptance_reviewer
  code_review_default: code_reviewer
tasks:
  - id: T1
    title: Add backend API support
    type: backend
    suggested_agent: backend_implementer
    acceptance_agent: acceptance_reviewer
    review_agent: code_reviewer
    priority: 1
    depends_on: []
    parallelizable: true
    branch: symphony/VB-123-T1
    worktree_hint: ./worktrees/VB-123-T1
    scope:
      include:
        - server/**
      exclude:
        - web/**
    acceptance_refs:
      - AC-1
      - AC-3
    validation:
      - go test ./...
    review:
      ai_review_required: true
      human_runtime_check: optional
    linear:
      parent: VB-123
      labels:
        - symphony
        - generated
        - backend
```

关键规则：

- 一个 task 应该对应一个 child issue、一个 branch、一个 worktree、一个 PR 或 handoff。
- `depends_on` 决定是否能并行。
- `scope.include/exclude` 限制 agent 修改范围。
- `acceptance_refs` 必须能追溯到 `acceptance.md`。
- `validation` 必须是可执行命令或明确的人工验收项。
- `base_policy` 必须要求从最新 `origin/main` 创建 worktree，并在 PR 前再次同步。
- `suggested_agent`、`acceptance_agent`、`review_agent` 应尽量指向不同职责的 subagent。

## Subagent 策略

VibeRig 应把 subagent 作为默认执行方式，而不是只有实现阶段才使用。

推荐角色：

- `requirements_analyst`：审查需求边界、目标、非目标、业务规则假设。
- `technical_researcher`：负责 GitHub、URL、local code 调研，输出事实、约束、风险。
- `planning_task_splitter`：读取五份 brainstorm 文档，生成 `plan.md` 和 `tasks.yaml`。
- `implementation_engineer`：按单个 child task 修改代码，只做当前 scope。
- `acceptance_reviewer`：根据 `acceptance.md` 和 task acceptance refs 验收实现结果。
- `code_reviewer`：审查 PR 风险、测试覆盖、范围越界和回归风险。
- `integration_coordinator`：处理多 PR 合并后的冲突、集成验证和最终收敛。

原则：

- 每个 subagent 应有单一职责，避免一个 agent 同时拆任务、写代码、验收自己的代码。
- 任务拆分、开发、验收、代码审查默认使用不同 agent。
- `tasks.yaml` 需要显式记录建议实现 agent、验收 agent、review agent。
- 如果缺少匹配 agent，主流程应先询问用户是否创建。
- 如果用户同意创建，应调用 `agent-creator` skill 创建 `.codex/agents/` 或 `~/.codex/agents/` 下的 Codex custom agent。
- 如果用户拒绝创建，流程可以退化为父 agent 执行该角色，但必须在 `plan.md` 或 handoff 中标记风险。

使用 `agent-creator` 时的约束：

- agent 文件使用官方 Codex custom agent TOML 字段。
- 角色边界、输入、输出、停止条件和升级条件写入 `developer_instructions`。
- 分析、调研、审查类 agent 默认 `sandbox_mode = "read-only"`。
- 实现类 agent 才使用 `sandbox_mode = "workspace-write"`。
- 不在 agent TOML 里写自定义字段，例如 `scope`、`outputs`、`recommended_skills`。

## Symphony 集成方式

推荐使用两套 Symphony workflow，而不是让一个 workflow 同时做规划和实现。

## Symphony 安装与插件边界

VibeRig 插件不直接内嵌或 fork `openai/symphony`。推荐边界如下：

- VibeRig 插件提供 `brainstorm`、`write-plan`、`tasks.yaml` schema、Linear child issue 渲染脚本、Symphony `WORKFLOW.md` 模板和 hook 模板。
- Symphony 作为本地长期运行 daemon 单独安装，负责轮询 Linear、创建 per-issue workspace、启动 Codex app-server、维护运行状态。
- 目标业务项目负责保存自己的 `WORKFLOW.planning.md`、`WORKFLOW.implementation.md`、`.vibeRig/`、`.codex/agents/` 和 `worktrees/`。
- 不建议把 Symphony 源码复制到 VibeRig 插件主代码中；这样会把插件升级、daemon 运行、Elixir 运行时、Linear token 和项目策略耦合在一起。

如果追求使用便利，可以把 `openai/symphony` 作为 VibeRig 插件的可选 submodule 放到 `vendor/symphony`。这不是核心依赖，而是 reference runtime 入口：

```sh
git submodule add https://github.com/openai/symphony vendor/symphony
git submodule update --init --recursive
```

要求：

- pin 到明确 commit。
- scripts 检查 submodule 是否存在。
- 缺失时提示用户初始化 submodule。
- 不把 Symphony 源码复制到插件主代码中。

官方推荐两种路线：

- 按 `SPEC.md` 自己实现一个 hardened Symphony。
- 使用 `openai/symphony` 的 Elixir reference implementation 做本地评估。

本阶段建议先使用 Elixir reference implementation，但把它视为外部运行时，不作为插件内容。

本地使用步骤：

```sh
git clone https://github.com/openai/symphony
cd symphony/elixir
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build
```

运行时需要：

- 本地可用的 `codex app-server`。
- Linear personal API token，设置为 `LINEAR_API_KEY`。
- 目标项目中的 Symphony workflow 文件。
- 目标项目已安装或可被 Codex 发现的 VibeRig 插件能力。

启动 planning daemon：

```sh
cd /path/to/vibe-rig/vendor/symphony/elixir
LINEAR_API_KEY=... mise exec -- ./bin/symphony /path/to/project/WORKFLOW.planning.md --port <free-planning-port>
```

启动 implementation daemon：

```sh
cd /path/to/vibe-rig/vendor/symphony/elixir
LINEAR_API_KEY=... mise exec -- ./bin/symphony /path/to/project/WORKFLOW.implementation.md --port <free-implementation-port>
```

两套 daemon 可以指向同一个 Linear project，但 `active_states` 必须不同，避免同时抢同一类 issue。

VibeRig 后续可以提供一个 `scripts/install_symphony_reference.sh` 或 `scripts/check_symphony_runtime.sh`，但它只做检查和提示，不把 Symphony 变成插件强依赖。

## Symphony 运行粒度

推荐默认按项目运行 Symphony，而不是全局只跑一个。

原因：

- 每个项目的 `WORKFLOW.md`、worktree root、subagents、测试命令、环境变量、Linear state mapping 都不同。
- 按项目运行时，dashboard、日志、workspace、branch 命名和运行失败更容易定位。
- 不同项目的依赖安装和 dev server 端口不会互相污染。
- 可以按项目独立暂停、升级、调试 Symphony。

推荐形态：

```text
Project A
  -> planning daemon on free high port
  -> implementation daemon on free high port
  -> worktrees under Project A/worktrees/

Project B
  -> planning daemon on another free high port
  -> implementation daemon on another free high port
  -> worktrees under Project B/worktrees/
```

只有在多个项目共享完全一致的 Linear project、workflow、runtime 策略和权限边界时，才考虑一个总控 Symphony。这个模式后续复杂度高，不建议作为 VibeRig 默认。

### Planning workflow

用途：

- 监听 parent issue 的 `Planning` 状态。
- 创建 planning workspace/worktree。
- 运行 VibeRig `brainstorm full`。
- 调用 `write-plan` 生成 `plan.md` 和 `tasks.yaml`。
- 确认 `.vibeRig/requirements/<REQ>/...` 下的规划产物完整。
- 创建或更新 Linear child issues。
- 把 parent issue 移到 `Planned` 或 `Human Review`。

建议约束：

- 不写业务代码。
- 不创建 implementation PR，除非是 docs-only planning PR。
- 大需求建议开 planning PR 合并 `.vibeRig` 文档。
- 小需求可以只把 `spec/acceptance/tasks.yaml` 快照写到 Linear issue。

### Implementation workflow

用途：

- 监听 child issue 的 `Todo`、`In Progress`、`Rework` 状态。
- 每个 child issue 创建一个 implementation worktree。
- 读取 child issue 内的 task contract，以及 repo 内或 issue 内的 `spec/acceptance` 快照。
- 调用 task 指定的 implementation subagent，只实现当前 task。
- 调用 acceptance/review subagent 进行验收和审查。
- 跑 validation。
- 写 AI review/handoff。
- 开 PR 或交给人工验收。

建议约束：

- 如果 child issue 没有 task contract，停止并标记 blocked。
- 如果依赖 task 未 merge，不要开始。
- 如果 worktree base SHA 过旧，先同步或重建。
- 如果 task 范围超过 `scope.include/exclude`，停止并要求重新规划。

## Worktree 策略

你使用 worktree 的核心价值是：无需合并就能进入对应目录运行和验收效果。

每个 implementation child issue 都应该记录：

```text
workspace: <project-root>/worktrees/VB-123-T1
branch: symphony/VB-123-T1
base: origin/main@<sha>
run: <project-specific dev command>
validation: <project-specific test command>
```

创建规则：

```sh
git fetch origin main
git worktree add -b symphony/VB-123-T1 ./worktrees/VB-123-T1 origin/main
```

PR 前规则：

```sh
git fetch origin main
git merge origin/main
```

是否使用 rebase 应按项目决定。自动化场景优先 merge，因为冲突更显式，失败后也更容易交给人工处理。

项目内 `worktrees/` 必须加入主 worktree 的 `.gitignore`，否则主项目会把这些 worktree 目录当成未跟踪文件。Symphony workflow 和 `write-plan` 都应该默认使用 `<project-root>/worktrees/`，并在 plan 中记录可进入的运行验收目录。

## Planning 产物同步策略

不要让 child task 只依赖 planning worktree 里的本地文件。

推荐分层：

- 大需求：planning workflow 生成 docs-only PR，merge 后 child worktree 从最新 `origin/main` 读取 `.vibeRig` 文档。
- 小需求：不强制 merge docs，把 `spec/acceptance/tasks.yaml` 的必要快照写入 Linear parent/child issue。
- 高风险需求：同时保留 repo docs 和 Linear snapshot，避免后续 issue 描述和 repo 文档漂移。

## AI 自动审查的定位

AI review 适合作为 gate，但不替代最终验收。

适合自动审查：

- `tasks.yaml` 是否每个 task 可独立验收。
- 是否存在依赖遗漏或错误并行。
- `acceptance.md` 是否覆盖主要需求。
- 实现 PR 是否偏离 `scope.include/exclude`。
- 测试是否覆盖 `acceptance_refs`。

不适合作为唯一裁决：

- 产品体验是否达到预期。
- UI 效果是否符合审美和业务语境。
- 复杂业务规则是否真实符合团队口径。
- 跨 PR 集成后的整体行为。

## 任务拆分原则

一个 task 应满足：

- 能独立实现。
- 能独立验收。
- 能独立回滚。
- 修改范围清楚。
- 依赖关系清楚。
- PR 不应过大。

拆分建议：

- backend API、frontend UI、schema/migration、integration wiring、tests/docs 通常分开。
- 强耦合任务用 `depends_on` 串行，不假装并行。
- 冲突概率高的区域降低并发。
- 大量共享接口变更先做 foundation task，merge 后再让后续 task 从最新 main 开始。

## 实施步骤

建议按三步走。

### Step 1: 插件化当前目录

- 新增 `.codex-plugin/plugin.json`。
- 决定是否把 `.agents/skills/*` 移到 `skills/*`。
- 保留 `brainstorm` 原有能力。
- 跑 plugin validator。

### Step 2: 增强 planning 能力

- 新增 `write-plan` skill。
- 增加 `plan-template.md`。
- 增加 `tasks-yaml-template.md`。
- 增加 `tasks.schema.json`。
- 增加 `validate_tasks.py`。
- 增加 subagent discovery/creation 规则：缺少建议 agent 时，询问用户是否用 `agent-creator` 创建。

### Step 3: 加 Symphony 参考工作流

- 增加 `symphony-workflow-planning.md`。
- 增加 `symphony-workflow-implementation.md`。
- 在 workflow prompt 里写清楚 `<project-root>/worktrees/`、base policy、task contract、subagent 分派、AI review gate 和人工验收入口。
- 可选增加 `render_linear_children.py`，把 `tasks.yaml` 渲染成 child issue markdown。

## 最终推荐流程

```text
Parent issue: Planning
  -> VibeRig brainstorm full
  -> write-plan
  -> requirement/research/acceptance/roadmap/spec/plan/tasks.yaml
  -> task splitter / reviewer subagents inspect the plan
  -> AI review planning artifacts
  -> create child issues
  -> parent moves to Planned or Human Review

Child issue: Todo
  -> Symphony creates worktree from latest origin/main
  -> implementation subagent implements only this task
  -> validation runs
  -> acceptance subagent checks behavior
  -> code review subagent checks risk
  -> human enters worktree for runtime acceptance if needed
  -> PR merge

Dependent child issue
  -> starts only after dependency merged
  -> uses latest origin/main
```

## 需要你确认的决策

1. 插件技术名用 `vibe-rig`，展示名用 `VibeRig`，是否接受？
2. 当前目录是否直接作为插件根，还是 scaffold 到 `~/plugins/vibe-rig`？
3. 是否把 `.agents/skills/brainstorm` 移到标准插件路径 `skills/brainstorm`？
4. 新增的规划 skill 名称是否固定为 `write-plan`？
5. planning docs 是默认提交到 repo，还是默认只写 Linear snapshot，大需求再开 docs PR？
6. worktree 根目录是否固定为 `<project-root>/worktrees/`？
7. 默认 PR 前同步策略用 `git merge origin/main`，还是项目可配置为 rebase？
8. 默认 subagent 集合是否先创建在项目级 `.codex/agents/`，而不是全局 `~/.codex/agents/`？
