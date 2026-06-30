---
name: agent-doctor
description: Diagnose the availability and correctness of Cursor subagent Markdown files under `agents/` or `.cursor/agents/`. Use when the user asks to check, diagnose, validate, or health-check agents; when a subagent behaves unexpectedly; or after creating/editing agent files. Detects missing frontmatter, empty prompt bodies, and stale TOML remnants.
---

# Agent Doctor

诊断 Cursor subagent Markdown 文件的**可用性**——能否被 Cursor 正确加载并按预期运行。配套的 agent **创建/编写**用 [agent-creator](../agent-creator/SKILL.md)，本 skill 只读检查、不改写 agent（修复需用户确认）。

## Contract

单一职责：扫描一个或多个 agent `.md` 文件，逐个给出 `PASS` / `WARN` / `FAIL` 与原因。

不允许：
- 在未经用户确认的情况下改写 agent 文件。
- 安装、发布 agent 或修改全局 Cursor 配置。

## 检查项

| # | 检查 | 级别 |
|---|---|---|
| 1 | 文件存在且可读 | FAIL |
| 2 | Frontmatter 是合法 YAML（`---` 块完整） | FAIL |
| 3 | Prompt body 非空（文件有实质指令） | FAIL |
| 4 | `name`（若存在）符合 lowercase-hyphens 规则，与文件名一致 | WARN |
| 5 | `description` 字段存在（缺失则自动路由无法匹配） | WARN |
| 6 | `model` 取值合法：`inherit` 或可识别的 model ID | WARN |
| 7 | `readonly` / `is_background`（若存在）是 boolean | WARN |
| 8 | 无 TOML 遗留字段（`developer_instructions`、`sandbox_mode`、`mcp_servers`） | WARN |
| 9 | `## Mission` 段存在且 ≤ 2 句 | WARN |
| 10 | `## Scope` 段包含 `Not allowed:` 列表 | WARN |

`FAIL` = agent 无法可靠加载或运行；`WARN` = 可加载但有隐患；`PASS` = 无发现。

## Workflow

### 1. 确定检查目标

默认扫描 `agents/` 和 `.cursor/agents/`；也可传入具体文件或目录。

```bash
find agents/ .cursor/agents/ -name "*.md" 2>/dev/null | sort
```

### 2. 逐文件检查

对每个 `.md` 文件：

```bash
# 检查 frontmatter 块是否存在
head -20 <file>

# 检查是否有 TOML 残留字段
grep -n "developer_instructions\|sandbox_mode\|mcp_servers" <file>

# 检查 name 与文件名一致性
grep "^name:" <file>
```

### 3. 报告并按需修复

逐个 agent 汇报 `PASS` / `WARN` / `FAIL` 与原因。对 `FAIL`：
- **Frontmatter 缺失或非法** → 用 [agent-creator](../agent-creator/SKILL.md) 补写 frontmatter。
- **Prompt body 为空** → agent 无任何指令，必须补充。
- 任何改写前先向用户确认（本 skill 默认只读）。

## Output Contract

- 检查的文件清单。
- 每个 agent 的状态与具体发现。
- 汇总：pass / warn / fail 计数。
- 给出的修复建议，以及是否已落地（若用户批准）。

## Validation

```bash
# 统计检查目标
find agents/ .cursor/agents/ -name "*.md" 2>/dev/null | wc -l
```

- [ ] 每个目标 agent 都有明确的 PASS/WARN/FAIL 结论。
- [ ] 每个 FAIL 都给出可操作的修复建议。
- [ ] 未在用户未确认时改写任何 agent 文件。
