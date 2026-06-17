---
name: use-gemini
description: Call Gemini via MCP tools (gemini-cli server) from any agent session. Use when you need web search with Google grounding, large-context codebase analysis (1M+ tokens), multimodal media analysis (images/PDFs), or creative brainstorming. Requires the gemini-cli MCP server to be registered in the agent config. Do NOT use inside a Gemini session itself.
---

# use-gemini

通过已注册的 `gemini-cli` MCP server 调用 Gemini 工具。MCP server 启动命令：`npx -y @tuannvm/gemini-mcp-server`。

## 五个核心工具

| 工具 | 用途 |
|------|------|
| `gemini` | 文件 / 代码库分析（用 `@` 引用文件） |
| `web-search` | 带 Google Search grounding 的实时网络搜索 |
| `analyze-media` | 分析图片、PDF、截图 |
| `brainstorm` | 结构化创意头脑风暴 |
| `shell` | 生成 shell 命令（默认 dry-run，`dryRun: false` 才执行） |

## 场景速查

| 场景 | 工具 | 关键参数 |
|------|------|---------|
| 实时信息 / 技术趋势 | `web-search` | `query` |
| 分析整个代码库 | `gemini` | `prompt: "分析 @."` |
| 分析单个文件 | `gemini` | `prompt: "解释 @src/main.ts"` |
| 读取截图 / PDF | `analyze-media` | `filePath: "@error.png"`, `prompt` |
| 头脑风暴方案 | `brainstorm` | `prompt`, `methodology` |
| 生成 shell 命令（仅预览） | `shell` | `task`, `dryRun: true` |

## 模型速查

| 值 | 说明 |
|----|------|
| `gemini-3-pro-preview` | 最强，复杂推理（`gemini` 默认） |
| `gemini-3-flash-preview` | 快速均衡（`web-search` / `shell` 默认） |
| `gemini-2.5-flash-lite` | 最快，轻量 |

## 结果接收

MCP 工具调用是请求-响应模式，**必须 await 工具返回值再继续**，不得忽略响应或并发触发后不等待：

```
# 正确：等待响应后使用结果
response = await mcp.call("web-search", { query: "..." })
use(response.content)

# 错误：触发后不等待，直接继续
mcp.call("gemini", { prompt: "..." })   # fire-and-forget，结果丢失
```

工具响应结构为 `{ content: [...] }`，实际文本在 `content[0].text`。响应为空或工具报错时，停止并报告给调用方，不得用空结果继续执行。

## 固定规则

- MCP server 须已在 agent config 注册，key 为 `gemini-cli`
- **每次工具调用必须等待响应完成后再继续**（尤其是链式调用时）
- `shell` 工具默认 `dryRun: true`，**不执行命令**；需执行时显式设 `dryRun: false`
- `yolo: true` 仅用于 Gemini CLI Extensions（Google Workspace 等），日常分析不加
- `changeMode: true` 仅用于结构化代码修改，日常不加

完整参数说明见 [`references/tool-specs.md`](./references/tool-specs.md)。
