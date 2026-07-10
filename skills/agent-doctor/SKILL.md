---
name: agent-doctor
description: Diagnose the availability and correctness of custom subagent files across Codex (`.codex/agents/*.toml`), Claude Code (`.claude/agents/*.md`), and Cursor (`.cursor/agents/*.md`). Use when the user asks to check, diagnose, validate, or health-check agents; when a spawned subagent behaves as if it has no instructions; or after creating/editing agent files.
---

# Agent Doctor

诊断自定义 subagent 文件的**可用性**——能否被各自平台正确加载并按预期运行，覆盖 Codex（TOML）、Claude Code（MD frontmatter）、Cursor（MD frontmatter）三个平台。配套的 agent **创建/编写**用 [agent-creator](../agent-creator/SKILL.md)，本 skill 只读检查、不改写 agent（修复需用户确认）。

## Contract

单一职责：扫描一个或多个平台下的 agent 文件，逐个给出 `PASS` / `WARN` / `FAIL` 与原因。

不允许：
- 在未经用户确认的情况下改写 agent 文件。
- 安装、发布 agent 或修改全局配置。
- 真正启动 MCP server 进程或调用其工具（只检查命令/字段是否存在）。

## 为什么需要

三个平台的 agent 文件格式不同，失效模式也不同：

- **Codex（TOML）**：TOML 有一条致命规则——**任何 `[table]` 表头（如 `[mcp_servers.x]`、`[[skills.config]]`）会吞掉它之后所有的裸键**。如果把 `mcp_servers` 写在 `developer_instructions` 之前，`developer_instructions` 会被解析成 `mcp_servers.x.developer_instructions`，于是这个 agent **没有任何指令**——文件能正常解析、不会报错，但 agent 实际是哑的。这类静默失效只有结构化解析能稳定抓出来，所以用脚本检查。
- **Claude Code / Cursor（MD + frontmatter）**：没有 TOML 式的表头吞键问题，但有各自的字段合法性和角色边界问题（见 [agent-creator](../agent-creator/SKILL.md) 的 Capability Matrix / Red Flags），例如 Cursor 文件不该有 `mcp_servers`/`mcpServers` 字段、`Scope` 缺 `Not allowed:` 列表等。这类是语义检查，不是格式解析问题，用并发 subagent 逐个平台过一遍规则比再写一套解析器更合适。

## 检查项

### Codex（脚本检查，`check_agents.py`）

| # | 检查 | 级别 |
|---|---|---|
| 1 | TOML 能否解析 | FAIL |
| 2 | 必填顶层键齐全：`name` / `description` / `developer_instructions` | FAIL |
| 3 | **字段顺序**：所有 `[mcp_servers]` / `[[skills.config]]` 表块在全部顶层标量键**之后** | FAIL |
| 4 | 无未知/不支持的顶层键 | WARN |
| 5 | `sandbox_mode` 取值合法（`read-only` / `workspace-write` / `danger-full-access`） | WARN |
| 6 | `name` 与文件名一致 | WARN |
| 7 | `mcp_servers.*.command` 指向的可执行文件存在于 PATH/磁盘 | WARN |

### Claude Code / Cursor（subagent 语义检查）

| # | 检查 | 级别 |
|---|---|---|
| 1 | frontmatter 能否解析、必填键齐全（`name` / `description`，Cursor 另需 `readonly`） | FAIL |
| 2 | `Scope` 有 `Not allowed:` 列表 | WARN |
| 3 | Mission 是否超过两句话（应拆分为两个 agent） | WARN |
| 4 | Cursor 文件是否出现不支持的 `mcp_servers`/`mcpServers` 字段 | FAIL |
| 5 | `model`/`tools`/`readonly` 等字段取值是否合法 | WARN |
| 6 | `name` 与文件名是否一致 | WARN |

`FAIL` = agent 无法可靠加载或运行，或违反平台强约束；`WARN` = 可加载但有隐患；`PASS` = 无发现。

## Workflow

### 1. 确定检查目标

默认三个平台都扫描：`.codex/agents/`、`.claude/agents/`、`.cursor/agents/`（以及对应的 `~/.codex/agents/` 等用户级目录）。也可传入具体文件、目录，或用 `--platforms <name,...>` 只检查指定平台。

### 2. 并发执行检查——Codex 用脚本，Claude/Cursor 用并发 subagent

**Codex**：运行结构化脚本检查器。

