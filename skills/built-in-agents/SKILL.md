---
name: built-in-agents
description: Install vb-plugin baseline agent TOMLs into the current project's .codex/agents/. Use when initializing a VibeRig project or when baseline agents are missing. Called by vb-init; can also be run standalone to restore missing baseline agents. Do not use to update or regenerate project-specific agents.
---

# Built-in Agents

将 vb-plugin 自带的基线 agent TOML 文件安装到当前项目的 `.codex/agents/` 目录。所有操作**幂等**——已存在的文件跳过，不覆盖。

## Contract

单一职责：把 `assets/` 中的基线 agent TOML 写入 `.codex/agents/`。

不允许：
- 覆盖已存在的 agent 文件（除非传 `--force`）
- 修改 `project.yaml` 的任何字段（由调用方负责）
- 创建 `assets/` 中不存在的 agent

## 基线 Agents

| 文件 | Agent | 职责 |
|---|---|---|
| `code_review.toml` | code_review | 代码质量审查 |
| `gemini_research.toml` | gemini_research | Gemini 辅助研究 |
| `integrator.toml` | integrator | 跨模块集成 |
| `qa.toml` | qa | QA 验证 |
| `researcher.toml` | researcher | 研究与只读分析 |
| `security_auditor.toml` | security_auditor | 安全漏洞扫描 |
| `self_learner.toml` | self_learner | 事后学习（配合 vb-learn）|
| `test_engineer.toml` | test_engineer | 测试编写 |
| `uiux_design.toml` | uiux_design | UI/UX 设计审查 |

## Workflow

### 1. 确保目标目录存在

```bash
mkdir -p .codex/agents
```

### 2. 写入基线 agents

对 `assets/` 中的每个 TOML 文件：
- 目标文件不存在 → 写入
- 目标文件已存在且未传 `--force` → 跳过，记录到报告

读取每个 TOML 文件内容并写入对应的 `.codex/agents/<name>.toml`。

### 3. 输出报告

```
基线 agents 安装结果：
  researcher.toml      → 已写入
  code_review.toml     → 跳过（已存在）
  ...

汇总：X 个写入，Y 个跳过
```

## Validation

```bash
ls .codex/agents/code_review.toml \
   .codex/agents/gemini_research.toml \
   .codex/agents/integrator.toml \
   .codex/agents/qa.toml \
   .codex/agents/researcher.toml \
   .codex/agents/security_auditor.toml \
   .codex/agents/self_learner.toml \
   .codex/agents/test_engineer.toml \
   .codex/agents/uiux_design.toml
```

- [ ] 所有 9 个基线 agent TOML 存在于 `.codex/agents/`
- [ ] 报告列出每个文件的动作（写入/跳过）
- [ ] 无文件被静默覆盖
