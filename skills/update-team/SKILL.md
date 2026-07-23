---
name: update-team
description: Analyze the current project and reconcile the agent team plus adaptive model-routing profile across Codex, Claude Code, and Cursor. Use when the user asks to update the agent team, add or remove agents, re-analyze project needs, refresh model/subagent recommendations, or refresh agents after requirements change; also invoked by `vb-init` after baseline agents are copied. Not for copying plugin baseline agents (`built-in-agents`) or managing user-level global agents.
---

# Update Team

分析项目上下文，推理适合的 agent 角色与按任务族划分的模型画像，并通过 [agent-creator](../agent-creator/SKILL.md) 将 Codex（`.codex/agents/`）、Claude Code（`.claude/agents/`）、Cursor（`.cursor/agents/`）三个平台的团队与推理结果对齐。模型路由写入派生的 `.vibeRig/model-routing.yaml`，运行时由 `subagent-routing` 选择，不要求用户手动挑模型。所有操作**幂等**。

## Contract

单一职责：基于项目分析结果管理当前项目跨三个平台的 agent 团队。

不允许：
- 手写平台原生文件（TOML/MD）——新建/更新一律经过 `agent-creator`，避免三个平台的团队漂移不一致。
- 复制插件基线 agents（由 `built-in-agents` 负责）
- 更新、删除或重新定义 `built-in-agents/agents.manifest.json` 中的基线 agents
- 操作用户级全局 agents（`~/.codex/agents/`、`~/.claude/agents/`、`~/.cursor/agents/`）
- 修改 `project.yaml` 的 `subagents` 以外的任何字段
- 无推理依据地创建 agent
- 把一次任务或一个全局模型分数当成稳定路由结论
- 把 Codex 模型 slug 写入 Claude Code/Cursor 路由，或反向混用 provider 证据
- 为追求低成本绕过风险、证据保真、人工验收或交付权限 Gate
- 在平台支持运行时 model override 时，把实验性模型永久硬编码进 Agent 文件
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
- **`--refresh-model-routing`** — 只刷新模型目录、accepted routing observations 与 `.vibeRig/model-routing.yaml`，不改 Agent 团队

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

**来源四：模型目录与 accepted routing observations**

- 读取当前平台真实可用的模型目录与支持的 reasoning 档位；目录可见但实际认证拒绝的模型标为 unavailable；
- 读取 `.vibeRig/model-routing.yaml`（若存在）、近期 retrospective 中的 `routing_observations`，以及 [bundled model prior](../subagent-routing/assets/model-capability-prior.json)；
- 只比较同 provider、平台、task family、风险、Completion Oracle、证据保真度和主要 Skill/policy 版本的样本；
- 价格不可见时保留 token、缓存和耗时，不推测美元或 credits；
- 读取 [adaptive model routing](../subagent-routing/references/model-routing.md) 的 promotion、demotion 与 exploration 规则。

### 2. 推理所需 agent 角色

基于以上三个来源综合判断，写出推理结论：

- 每个推荐角色需说明**依据**（来自哪个来源、对应什么任务）
- 示例推理：
  - requirements 有 DB 迁移文档 + Linear 有数据库相关 issue → 推荐 `db_specialist`
  - Linear 有安全类 issue → 推荐 `security_auditor`
  - 项目有 `frontend/` 目录 + requirements 提及 UI → 推荐 `ui_engineer`
  - 大量 Bug 类 issue → 推荐 `debugger` + `qa`
  - 跨模块集成任务 → 推荐 `integrator`

### 3. 推理角色 × 模型画像

先确定 capability，再为每个平台建立任务族路由：

- `overall/orchestration`
- `bounded-intake`
- `deterministic-execute`
- `acceptance-and-delivery`
- `complex-escalation`

每条路由写明：默认 model/reasoning、challenger 或 fallback、confidence、accepted sample count、quality floor、探索资格和升级信号。保持锯齿状画像，不生成“最强模型”总榜。

Codex 缺少项目实测时可使用 bundled prior；Claude Code/Cursor 没有 provider-specific accepted evidence 时保持 `inherit`，不得借用 Codex 排名。少于 5 个可比样本为 `experimental`；只有满足 model-routing promotion 规则才更新默认。