```bash
python3 skills/agent-doctor/assets/check_agents.py            # 默认目录
python3 skills/agent-doctor/assets/check_agents.py .codex/agents/
python3 skills/agent-doctor/assets/check_agents.py path/to/one.toml
python3 skills/agent-doctor/assets/check_agents.py --json .codex/agents/   # 机器可读
```

需 Python 3.11+（用内置 `tomllib`）。退出码：有任何 `FAIL` 返回 1，否则 0。

**Claude Code 和 Cursor**：与上面的脚本检查在同一轮次并发派发，每个平台一个 subagent，互不依赖（参考 `subagent-routing` 的 Parallel Fan-Out Pattern）：

```markdown
Fan-out phase: agent-doctor platform check

Subagent A — Claude Code checker:
Objective: read every file in .claude/agents/*.md (and ~/.claude/agents/*.md if present). For each, verify frontmatter parses and has required keys (name, description), Scope has a "Not allowed:" list, Mission is ≤2 sentences, model/tools values are valid, and name matches the filename.
Return: per-file PASS/WARN/FAIL with reasons, referencing agent-creator's references/claude-platform.md for field rules.

Subagent B — Cursor checker:
Objective: read every file in .cursor/agents/*.md (and ~/.cursor/agents/*.md if present). For each, verify frontmatter parses and has required keys (name, description, readonly), the file does NOT declare mcp_servers/mcpServers (Cursor has no per-agent MCP scoping — that's a FAIL), Scope has a "Not allowed:" list, and name matches the filename.
Return: per-file PASS/WARN/FAIL with reasons, referencing agent-creator's references/cursor-platform.md for field rules.

Main agent: after both subagents and the Codex script return, merge all three result sets into one report grouped by platform.
```

若某平台目录不存在，跳过该平台的 subagent 派发，在报告中注明"目录不存在"而非报错。

### 3. 报告并按需修复

按平台分组，逐个 agent 汇报 `PASS` / `WARN` / `FAIL` 与原因。对 `FAIL`：
- **Codex 字段顺序 bug** → 建议把所有 `[mcp_servers.*]` / `[[skills.config]]` 块移到文件**末尾**，放在 `developer_instructions` 之后。
- **Cursor 出现 mcp_servers/mcpServers** → 建议移除该字段，改为通过共享的 `.cursor/mcp.json` 配置（需用户确认）。
- **缺必填键** → 补齐；若 Codex 因顺序 bug 被吞，先修顺序。
- 任何修复都通过 [agent-creator](../agent-creator/SKILL.md) 落地（保持三平台 spec 一致），或在用户确认后直接编辑；修复后重跑对应检查确认转为 `PASS`。

## Output Contract

- 检查的文件清单，按平台分组。
- 每个 agent 的状态与具体发现（Codex 含行号；Claude/Cursor 含具体字段/章节名，便于定位）。
- 汇总：按平台的 pass / warn / fail 计数。
- 给出的修复建议，以及是否已落地（若用户批准）。

## Red Flags

- Codex agent 解析正常但缺 `developer_instructions` → 几乎必然是字段顺序 bug，不要当成"忘了写指令"。
- `mcp_servers.*.command` 是 macOS 绝对路径（如 `/Applications/...`）→ 换机/换平台会失效，标 `WARN` 并提示。
- Cursor 文件里出现 `mcp_servers`/`mcpServers` → 该平台不支持按 agent 分配 MCP，必须标 `FAIL`，不能降级成 `WARN`。
- 检查器/subagent 报 `FAIL` 却没有可操作的修复建议 → 报告不合格。
- Claude/Cursor 检查没有并发派发，而是main agent 自己顺序读完两个平台再汇报 → 违反并发要求，应使用 Parallel Fan-Out。

## Validation

```bash
# 自检：built-in-agents 渲染出的基线 agents（渲染后，不是 assets/ 里的 JSON spec）应全部 PASS
python3 skills/agent-doctor/assets/check_agents.py .codex/agents/
```

- [ ] 每个目标 agent、每个平台都有明确的 PASS/WARN/FAIL 结论
- [ ] 每个 FAIL 都给出可操作的修复建议（含行号、表名，或具体字段/章节名）
- [ ] Codex 字段顺序 bug 能被稳定检出（含被三引号字符串内文档误伤的排除）
- [ ] Claude Code 和 Cursor 的检查是并发派发的两个独立 subagent，而不是脚本或顺序读取
- [ ] 未在用户未确认时改写任何 agent 文件
