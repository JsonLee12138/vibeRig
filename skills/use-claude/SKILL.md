---
name: use-claude
description: Call the local Claude CLI from any agent session (Codex, OpenCode, Gemini, etc.). Use when delegating a task to Claude, switching to a specific Claude model, or leveraging Claude's tools (Bash/Read/Edit/Write). Do NOT use inside a Claude session itself.
---

# use-claude

在任意 agent 环境（Codex、OpenCode、Gemini 等）中通过 Bash 直接调用本地 `claude -p`，无需任何额外服务。**不适用于 Claude 自身**。

## 固定规则

- 始终加 `--permission-mode bypassPermissions`
- 默认模型 `sonnet`，可通过 `--model` 覆盖
- 默认输出格式 `text`
- **必须捕获输出并等待完成**，不得后台运行（禁止 `&`）

## 结果接收

调用后必须同步等待进程完成，并将 stdout 赋值给变量再使用：

```bash
# 正确：同步等待，捕获结果
result=$(claude -p "<PROMPT>" --permission-mode bypassPermissions --model sonnet)
# 此后 $result 包含完整输出，可继续处理

# 错误：后台运行，拿不到结果
claude -p "<PROMPT>" --permission-mode bypassPermissions &
```

退出码 `0` 表示成功，非零表示失败，失败时 stderr 包含错误信息。

## 命令模板

```bash
claude -p "<PROMPT>" \
  --permission-mode bypassPermissions \
  --model <MODEL> \
  [--system-prompt "<SYSTEM>"] \
  [--append-system-prompt "<APPEND>"] \
  [--allowedTools Bash Read Edit Write] \
  [--add-dir <DIR>] \
  [--output-format text|json]
```

## 场景速查

| 场景 | 关键 flags |
|------|-----------|
| 纯问答 / 推理 | 只加 `--model` |
| 指定角色或背景 | `--system-prompt` |
| 让 Claude 读写文件 | `--allowedTools Bash Read Edit Write --add-dir <目录>` |
| 获取结构化输出 | `--output-format json` |
| 快速轻量任务 | `--model haiku` |
| 复杂推理 / 长上下文 | `--model opus` |

## 支持的模型

| 简写 | 说明 |
|------|------|
| `sonnet` | 默认，均衡性能 |
| `opus` | 最强，复杂推理 |
| `haiku` | 最快，轻量任务 |
| `fable` | 创意生成 |

完整参数说明见 [`references/tool-specs.md`](./references/tool-specs.md)。
