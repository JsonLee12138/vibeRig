---
name: use-codex
description: Call Codex via its MCP server tools (codex + codex-reply) from any agent session. Use when delegating implementation tasks to Codex, running multi-turn Codex sessions, or orchestrating Codex as part of a multi-agent workflow. Requires the Codex MCP server to be registered in the agent config. Do NOT use inside a Codex session itself.
---

# use-codex

通过已注册的 `codex` MCP server 调用 Codex 工具。MCP server 启动命令：`codex mcp-server`。

## 两个核心工具

| 工具 | 用途 |
|------|------|
| `codex` | 启动新的 Codex 会话，返回 `threadId` |
| `codex-reply` | 继续已有会话（需要 `threadId`） |

## 场景速查

| 场景 | 工具 | 关键参数 |
|------|------|---------|
| 一次性任务（分析 / 问答） | `codex` | `prompt`, `sandbox: read-only` |
| 写文件 / 实现代码 | `codex` | `prompt`, `approval-policy: never`, `sandbox: workspace-write` |
| 多轮对话（追问 / 修改） | `codex-reply` | `threadId`, `prompt` |
| 指定模型或配置 | `codex` | `model`, `profile`, `config` |
| 切换工作目录 | `codex` | `cwd` |

## 模型速查

| 值 | 说明 |
|----|------|
| `o3` | 最强推理，复杂任务 |
| `o4-mini` | 快速均衡，日常任务 |
| （省略） | 使用 Codex 本地配置默认模型 |

## 结果接收

Codex MCP 工具是请求-响应模式，**必须 await 工具返回值再继续**。响应结构：

```
# 正确：等待响应，提取内容和 threadId
response = await mcp.call("codex", { prompt: "...", sandbox: "read-only" })
text    = response.structuredContent.content   # 实际文本
threadId = response.structuredContent.threadId  # 多轮时保存此值

# 继续会话（多轮）
reply = await mcp.call("codex-reply", { threadId, prompt: "继续..." })

# 错误：fire-and-forget，结果和 threadId 丢失
mcp.call("codex", { prompt: "..." })
```

响应优先读 `structuredContent`；旧版客户端降级读 `content[0].text`。响应为空或工具报错时，停止并报告给调用方。

## 固定规则

- MCP server 须已在 agent config 注册，key 为 `codex-cli`
- **每次工具调用必须等待响应完成后再继续**
- 需要写文件时，必须同时设 `approval-policy: never` 和 `sandbox: workspace-write`
- 多轮会话必须保存首次响应的 `structuredContent.threadId`，用于后续 `codex-reply`
- `sandbox: danger-full-access` 赋予完整系统权限，仅在用户明确授权时使用

完整参数说明见 [`references/tool-specs.md`](./references/tool-specs.md)。
