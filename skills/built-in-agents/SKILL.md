---
name: built-in-agents
description: Install vb-plugin baseline agents into the current project across Codex (.codex/agents/), Claude Code (.claude/agents/), and Cursor (.cursor/agents/) by rendering each baseline JSON spec through agent-creator. Use when initializing a VibeRig project or when baseline agents are missing. Called by vb-init; can also be run standalone to restore missing baseline agents. Do not use to update or regenerate project-specific agents.
---

# Built-in Agents

将 vb-plugin 自带的基线 agent（`assets/*.json` spec）通过 [agent-creator](../agent-creator/SKILL.md) 渲染到 Codex（`.codex/agents/*.toml`）、Claude Code（`.claude/agents/*.md`）、Cursor（`.cursor/agents/*.md`）三个平台。所有操作**幂等**——目标文件已存在则跳过，不覆盖。

## Contract

单一职责：把 `assets/` 中的基线 agent JSON spec 交给 `agent-creator` 渲染到三个平台的 agent 目录。

不允许：
- 手写平台原生文件（TOML/MD）——必须经过 JSON spec + `agent-creator`，否则下次更新会导致三个平台漂移不一致。
- 覆盖已存在的 agent 文件（除非传 `--force`）
- 修改 `project.yaml` 的任何字段（由调用方负责）
- 创建 `assets/` 中不存在的 agent
- 未经用户确认，向共享的 `.cursor/mcp.json` 写入或合并内容

## 基线 Agents

| Spec 文件 | Agent | 职责 |
|---|---|---|
| `code_review.json` | code_review | 代码质量审查 |
| `gemini_research.json` | gemini_research | Gemini 辅助研究 |
| `integrator.json` | integrator | 跨模块集成 |
| `qa.json` | qa | QA 验证 |
| `researcher.json` | researcher | 研究与只读分析 |
| `security_auditor.json` | security_auditor | 安全漏洞扫描 |
| `self_learner.json` | self_learner | 事后学习（配合 vb-learn）|
| `test_engineer.json` | test_engineer | 测试编写 |
| `uiux_design.json` | uiux_design | UI/UX 设计审查 |

每个 spec 已经是完整的 agent-creator intermediate spec（含 `mission` / `scope_allowed` / `scope_not_allowed` / `extra_sections` / `skill_dependencies` / `mcp_servers` 等），`targets` 固定为 `["codex", "claude", "cursor"]`。

## Workflow

### 1. 确定安装目标平台

默认三个平台都渲染。可传 `--only <platform,...>`（如 `--only claude,cursor`）只渲染指定平台，其余平台跳过且不报缺失。

### 2. 逐个基线 agent、逐个平台渲染

对 `assets/` 中的每个 JSON spec，对每个目标平台检查对应文件是否已存在：

- `.codex/agents/<name>.toml`
- `.claude/agents/<name>.md`
- `.cursor/agents/<name>.md`

规则：

- 已存在且未传 `--force` → 跳过该 (agent, 平台) 组合，记录到报告。
- 不存在 → 调用 `agent-creator`：这个 JSON 文件本身就是已经确定好的 intermediate spec，直接用它渲染缺失的平台，跳过 agent-creator 工作流里的"澄清职责 / 技能依赖确认"步骤——基线 agent 的边界和技能依赖已经预先审定过，不需要每次安装都重新询问用户。
- spec 的 `mcp_servers` 非空且目标平台是 Cursor：Cursor 不支持按 agent 分配 MCP（见 agent-creator 的 Capability Matrix），渲染的 `.cursor/agents/<name>.md` 不写任何 MCP 字段。是否把该 agent 需要的 MCP 服务器合并进项目共享的 `.cursor/mcp.json` 是一个独立决定，必须先询问用户；本 skill 只渲染 agent 文件本身，MCP 合并留到用户确认后再做，并在报告中注明"待确认"。

### 3. 输出报告

```
基线 agents 安装结果（按平台）：
  code_review       → codex: 已写入 | claude: 已写入 | cursor: 已写入
  gemini_research   → codex: 跳过（已存在） | claude: 已写入 | cursor: 已写入（MCP 未合并，需用户确认）
  ...

汇总：X 个文件写入，Y 个跳过，Z 个待确认 MCP 合并
```

## Validation

```bash
ls .codex/agents/*.toml .claude/agents/*.md .cursor/agents/*.md 2>/dev/null
```

- [ ] 每个安装目标平台下，9 个基线 agent 都存在（或被 `--only` 明确排除）
- [ ] 报告列出每个 (agent, 平台) 组合的动作（写入/跳过）
- [ ] 无文件被静默覆盖
- [ ] 涉及 MCP 的基线 agent（`gemini_research`、`uiux_design`）在 Cursor 上没有写入不支持的 MCP 字段，且 `.cursor/mcp.json` 合并只在用户确认后进行
