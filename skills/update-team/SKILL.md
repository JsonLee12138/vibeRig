---
name: update-team
description: Analyze the current project and reconcile the agent team across Codex, Claude Code, and Cursor. Use when the user asks to update the agent team, add or remove agents, re-analyze project needs, or refresh agents after requirements change; also invoked by `vb-init` after baseline agents are copied. Not for copying plugin baseline agents (`built-in-agents`) or managing user-level global agents.
---

# Update Team

分析项目上下文，推理出适合的 agent 角色，并通过 [agent-creator](../agent-creator/SKILL.md) 将 Codex（`.codex/agents/`）、Claude Code（`.claude/agents/`）、Cursor（`.cursor/agents/`）三个平台的团队与推理结果对齐。所有操作**幂等**——已存在且推理仍需要的 agent 直接跳过。

## Contract

单一职责：基于项目分析结果管理当前项目跨三个平台的 agent 团队。

不允许：
- 手写平台原生文件（TOML/MD）——新建/更新一律经过 `agent-creator`，避免三个平台的团队漂移不一致。
- 复制插件基线 agents（由 `built-in-agents` 负责）
- 更新、删除或重新定义 `built-in-agents/agents.manifest.json` 中的基线 agents
- 操作用户级全局 agents（`~/.codex/agents/`、`~/.claude/agents/`、`~/.cursor/agents/`）
- 修改 `project.yaml` 的 `subagents` 以外的任何字段
- 无推理依据地创建 agent
- 无用户确认地删除 agent
- **在 Linear 中定义 agent**——Linear agent = OAuth 应用 + 常驻 webhook 服务，不是可动态创建的实体。本 skill 只同步本地 agents 文件与项目所需的 capability 集合；issue 与 subagent 的匹配由 `task-runner` 执行时经 `subagent-routing` 现场完成
- 未经用户确认，向共享的 `.cursor/mcp.json` 写入或合并内容

无法定位项目根目录或 `.vibeRig/project.yaml` 时停止并询问。

## 输入

- **项目根目录** — 当前工作区或 git root，除非用户指定
- **`--force <name>`** — 强制重新生成指定 agent，即使已存在
- **`--only <name,...>`** — 只分析并处理指定 agent，不做全量
- **`--platforms <name,...>`** — 只对指定平台（`codex`/`claude`/`cursor`）做 diff 和渲染；默认三个平台都处理
- **`--remove <name>`** — 需要用户二次确认后删除指定 agent（所有已渲染平台的文件一并删除）

## Workflow

### 1. 收集上下文

**来源一：`.vibeRig/requirements/`**

```bash
find .vibeRig/requirements -type f | sort
```

读取所有文档，提取：
- 功能模块（前端、API、DB、CLI、基础设施等）
- 技术关键词（框架、语言、第三方服务）
- 任务类型（新功能、重构、性能优化、安全加固等）

**来源二：Linear 未执行 issues**（如工具可用）

查询当前项目状态为 `Todo` / `Backlog` / `In Progress` 的条目，提取：
- 任务类型与涉及模块
- 标签与优先级

Linear 不可用时跳过，报告中注明。

**来源三：项目结构扫描**（兜底）

识别 `package.json`、`go.mod`、`Cargo.toml`、`pyproject.toml`、`requirements.txt` 等技术栈文件及目录结构。

### 2. 推理所需 agent 角色

基于以上三个来源综合判断，写出推理结论：

- 每个推荐角色需说明**依据**（来自哪个来源、对应什么任务）
- 示例推理：
  - requirements 有 DB 迁移文档 + Linear 有数据库相关 issue → 推荐 `db_specialist`
  - Linear 有安全类 issue → 推荐 `security_auditor`
  - 项目有 `frontend/` 目录 + requirements 提及 UI → 推荐 `ui_engineer`
  - 大量 Bug 类 issue → 推荐 `debugger` + `qa`
  - 跨模块集成任务 → 推荐 `integrator`

### 3. Diff 当前团队

对每个目标平台分别检查：

