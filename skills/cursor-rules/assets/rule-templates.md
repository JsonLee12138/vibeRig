# 常用规则模板

复制对应模板，替换 `[...]` 占位符后填入规则体。

---

## 通用编码规范

```
---
description: [技术栈/场景] 编码规范
globs: "[对应文件 glob]"
alwaysApply: false
---

## 命名规范
- [具体命名规则]

## 文件结构
- [目录/文件组织规则]

## 禁止事项
- 禁止 [具体行为]，原因：[简短说明]

## 示例
[代码片段]
```

---

## React 组件规范

```
---
description: React 函数组件编写规范，包含 Hooks 使用和 Props 类型定义
globs: "src/**/*.tsx, src/**/*.jsx"
alwaysApply: false
---

- 使用函数组件，不用 class 组件
- Props 类型定义为 interface，命名为 `XxxProps`
- 自定义 Hook 放在 `src/hooks/`，文件名 `useXxx.ts`
- 组件文件名 PascalCase，与导出名一致
- 不在组件内直接 fetch 数据，封装到自定义 Hook

示例：
\`\`\`tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}
\`\`\`
```

---

## REST API 设计规范

```
---
description: REST API 路径、响应结构和错误处理约定
globs: "src/api/**/*.ts, src/routes/**/*.ts"
alwaysApply: false
---

## 路径
- 小写 kebab-case：`/user-profiles`，不用 `/userProfiles`
- 资源用复数：`/users`
- 版本前缀：`/api/v1/`

## 响应格式
成功：`{ data: T, meta?: { total, page } }`
错误：`{ error: { code: string, message: string } }`

## HTTP 状态码
- 200 查询成功 / 201 创建成功
- 400 参数错误 / 401 未认证 / 403 无权限 / 404 不存在 / 500 服务端错误
```

---

## Git 提交规范（Conventional Commits）

```
---
description: Git 提交信息格式规范
alwaysApply: false
---

格式：`<type>(<scope>): <subject>`

类型：feat / fix / docs / refactor / test / chore

规则：
- subject 不超过 50 字符，不加句号
- 使用现在时

示例：
- feat(auth): 添加 OAuth2 登录
- fix(api): 修复分页错误
```

---

## 数据库查询规范（Prisma）

```
---
description: Prisma ORM 数据库查询规范，避免 N+1 和事务错误
globs: "src/**/*.ts"
alwaysApply: false
---

- 数据库操作通过 Repository 层，不在 Service 直接调用 Prisma
- 分页查询同时返回 `data` 和 `total`
- 软删除用 `deletedAt`，查询加 `where: { deletedAt: null }`
- 事务用 `prisma.$transaction`
- 用 `include` 预加载关联，避免 N+1

示例：
\`\`\`ts
// 正确
const users = await prisma.user.findMany({
  where: { deletedAt: null },
  include: { profile: true },
  skip: (page - 1) * limit,
  take: limit,
});
\`\`\`
```

---

## 测试规范

```
---
description: 单元测试和集成测试编写规范
globs: "**/*.test.ts, **/*.spec.ts, **/*.test.tsx"
alwaysApply: false
---

- 测试文件与源文件同目录，命名 `xxx.test.ts`
- 用 `describe` 分组，`it` / `test` 描述行为，不描述实现
- 每个 `it` 只断言一件事
- Mock 只用于外部依赖（网络/文件系统），不 mock 内部逻辑
- 测试名格式：`it('should [行为] when [条件]')`
```
