# Codex MCP Tools — 参数规范

MCP server 启动命令：`codex mcp-server`  
注册 key：`codex-cli`

---

## `codex` — 启动 Codex 会话

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | — | 初始用户提示词 |
| `approval-policy` | string | ❌ | `on-request` | shell 命令审批策略：`untrusted` / `on-request` / `never` |
| `base-instructions` | string | ❌ | — | 替换默认系统指令 |
| `config` | object | ❌ | — | 覆盖 `$CODEX_HOME/config.toml` 中的单项配置 |
| `cwd` | string | ❌ | 服务进程当前目录 | 会话工作目录（相对路径基于服务进程解析） |
| `include-plan-tool` | boolean | ❌ | `false` | 是否在会话中包含 plan 工具 |
| `model` | string | ❌ | 本地配置默认 | 模型名称，如 `o3`、`o4-mini` |
| `profile` | string | ❌ | — | 配置 profile 名，Codex 加载 `$CODEX_HOME/<profile>.config.toml` |
| `sandbox` | string | ❌ | `read-only` | 沙箱模式：`read-only` / `workspace-write` / `danger-full-access` |

### 返回值

```json
{
  "structuredContent": {
    "threadId": "019bbb20-bff6-7130-83aa-bf45ab33250e",
    "content": "实际文本输出"
  },
  "content": [
    { "type": "text", "text": "实际文本输出" }
  ]
}
```

- `structuredContent` 为现代 MCP 客户端首选
- `content[0].text` 为旧版客户端降级读取路径
- **`threadId` 须保存**，用于后续 `codex-reply` 调用

### 示例

```json
// 只读分析（默认沙箱）
{ "prompt": "解释 src/auth.ts 的权限模型" }

// 写文件（必须同时设 approval-policy 和 sandbox）
{
  "prompt": "实现一个 bubble sort 函数，写入 src/sort.ts",
  "approval-policy": "never",
  "sandbox": "workspace-write"
}

// 指定模型和工作目录
{
  "prompt": "分析依赖关系",
  "model": "o3",
  "cwd": "/Users/me/myproject"
}

// 使用 profile
{ "prompt": "运行测试套件", "profile": "testing" }
```

---

## `codex-reply` — 继续 Codex 会话

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | — | 下一轮用户提示词 |
| `threadId` | string | ✅ | — | 上次响应的 `structuredContent.threadId` |
| `conversationId` | string | ❌ | — | 已废弃，`threadId` 的别名，保持兼容 |

### 返回值

与 `codex` 相同的响应结构，`threadId` 保持不变（同一会话）。

### 示例

```json
// 多轮对话
{
  "threadId": "019bbb20-bff6-7130-83aa-bf45ab33250e",
  "prompt": "在刚才的函数里增加错误处理"
}

// 追问
{
  "threadId": "019bbb20-bff6-7130-83aa-bf45ab33250e",
  "prompt": "为这个函数写单元测试"
}
```

---

## `approval-policy` 说明

| 值 | 行为 |
|----|------|
| `untrusted` | 所有 shell 命令需人工确认 |
| `on-request` | 默认；视风险决定是否提示 |
| `never` | 自动批准所有命令（自动化场景必用） |

## `sandbox` 说明

| 值 | 权限 |
|----|------|
| `read-only` | 仅读，不写文件、不执行变更 |
| `workspace-write` | 可写项目目录内文件 |
| `danger-full-access` | 完整系统访问权限，谨慎使用 |

## 模型列表

| 值 | 特点 |
|----|------|
| `o3` | 最强推理，复杂分析和实现 |
| `o4-mini` | 快速均衡，日常代码任务 |
| （省略） | 使用 `$CODEX_HOME/config.toml` 中的默认模型 |

## 注意事项

- 写文件场景下，`approval-policy: never` 与 `sandbox: workspace-write` 必须同时设置，缺一不可
- `threadId` 来自响应的 `structuredContent.threadId`，非 `content` 字段，注意读取路径
- 同一 `threadId` 的多轮调用共享上下文，中途切换 `cwd` 或 `model` 需开启新会话
- `danger-full-access` 赋予文件系统完整权限，仅在用户明确授权的受信环境中使用
