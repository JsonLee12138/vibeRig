# Cursor Command Format Reference

## 文件格式

| 支持扩展名 | 说明 |
|---|---|
| `.md` | 推荐，最通用 |
| `.mdc` | 支持，与 Rules 同扩展名但不同目录 |
| `.markdown` | 支持 |
| `.txt` | 支持，但无法渲染 Markdown |

## 存储位置与发现优先级

```
~/.cursor/commands/       ← 全局个人命令（所有项目可用）
<project>/.cursor/commands/ ← 项目级命令（与团队共享，进版本控制）
<plugin>/commands/        ← 插件命令（通过 plugin.json 分发）
```

Cursor 在 `/` 菜单中合并所有位置的命令，同名时项目级优先于全局。

## Frontmatter（可选）

Commands 支持 YAML frontmatter，但**不是必须**的。无 frontmatter 时，文件名即为命令名。

```yaml
---
name: review-code          # 可选：覆盖文件名作为命令名，无需与文件名一致
description: 审查当前文件   # 可选：在 / 菜单中显示的描述
---
```

**不要**在 command frontmatter 中使用 Rules 或 Skills 的专属字段：
- ❌ `globs` — Rules 专用
- ❌ `alwaysApply` — Rules 专用
- ❌ `paths` — Skills 专用

## 命名规则

- 使用 **kebab-case**（小写 + 连字符）
- 避免空格、大写、特殊字符
- 名称描述动作而非工具：`create-pr.md` ✓，`gpt-helper.md` ✗
- 文件名映射为 `/command-name`（不含扩展名）

## Commands vs Skills vs Rules 对比

| 特性 | Command | Skill | Rule |
|---|---|---|---|
| 文件 | `.md` in `commands/` | `SKILL.md` in `skills/<name>/` | `.mdc` in `rules/` |
| 触发 | 用户手动键入 `/name` | AI 语义匹配或用户输入 `/name` | 自动（globs/alwaysApply）或语义 |
| 用途 | 可复用的 AI prompt | 结构化工作流（含 references/scripts） | 编码约定、行为约束 |
| Frontmatter | 可选 | 必须（name + description） | 必须（description/globs/alwaysApply） |
| 复杂度 | 简单 prompt | 中等：含子文件 | 简单/中等 |

## 变量与动态上下文

Cursor commands 不支持 `{{variable}}` 模板变量。动态上下文通过以下方式提供：

- `@<filename>` — 引用特定文件
- `@codebase` — 全代码库搜索
- `@git` — git 历史/diff 上下文
- 用户在触发命令后补充自然语言输入

**技巧**：在 command body 中写 "基于当前打开的文件…" 或 "基于用户的输入…" 来引导 agent 主动询问或使用上下文。

## 企业/团队命令

Cursor Dashboard 支持通过团队账户推送共享命令，成员自动同步，无需手动复制文件（需 Cursor Business 计划）。