```bash
ls .codex/agents/*.toml 2>/dev/null
ls .claude/agents/*.md 2>/dev/null
ls .cursor/agents/*.md 2>/dev/null
```

对每个推理出的 agent 名称，按 (agent, 平台) 组合建立三个列表：
- **待创建** — 推理需要但该平台目录中不存在对应文件
- **跳过** — 已存在且推理仍需要（`--force` 则移入待更新）
- **建议删除** — 某平台已存在该 agent 文件，但推理判断整个团队不再需要这个角色

先读取 `built-in-agents/agents.manifest.json`。manifest 中的基线 Agent 不进入“建议删除”，也不由本 skill 更新；即使当前项目暂时不需要某个基线能力，也保留给 VibeRig 的动态路由。

### 4. 执行变更

**创建/更新**：对每个待创建/待更新的 agent，调用 `agent-creator`，传入：
- agent 名称与职责
- 读写权限（对应 `sandbox_mode`/`tools`/`readonly`）
- 项目技术栈与推理依据（用于调优 mission/scope 内容）
- `targets`：该 agent 在本轮缺失或需要更新的平台列表（不要求 agent-creator 重新渲染已跳过的平台）

若该 agent 需要 MCP 服务器且目标平台包含 Cursor：先渲染 agent 文件本身（不含 MCP 字段），MCP 服务器是否合并进共享的 `.cursor/mcp.json` 单独询问用户，不在本步骤自动执行。

**建议删除**：列出建议删除的 agent 及理由，等待用户确认后执行。

**`--remove <name>`**：确认后删除该 agent 在所有已渲染平台下的文件（`.codex/agents/<name>.toml`、`.claude/agents/<name>.md`、`.cursor/agents/<name>.md`），并从 `project.yaml` 移除对应 key。

### 5. 更新 `project.yaml` subagents 段

`subagents` 只允许四个固定偏好键：`default_research`、`default_qa`、`default_security_audit`、`default_review`。只有当本轮创建/删除影响这四种默认能力时才修改对应值；实现、集成、测试编写、架构或领域 Agent 均由 `subagent-routing` 现场发现，不为它们增加配置键。

### 6. 输出报告

```
分析依据：
  - requirements/: 发现前端模块、API 层、DB 迁移需求
  - Linear: 8 个待执行 issue（3 个 UI、2 个 API、1 个安全）
  - 项目结构: Go 后端 + React 前端

Agent 团队变更（按平台）：
  ui_engineer      → codex: 新建 | claude: 新建 | cursor: 新建（依据：Linear UI issue ×3 + requirements/ui.md）
  security_auditor → codex: 跳过（已存在） | claude: 新建 | cursor: 新建
  db_specialist    → codex: 新建 | claude: 新建 | cursor: 新建（依据：requirements/db-migration.md）
  old_agent_xyz    → 建议删除（无对应任务，请确认 y/n）

汇总：7 个文件新建，1 个跳过，1 个待确认删除
```

## Validation

```bash
# 新建的 agent 文件存在（按平台）
ls .codex/agents/ .claude/agents/ .cursor/agents/ 2>/dev/null

# Codex: 无不支持的自定义字段
grep -En "^\[skills\]|^recommended_skills|^scope\s*=|^inputs\s*=|^boundaries" \
  .codex/agents/*.toml && echo "INVALID FIELDS" || echo "ok"

# Cursor: 不应出现按 agent 分配的 MCP 字段
grep -En "^mcp_servers|^mcpServers" .cursor/agents/*.md 2>/dev/null && echo "UNSUPPORTED MCP FIELD" || echo "ok"

# project.yaml subagents 已更新
grep "subagents" .vibeRig/project.yaml
```

- [ ] 每个新建 agent 在其目标平台都有对应文件，且有推理依据
- [ ] 无 agent 被静默删除
- [ ] `project.yaml` `subagents` 与最终团队一致
- [ ] 报告包含每个 (agent, 平台) 组合的动作与依据
- [ ] 涉及 MCP 的 agent 在 Cursor 上未写入不支持字段，`.cursor/mcp.json` 合并仅在用户确认后进行
- [ ] Linear 不可用时报告中已注明
