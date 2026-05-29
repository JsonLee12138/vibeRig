# VibeRig Context-Mode Insights and Accepted-Learning Plan

## 目标

VibeRig 的自学习不从所有对话里触发，而是只从 已验收通过的工作中提炼经验。

这套方案的核心目标是：

- 让 `brainstorm` 和 `write-plan` 继续专注需求规划和执行拆分。
- 让 VibeRig local task engine 在规划或实现验收通过后自动触发 retrospective。
- 使用 context-mode 作为可选的上下文和事件证据来源。
- 只自动沉淀低风险项目事实，不强自动修改 skills 或用户长期记忆。
- 不在 VibeRig 仓库中维护 context-mode 源码、submodule 或构建生命周期。

## 当前项目状态

当前项目已经具备 VibeRig 插件雏形：

```text
.
├── .codex-plugin/plugin.json
├── skills/
│   ├── brainstorm/
│   ├── init-viberig/
│   └── write-plan/
├── scripts/
│   ├── init_project.py
│   ├── validate_tasks.py
│   ├── render_linear_children.py
│   ├── viberig_setup.sh
│   ├── viberig_run_planning.sh
│   └── viberig_run_implementation.sh
├── schemas/
│   └── tasks.schema.json
└── VIBERIG_PLUGIN_PLAN.md
```

当前设计不再维护内置外部自动化 runtime。context-mode 不采用 submodule，也不通过 npm 全局安装作为 VibeRig 的默认初始化路径。

## Context-Mode 集成原则

context-mode 应作为独立 Codex plugin 安装，而不是 VibeRig 维护的依赖。

初始化时使用：

```sh
codex plugin marketplace add mksglu/context-mode
```

如果 Codex 后续要求单独安装或启用该插件，`init-viberig` 只应报告 Codex 返回的下一步，不应退回到 `npm install -g context-mode` 作为默认路径。

VibeRig 不做：

- 不 clone `mksglu/context-mode`。
- 不把 context-mode 加为 submodule。
- 不 pin context-mode commit。
- 不构建 context-mode。
- 不复制 context-mode hook 脚本。
- 不把 context-mode 源码或配置写进 `vendor/`。

VibeRig 只做：

- 检查 context-mode 是否已经可用。
- 通过 Codex plugin marketplace 引导安装。
- 检查 context-mode MCP 工具是否可调用。
- 在 insights 阶段优先消费 `ctx_stats`、`ctx_search`、`ctx_insight` 等能力。
- 不可用时降级到 `.vibeRig` 文档、git、tasks.yaml、validation output。

## 推荐目标结构

在当前项目基础上新增：

```text
skills/
├── insights/
│   ├── SKILL.md
│   └── references/
│       ├── post-acceptance-retrospective.md
│       ├── learning-policy.md
│       └── report-template.md
scripts/
├── check_context_mode.py
├── generate_insights_report.py
└── apply_learning_candidates.py
schemas/
└── insights.schema.json
```

目标业务项目初始化后生成：

```text
<project-root>/
├── .vibeRig/
│   ├── config.yaml
│   ├── context-mode.md
│   ├── insights/
│   │   ├── candidates.md
│   │   └── confirmed.md
│   └── requirements/
│       └── <REQ>/
│           ├── requirement.md
│           ├── research.md
│           ├── acceptance.md
│           ├── roadmap.md
│           ├── spec.md
│           ├── plan.md
│           ├── tasks.yaml
│           ├── insights.md
│           └── tasks/
│               └── <TASK-ID>/
│                   └── retrospective.md
└── worktrees/
```

## `init-viberig` 需要补充的职责

现有 `skills/init-viberig/SKILL.md` 已负责初始化 `.vibeRig`、worktrees和 subagents。需要补充 context-mode 检查。

新增初始化步骤：

1. 检查 Codex plugin 命令是否可用。
2. 检查 context-mode 是否已经安装或可被 Codex 发现。
3. 如果不可用，运行或提示：

   ```sh
   codex plugin marketplace add mksglu/context-mode
   ```

4. 重新检查 context-mode MCP 工具是否出现。
5. 如果工具仍不可用，生成 `.vibeRig/context-mode.md`，记录当前状态和人工下一步。
6. 不阻塞 VibeRig 主初始化。context-mode 是增强能力，不是 brainstorm/write-plan 的硬依赖。

`.vibeRig/config.yaml` 建议新增：

```yaml
context_mode:
  required: false
  install_method: codex-plugin-marketplace
  marketplace: mksglu/context-mode
  status_file: ./.vibeRig/context-mode.md
insights:
  enabled: true
  trigger: post_acceptance
  auto_apply_project_notes: true
  auto_apply_workflow_rules: false
  auto_apply_skill_updates: false
  auto_apply_user_preferences: false
```

