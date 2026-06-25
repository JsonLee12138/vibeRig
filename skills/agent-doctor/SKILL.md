---
name: agent-doctor
description: Diagnose the availability and correctness of Codex custom subagent TOML files under `.codex/agents/` or `~/.codex/agents/`. Use when the user asks to check, diagnose, validate, or health-check agents; when a spawned subagent behaves as if it has no instructions; or after creating/editing agent TOMLs. Detects the field-ordering bug where `mcp_servers` placed before `developer_instructions` silently breaks the agent.
---

# Agent Doctor

诊断 Codex 自定义 subagent TOML 的**可用性**——能否被 Codex 正确加载并按预期运行。配套的 agent **创建/编写**用 [agent-creator](../agent-creator/SKILL.md)，本 skill 只读检查、不改写 agent（修复需用户确认）。

## Contract

单一职责：扫描一个或多个 agent TOML，逐个给出 `PASS` / `WARN` / `FAIL` 与原因。

不允许：
- 在未经用户确认的情况下改写 agent 文件。
- 安装、发布 agent 或修改全局 Codex 配置。
- 真正启动 MCP server 进程或调用其工具（只检查命令是否存在）。

## 为什么需要

Codex 的 agent 是 TOML。TOML 有一条致命规则：**任何 `[table]` 表头（如 `[mcp_servers.x]`、`[[skills.config]]`）会吞掉它之后所有的裸键**。如果把 `mcp_servers` 写在 `developer_instructions` 之前，`developer_instructions` 会被解析成 `mcp_servers.x.developer_instructions`，于是这个 agent **没有任何指令**——文件能正常解析、不会报错，但 agent 实际是哑的。本 skill 的首要任务就是抓出这类静默失效。

## 检查项

| # | 检查 | 级别 |
|---|---|---|
| 1 | TOML 能否解析 | FAIL |
| 2 | 必填顶层键齐全：`name` / `description` / `developer_instructions` | FAIL |
| 3 | **字段顺序**：所有 `[mcp_servers]` / `[[skills.config]]` 表块在全部顶层标量键**之后** | FAIL |
| 4 | 无未知/不支持的顶层键 | WARN |
| 5 | `sandbox_mode` 取值合法（`read-only` / `workspace-write` / `danger-full-access`） | WARN |
| 6 | `name` 与文件名一致 | WARN |
| 7 | `mcp_servers.*.command` 指向的可执行文件存在于 PATH/磁盘 | WARN |

`FAIL` = agent 无法可靠加载或运行；`WARN` = 可加载但有隐患；`PASS` = 无发现。

## Workflow

### 1. 确定检查目标

默认扫描 `.codex/agents/` 和 `~/.codex/agents/`；也可传入具体文件或目录。

### 2. 运行检查器

```bash
python3 skills/agent-doctor/assets/check_agents.py            # 默认目录
python3 skills/agent-doctor/assets/check_agents.py .codex/agents/
python3 skills/agent-doctor/assets/check_agents.py path/to/one.toml
python3 skills/agent-doctor/assets/check_agents.py --json .codex/agents/   # 机器可读
```

需 Python 3.11+（用内置 `tomllib`）。退出码：有任何 `FAIL` 返回 1，否则 0。

### 3. 报告并按需修复

逐个 agent 汇报 `PASS` / `WARN` / `FAIL` 与原因。对 `FAIL`：
- **字段顺序 bug** → 建议把所有 `[mcp_servers.*]` / `[[skills.config]]` 块移到文件**末尾**，放在 `developer_instructions` 之后。修复后通过 [agent-creator](../agent-creator/SKILL.md) 或直接编辑落地，并重跑检查器确认转为 `PASS`。
- **缺必填键** → 补齐；若因顺序 bug 被吞，先修顺序。
- 任何改写前先向用户确认（本 skill 默认只读）。

## Output Contract

- 检查的文件清单。
- 每个 agent 的状态与具体发现（含行号，便于定位）。
- 汇总：pass / warn / fail 计数。
- 给出的修复建议，以及是否已落地（若用户批准）。

## Red Flags

- agent 解析正常但缺 `developer_instructions` → 几乎必然是字段顺序 bug，不要当成"忘了写指令"。
- `mcp_servers.*.command` 是 macOS 绝对路径（如 `/Applications/...`）→ 换机/换平台会失效，标 `WARN` 并提示。
- 检查器报 `FAIL` 却没有可操作的修复建议 → 报告不合格。

## Validation

```bash
# 自检：内置基线 agents 应全部 PASS
python3 skills/agent-doctor/assets/check_agents.py skills/built-in-agents/assets/
```

- [ ] 每个目标 agent 都有明确的 PASS/WARN/FAIL 结论
- [ ] 每个 FAIL 都给出可操作的修复建议（含行号或表名）
- [ ] 字段顺序 bug 能被稳定检出（含被三引号字符串内文档误伤的排除）
- [ ] 未在用户未确认时改写任何 agent 文件
