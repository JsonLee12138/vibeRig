# Cursor Rules 语法参考

## .mdc 文件结构

```
---
description: "规则用途描述（Intelligent 模式触发依据）"
globs: "glob-pattern-1, glob-pattern-2"
alwaysApply: false
---

规则正文（Markdown 格式）
```

关键：必须是 `.mdc` 扩展名，`.md` 被 Cursor 完全忽略。

---

## 触发方式

| 类型 | frontmatter 配置 | 何时注入 |
|------|-----------------|---------|
| Always Apply | `alwaysApply: true` | 每次会话 |
| Intelligent | 只填 `description` | AI 判断相关时 |
| Glob 匹配 | 只填 `globs` | 打开匹配文件时 |
| 手动 | 两者都不填 | `@规则名` 手动引用 |

**选择建议**：优先 `globs`（精准），其次 Intelligent（语义触发），最后 `alwaysApply`（全局成本高）。

---

## frontmatter 字段

### `description`

```yaml
# 好：具体场景
description: "编写 React 函数组件时的代码规范，包含 Props 类型和 Hooks 使用"

# 差：模糊
description: "代码规范"
```

### `globs`

多模式用逗号分隔（不用 YAML 数组）：

```yaml
# 正确
globs: "src/**/*.tsx, src/**/*.jsx"

# 错误
globs:
  - "src/**/*.tsx"
```

常用模式：
```
src/**/*.tsx          # src 下所有 tsx
**/*.test.ts          # 全项目测试文件
tailwind.config.*     # 任意扩展名的 tailwind 配置
docs/**/*.md          # docs 下所有 Markdown
{src,lib}/**/*.ts     # src 或 lib 下的 ts
```

---

## 规则类型

| 类型 | 存储位置 | 作用范围 |
|------|----------|----------|
| Project Rules | `.cursor/rules/*.mdc` | 项目内，可版本控制 |
| User Rules | Cursor 设置 → Rules | 全局所有项目 |
| Team Rules | 组织后台 | 团队强制，优先级最高 |
| AGENTS.md | 项目根或子目录 | 纯 Markdown，无 frontmatter |

**优先级**：Team > Project > User（同级冲突取第一匹配）。

---

## 目录组织示例

```
.cursor/rules/
  global.mdc              # alwaysApply: true，全局约定
  typescript.mdc          # globs: **/*.ts
  frontend/
    react.mdc             # globs: src/**/*.tsx
    styles.mdc            # globs: **/*.css
  backend/
    api.mdc               # globs: src/api/**/*.ts
  testing/
    jest.mdc              # globs: **/*.test.ts
```

---

## AGENTS.md 替代方案

无需 frontmatter，直接写 Markdown，适合快速约定：

```markdown
# 项目约定
- 使用 pnpm，不用 npm
- 提交信息遵循 Conventional Commits
```

可放在根目录（全局）或子目录（限定范围）。