### 4. Diff 当前团队

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

### 5. 执行变更

**创建/更新**：对每个待创建/待更新的 agent，调用 `agent-creator`，传入：
- agent 名称与职责
- 读写权限（对应 `sandbox_mode`/`tools`/`readonly`）
- 项目技术栈与推理依据（用于调优 mission/scope 内容）
- `targets`：该 agent 在本轮缺失或需要更新的平台列表（不要求 agent-creator 重新渲染已跳过的平台）

Agent spec 默认保留 `model: inherit`，让 `subagent-routing` 按当前任务动态 override。只有目标平台不支持运行时 override、路由已达到 `trusted` 且用户要求固定默认时，才通过 `agent-creator` 写入 provider-specific model；不得把 challenger 写死。

若该 agent 需要 MCP 服务器且目标平台包含 Cursor：先渲染 agent 文件本身（不含 MCP 字段），MCP 服务器是否合并进共享的 `.cursor/mcp.json` 单独询问用户，不在本步骤自动执行。

**建议删除**：列出建议删除的 agent 及理由，等待用户确认后执行。

**`--remove <name>`**：确认后删除该 agent 在所有已渲染平台下的文件（`.codex/agents/<name>.toml`、`.claude/agents/<name>.md`、`.cursor/agents/<name>.md`），并从 `project.yaml` 移除对应 key。

### 6. 更新 `project.yaml` subagents 段

`subagents` 只允许四个固定偏好键：`default_research`、`default_qa`、`default_security_audit`、`default_review`。只有当本轮创建/删除影响这四种默认能力时才修改对应值；实现、集成、测试编写、架构或领域 Agent 均由 `subagent-routing` 现场发现，不为它们增加配置键。

### 7. 更新模型路由派生文件

按 [model-routing-profile.schema.json](./assets/model-routing-profile.schema.json) 生成或刷新 `.vibeRig/model-routing.yaml`：

- `catalogFingerprint` 绑定当前平台目录；
- `policyFingerprint` 绑定模型 prior、路由协议和相关 Skill 版本；
- `sources` 记录使用的 accepted event IDs 和 prior version；
- route 只含聚合统计和决策，不复制敏感 prompt、代码或用户数据；
- source、catalog 或 policy 未变化时保持字节稳定；
- 出现 invalidation signal 时降低 confidence 或回退到 `inherit`/bundled prior，不静默沿用过期排名。

该文件是可重建缓存，不是人工验收、模型可用性或成本事实的权威来源。原始 accepted retrospective observations 才是证据。

### 8. 输出报告

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

模型路由：
  overall             → codex: gpt-5.6-terra/low（provisional，来源：prior + accepted ×4）
  bounded-intake      → codex: gpt-5.6-luna/low（experimental，10% eligible exploration）
  deterministic-exec → codex: gpt-5.4-mini/low（experimental；跨模块失败时升级）
  accept-deliver      → codex: gpt-5.6-terra/low（exploit only）
  claude/cursor       → inherit（无 provider-specific accepted evidence）
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

# 模型路由派生文件符合 schema 所需字段
grep -E "catalogFingerprint|policyFingerprint|taskFamily|qualityFloor" .vibeRig/model-routing.yaml
```

- [ ] 每个新建 agent 在其目标平台都有对应文件，且有推理依据
- [ ] 无 agent 被静默删除
- [ ] `project.yaml` `subagents` 与最终团队一致
- [ ] 报告包含每个 (agent, 平台) 组合的动作与依据
- [ ] 涉及 MCP 的 agent 在 Cursor 上未写入不支持字段，`.cursor/mcp.json` 合并仅在用户确认后进行
- [ ] Linear 不可用时报告中已注明
- [ ] 模型画像按 provider/platform/task family 分开，没有全局排行榜。
- [ ] `.vibeRig/model-routing.yaml` 绑定 catalog、policy 与 accepted sources，可由原始 Evidence 重建。
- [ ] challenger 只用于符合安全条件的低风险探索；accept/security/不可逆操作没有在线探索。
- [ ] 不可见价格没有被估算或伪造成成本事实。