## `insights` Skill 设计

新增 `skills/insights/SKILL.md`。

触发场景：

- planning flow 完成并通过 review。
- implementation flow 验收通过。
- 用户要求查看某个 requirement 或 task 的复盘。
- 用户要求审查 learning candidates。
- 用户要求应用已确认的 learning candidates。

默认行为：

- 生成 retrospective 和 learning candidates。
- 只自动写入低风险 `project_note`。
- 不自动修改 `skills/*/SKILL.md`。
- 不自动写用户长期偏好。
- 不从失败或未验收工作中学习。

## VibeRig local task engine 自动触发点

不要求用户手动运行 insights。local task workflow 在 gate 通过后触发 finalizer。

Planning flow：

```text
parent issue: Planning
  -> brainstorm
  -> write-plan
  -> validate tasks.yaml
  -> planning review passed
  -> child issues created
  -> parent moved to Planned or Human Review
  -> run VibeRig planning retrospective
```

Implementation flow：

```text
child issue: Todo/In Progress/Rework
  -> create worktree
  -> implement current task only
  -> validation passed
  -> acceptance reviewer passed
  -> code reviewer passed
  -> PR created or handoff accepted
  -> issue moved to accepted/done
  -> run VibeRig post-acceptance retrospective
```

`git push` 可以作为 evidence，但不能作为 learning gate。真正的 gate 应是 validation、acceptance review、code review、PR merge、Linear Done 或人工验收通过。

## Evidence Bundle

VibeRig finalizer 应把以下证据交给 `insights`：

```yaml
requirement_id: VB-123
task_id: T1
status: accepted
gate:
  validation_passed: true
  acceptance_passed: true
  code_review_passed: true
  pr_created: true
  pr_merged: false
sources:
  task_contract: .vibeRig/requirements/VB-123/tasks.yaml
  requirement: .vibeRig/requirements/VB-123/requirement.md
  acceptance: .vibeRig/requirements/VB-123/acceptance.md
  spec: .vibeRig/requirements/VB-123/spec.md
  plan: .vibeRig/requirements/VB-123/plan.md
git:
  branch: viberig/VB-123-T1
  base_sha: <sha>
  head_sha: <sha>
  changed_files:
    - server/api/foo.go
validation:
  commands:
    - go test ./...
  result: passed
review:
  acceptance_notes: <path-or-inline-summary>
  code_review_notes: <path-or-inline-summary>
context_mode:
  available: true
  queries:
    - "VB-123 T1 validation failures fixed"
    - "VB-123 T1 tool errors retries decisions"
```

如果 context-mode 不可用，`context_mode.available` 为 false，finalizer 继续运行。

## Learning Candidate 分类

所有学习候选必须分类。

```yaml
learning_candidates:
  - id: LC-1
    type: project_note
    confidence: high
    auto_apply: true
    target: .vibeRig/insights/confirmed.md
    evidence:
      - validation passed
      - accepted task T1
    text: "This project uses go test ./... as the default backend validation command."

  - id: LC-2
    type: workflow_rule
    confidence: medium
    auto_apply: false
    target: .vibeRig/workflow-rules.md
    text: "Frontend tasks should include a screenshot or browser verification step."

  - id: LC-3
    type: skill_update
    confidence: medium
    auto_apply: false
    target: skills/write-plan/SKILL.md
    text: "When splitting tasks that modify shared schemas, create a foundation task first."

  - id: LC-4
    type: user_preference
    confidence: high
    auto_apply: false
    target: user memory/profile
    text: "The user prefers concise implementation reports after validation."
```

默认策略：

- `project_note`: 高置信且低风险时可自动写入。
- `workflow_rule`: 默认进入 candidates，用户确认后应用。
- `skill_update`: 默认生成 patch proposal，不自动应用。
- `user_preference`: 必须用户确认。

## 禁止学习内容

`insights` 不应学习：

- 未通过验收的尝试。
- 未合并且未被 handoff 接受的代码。
- 临时环境问题。
- 缺失依赖、未安装工具、凭证未配置。
- “某工具坏了”这类永久负面规则。
- 一次性任务细节。
- 推测性的偏好。
- 被后续实现推翻的早期方案。
- 只因为发生过、但没有被验收结果证明有效的做法。

## Report 模板

Task retrospective：

```md
# Task Retrospective: <REQ> <TASK-ID>

## Accepted Outcome

- Status:
- Branch:
- PR:
- Validation:
- Acceptance refs:

## What Changed

- Files:
- Behavior:
- Tests:

## Evidence

- Task contract:
- Acceptance notes:
- Code review notes:
- Context-mode evidence:

## Friction

- Failures:
- Rework:
- Scope issues:
- Missing inputs:

## Learning Candidates

| ID | Type | Confidence | Auto Apply | Target |
| --- | --- | --- | --- | --- |

## Applied Learnings

- Nothing applied.
```

