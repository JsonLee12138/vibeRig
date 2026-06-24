---
name: update-team
description: Analyze the current project and reconcile the Codex agent team. Use when the user asks to update the agent team, add or remove agents, re-analyze project needs, or refresh agents after requirements change. Also invoked by vb-init after baseline agents are copied. Do not use to copy plugin baseline agents or manage ~/.codex/agents global agents.
---

# Update Team

分析项目上下文，推理出适合的 agent 角色，并将 `.codex/agents/` 与推理结果对齐。所有操作**幂等**——已存在且推理仍需要的 agent 直接跳过。

## Contract

单一职责：基于项目分析结果管理当前项目的 `.codex/agents/` 团队。

不允许：
- 复制插件基线 agents（由 `vb-init` 负责）
- 操作 `~/.codex/agents/` 全局 agents
- 修改 `project.yaml` 的 `subagents` 以外的任何字段
- 无推理依据地创建 agent
- 无用户确认地删除 agent

无法定位项目根目录或 `.vibeRig/project.yaml` 时停止并询问。

## 输入

- **项目根目录** — 当前工作区或 git root，除非用户指定
- **`--force <name>`** — 强制重新生成指定 agent，即使已存在
- **`--only <name,...>`** — 只分析并处理指定 agent，不做全量
- **`--remove <name>`** — 需要用户二次确认后删除指定 agent

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

```bash
ls .codex/agents/*.toml 2>/dev/null
```

建立三个列表：
- **待创建** — 推理需要但 `.codex/agents/` 中不存在
- **跳过** — 已存在且推理仍需要（`--force` 则移入待更新）
- **建议删除** — 已存在但推理判断不再需要

### 4. 执行变更

**创建/更新**：对每个待创建 agent，调用 `agent-creator`，传入：
- agent 名称与职责
- `sandbox_mode`
- 项目技术栈与推理依据（用于调优 `developer_instructions`）

**建议删除**：列出建议删除的 agent 及理由，等待用户确认后执行。

**`--remove <name>`**：确认后删除 TOML，并从 `project.yaml` 移除对应 key。

### 5. 更新 `project.yaml` subagents 段

仅修改 `subagents` 字段，新增已创建 agent 的 key，移除已删除 agent 的 key。

### 6. 输出报告

```
分析依据：
  - requirements/: 发现前端模块、API 层、DB 迁移需求
  - Linear: 8 个待执行 issue（3 个 UI、2 个 API、1 个安全）
  - 项目结构: Go 后端 + React 前端

Agent 团队变更：
  ui_engineer      → 新建（依据：Linear UI issue ×3 + requirements/ui.md）
  security_auditor → 跳过（已存在）
  db_specialist    → 新建（依据：requirements/db-migration.md）
  old_agent_xyz    → 建议删除（无对应任务，请确认 y/n）

汇总：2 个新建，1 个跳过，1 个待确认删除
```

## Validation

```bash
# 新建的 agent TOML 存在
ls .codex/agents/

# 无不支持的自定义字段
grep -En "^\[skills\]|^recommended_skills|^scope\s*=|^inputs\s*=|^boundaries" \
  .codex/agents/*.toml && echo "INVALID FIELDS" || echo "ok"

# project.yaml subagents 已更新
grep "subagents" .vibeRig/project.yaml
```

- [ ] 每个新建 agent 有 TOML 且有推理依据
- [ ] 无 agent 被静默删除
- [ ] `project.yaml` `subagents` 与最终团队一致
- [ ] 报告包含每个 agent 的动作与依据
- [ ] Linear 不可用时报告中已注明
