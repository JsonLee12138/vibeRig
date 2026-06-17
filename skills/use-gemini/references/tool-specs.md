# Gemini MCP Tools — 参数规范

MCP server：`npx -y @tuannvm/gemini-mcp-server`  
注册 key：`gemini-cli`

---

## `gemini` — 文件与代码库分析

用 Gemini 的超大上下文（1M+ tokens）分析本地文件或代码库。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | — | 问题或分析指令，用 `@path` 引用文件，`@.` 指当前目录 |
| `model` | string | ❌ | `gemini-3-pro-preview` | 模型（见下方列表） |
| `sandbox` | boolean | ❌ | `false` | 沙箱模式（限制 Gemini 执行权限） |
| `yolo` | boolean | ❌ | `false` | 自动批准所有工具执行，Workspace Extension 必需 |
| `changeMode` | boolean | ❌ | `false` | 结构化代码编辑模式 |
| `chunkIndex` | number | ❌ | — | 分块响应索引（1-based），用于大型 changeMode 响应 |
| `chunkCacheKey` | string | ❌ | — | 上次分块响应的 cache key |

### 示例

```json
// 分析整个代码库
{ "prompt": "分析 @. 并输出架构概览" }

// 对比两个文件
{ "prompt": "对比 @src/old.ts 和 @src/new.ts 的差异" }

// 快速模型
{ "prompt": "总结 @package.json 的依赖", "model": "gemini-3-flash-preview" }

// 结构化代码修改
{ "prompt": "重构 @src/utils.ts，改进错误处理", "changeMode": true }
```

---

## `web-search` — 实时网络搜索

Google Search grounding，适合时效性查询。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `query` | string | ✅ | — | 搜索词 |
| `summarize` | boolean | ❌ | `true` | 是否汇总结果（`false` 返回原始搜索结果） |
| `model` | string | ❌ | `gemini-3-flash-preview` | 模型 |

### 示例

```json
// 汇总（默认）
{ "query": "React 19 有哪些新特性" }

// 原始结果
{ "query": "kubernetes security best practices 2025", "summarize": false }
```

---

## `analyze-media` — 多模态媒体分析

分析图片、PDF、截图等。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `filePath` | string | ✅ | — | 文件路径，使用 `@` 语法，如 `@error.png` |
| `prompt` | string | ✅ | — | 分析指令 |
| `model` | string | ❌ | `gemini-3-pro-preview` | 模型 |
| `detailed` | boolean | ❌ | `false` | 是否输出详细分析 |

### 支持格式

图片：PNG、JPG、GIF、WebP；文档：PDF

### 示例

```json
// 分析截图
{ "filePath": "@error.png", "prompt": "这个错误是什么原因" }

// 详细分析架构图
{ "filePath": "@architecture.pdf", "prompt": "解释系统设计", "detailed": true }
```

---

## `brainstorm` — 创意头脑风暴

结构化方法论驱动的创意生成。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ | — | 头脑风暴主题 |
| `methodology` | string | ❌ | `auto` | 方法论（见下方列表） |
| `domain` | string | ❌ | — | 领域上下文 |
| `constraints` | string | ❌ | — | 已知限制或要求 |
| `ideaCount` | number | ❌ | — | 目标创意数量 |
| `includeAnalysis` | boolean | ❌ | `false` | 是否包含可行性分析 |

### 方法论选项

| 值 | 说明 |
|----|------|
| `auto` | 自动选择最合适的方法论 |
| `divergent` | 发散思维，生成多样创意 |
| `convergent` | 收敛聚焦，精炼已有方向 |
| `SCAMPER` | 替换/组合/调整/修改/转用/消除/反转 |
| `design-thinking` | 同理心→定义→创意→原型→测试 |
| `lateral` | 横向思维技术 |

### 示例

```json
// 基础头脑风暴
{ "prompt": "如何改善用户引导流程" }

// 带方法论和分析
{ "prompt": "优化结账流程", "methodology": "SCAMPER", "includeAnalysis": true }
```

---

## `shell` — Shell 命令生成

生成并（可选）执行 shell 命令。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `task` | string | ✅ | — | Shell 任务描述 |
| `dryRun` | boolean | ❌ | `true` | `true` 仅说明命令不执行，`false` 实际执行 |
| `workingDirectory` | string | ❌ | — | 执行目录 |
| `model` | string | ❌ | `gemini-3-flash-preview` | 模型 |

### 示例

```json
// 预览（默认，安全）
{ "task": "找出所有大于 100KB 的 TypeScript 文件" }

// 实际执行（需确认安全）
{ "task": "运行测试套件", "dryRun": false }
```

---

## 模型列表

| 值 | 特点 |
|----|------|
| `gemini-3-pro-preview` | 最强推理，复杂分析（`gemini`/`analyze-media` 默认） |
| `gemini-3-flash-preview` | 快速均衡（`web-search`/`shell` 默认，本项目配置默认） |
| `gemini-2.5-flash-lite` | 最快，轻量简单任务 |

## 注意事项

- `@` 路径语法由 Gemini CLI 处理，只在 `gemini` 和 `analyze-media` 工具中有效
- `changeMode` 响应可能超大，用 `chunkIndex` + `chunkCacheKey` 分块获取（cache TTL 10 分钟）
- `yolo: true` 绕过所有工具执行确认，仅限 Workspace Extension 等受信任场景
- 配额超限时自动降级：`gemini-3-pro-preview` → `gemini-3-flash-preview`
