# Claude MCP Tool — 参数规范

## Tool 名称

`claude`

## 固定行为

- 始终以非交互模式运行（`-p` flag）
- 始终附加 `--permission-mode bypassPermissions`
- 默认模型：环境变量 `CLAUDE_DEFAULT_MODEL`，未设置则用 `sonnet`

## 参数列表

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | — | 发给 Claude 的提示词 |
| `model` | string | ❌ | `sonnet` | 模型简写或完整 ID（见下方支持列表） |
| `system_prompt` | string | ❌ | — | 覆盖默认 system prompt（`--system-prompt`） |
| `append_system_prompt` | string | ❌ | — | 追加到默认 system prompt，不覆盖（`--append-system-prompt`） |
| `allowed_tools` | string | ❌ | — | 允许 Claude 使用的工具，逗号分隔（`--allowedTools`）例：`"Bash,Read,Edit,Write"` |
| `add_dir` | string | ❌ | — | 扩展 Claude 可访问的目录路径（`--add-dir`） |
| `output_format` | string | ❌ | `text` | 输出格式：`text` / `json` / `stream-json` |

## 支持的模型值（`model` 参数）

| 简写 | 对应模型 |
|------|---------|
| `sonnet` | claude-sonnet-4-6（默认） |
| `opus` | claude-opus-4-8 |
| `haiku` | claude-haiku-4-5 |
| `fable` | claude-fable-5 |
| 完整 ID | 例：`claude-sonnet-4-6`，直接传入 |

## 生成的命令行

```bash
claude -p "$PROMPT" \
  --permission-mode bypassPermissions \
  --model "$MODEL" \
  [--system-prompt "$SYSTEM_PROMPT"] \
  [--append-system-prompt "$APPEND_SYSTEM"] \
  [--allowedTools "$TOOL1" "$TOOL2" ...] \
  [--add-dir "$ADD_DIR"] \
  [--output-format "$OUTPUT_FORMAT"]
```

## 调用示例

### 1. 基础问答
```json
{ "prompt": "用中文解释 async/await 的原理" }
```

### 2. 切换模型
```json
{ "prompt": "review this PR diff", "model": "opus" }
```

### 3. 带 system prompt
```json
{
  "prompt": "分析这段代码的性能瓶颈",
  "system_prompt": "你是一名专注性能优化的高级工程师，回答要精炼"
}
```

### 4. 给 Claude 挂工具（让 Claude 真正读写文件）
```json
{
  "prompt": "读取 src/index.ts 并找出所有未使用的导出",
  "allowed_tools": "Bash,Read",
  "add_dir": "/Users/me/myproject"
}
```

### 5. 获取结构化 JSON 输出
```json
{
  "prompt": "以 JSON 格式输出三个重构建议，字段：title, reason, priority",
  "output_format": "json"
}
```

## 注意事项

- `allowed_tools` 为空时 Claude 仅做纯对话，不执行任何 tool
- `add_dir` 只扩展目录访问权限，不会自动读取文件内容，需在 prompt 里明确要求
- `output_format=json` 返回的 JSON 含 `result`、`cost_usd`、`usage` 等 metadata 字段
- `stream-json` 适合长任务，但 MCP 层需额外处理流式解析