Requirement insights：

```md
# Requirement Insights: <REQ>

## Summary

## Task Outcomes

## Recurring Friction

## Planning Quality

## Validation Quality

## Learning Candidates

## Confirmed Learnings
```

## Scripts

### `scripts/check_context_mode.py`

职责：

- 检查 `codex` CLI 是否存在。
- 检查 Codex plugin marketplace 是否可用。
- 检查 context-mode 是否已安装或可用。
- 可选执行 `codex plugin marketplace add mksglu/context-mode`。
- 输出 `.vibeRig/context-mode.md` 状态。

该脚本不应调用 `npm install -g context-mode`。

### `scripts/generate_insights_report.py`

职责：

- 读取 evidence bundle。
- 读取 `.vibeRig/requirements/<REQ>`。
- 读取 git diff 和 validation/review 输出。
- 可选查询 context-mode MCP 结果，由 agent 传入或保存为 JSON。
- 生成 task retrospective、requirement insights、learning candidates。

### `scripts/apply_learning_candidates.py`

职责：

- 只应用 policy 允许自动应用的候选。
- 默认只处理高置信 `project_note`。
- 对 `workflow_rule`、`skill_update`、`user_preference` 输出待确认列表。
- 记录审计信息。

## 需要修改的现有文件

### `.codex-plugin/plugin.json`

新增 default prompt：

```json
"Generate accepted-work insights"
```

可以把 longDescription 扩展为包含 “post-acceptance retrospectives and learning candidates”。

### `skills/init-viberig/SKILL.md`

新增 context-mode 初始化检查，明确安装方式为：

```sh
codex plugin marketplace add mksglu/context-mode
```

明确禁止默认使用 npm 全局安装。

### `scripts/init_project.py`

新增：

- `.vibeRig/insights/`
- `.vibeRig/insights/candidates.md`
- `.vibeRig/insights/confirmed.md`
- `.vibeRig/context-mode.md`
- `.vibeRig/config.yaml` 中的 `context_mode` 和 `insights` 配置段。

### `skills/write-plan/SKILL.md`

在本地任务计划中明确验收通过后触发 retrospective finalizer。

### `schemas/tasks.schema.json`

可选增加 finalizer 配置：

```yaml
finalizers:
  insights:
    enabled: true
    trigger: post_acceptance
    evidence_bundle: required
```

也可以单独放在 `schemas/insights.schema.json`，避免让 task contract 变复杂。

## 实施顺序

### Step 1: 补 init context-mode 设计

- 更新 `skills/init-viberig/SKILL.md`。
- 新增 `scripts/check_context_mode.py`。
- 更新 `scripts/init_project.py` 输出 context-mode 状态文件和 insights 目录。

### Step 2: 新增 insights skill

- 新增 `skills/insights/SKILL.md`。
- 新增 report template、learning policy、post-acceptance retrospective reference。
- 更新 plugin default prompts。

### Step 3: 新增 report generator

- 新增 `scripts/generate_insights_report.py`。
- 新增 `schemas/insights.schema.json`。
- 支持无 context-mode 降级。

### Step 4: 接入 VibeRig finalizer

- 更新 planning flow template。
- 更新 implementation flow template。
- 定义 evidence bundle 输入。
- 确保 finalizer 只在验收 gate 通过后运行。

### Step 5: 加 learning gate

- 新增 `scripts/apply_learning_candidates.py`。
- 默认只自动应用高置信 `project_note`。
- 其他候选进入 `.vibeRig/insights/candidates.md`。

### Step 6: 验证插件

- 运行 plugin validator。
- 初始化一个测试业务项目。
- 验证无 context-mode 时 local task flow 可降级。
- 安装 context-mode 后验证 insights 可使用 context-mode evidence。

## 验收标准

- `init-viberig` 不再建议 `npm install -g context-mode` 作为默认安装路径。
- context-mode 初始化使用 `codex plugin marketplace add mksglu/context-mode`。
- context-mode 不出现在 `vendor/`、`.gitmodules` 或插件源码 vendoring 中。
- 未安装 context-mode 时，VibeRig 仍可完成 brainstorm、write-plan、local task flow 生成。
- 验收通过后可自动生成 retrospective。
- learning candidates 只从 accepted work 产生。
- 只有高置信低风险 `project_note` 可自动应用。
- skill update 和 user preference 必须等待用户确认。

## 最终原则

VibeRig 学习的是验收证明有效的工作方式，不是所有对话内容。

context-mode 提供更丰富的证据，但不是核心规划能力的硬依赖。

VibeRig 负责在正确生命周期点触发 insights，VibeRig 负责把结果变成可审计、可确认、可回滚的学习候选。
