# VibeRig Dashboard 前端计划

## 范围

这份计划只覆盖 VibeRig Dashboard / 前端工作。后端任务引擎、全局 SQLite、MCP Service、HTTP Bridge、任务导入、Runner、导出能力都视为已有能力。

目标是把当前本地面板升级成一个清晰的任务工作台：

```text
项目切换 -> 需求切换 -> 任务看板 -> 任务详情 -> 验收面板 -> 执行证据
```

## 产品目标

- 支持在一个全局 Dashboard 中查看所有已注册项目。
- 先选择项目，再进入该项目的需求和任务看板。
- 每个项目有独立任务看板，状态来自全局 VibeRig 服务。
- 看板能展示 roadmap、task、task 状态、验收状态、执行状态、人工验收状态。
- 用户不需要打开原始 Markdown 文件，也能完成任务查看、状态流转和验收。
- 所有写操作都通过后端 HTTP/MCP-backed service 完成，前端不直接写文件、不直接写 SQLite。

## 非目标

- 不实现后端 schema、MCP tools、runner 或 import 逻辑。
- 不把 Linear、Lark、Obsidian、external integrations 做成默认流程。
- 不做图谱优先的主界面。
- 不只依赖拖拽操作，所有拖拽状态变更都必须有按钮/菜单形式的等价操作。

## 整体页面结构

```text
顶部栏
  项目切换
  需求切换
  刷新项目
  注册项目

主区域
  任务看板

右侧抽屉
  任务详情
  验收矩阵
  Run 记录
  Evidence
  人工验收
```

## 看板核心功能

### 1. 项目切换

项目切换是 Dashboard 的第一层入口。

功能：

- 展示所有已注册项目。
- 显示项目名称、项目路径、项目状态。
- 显示 requirement 数量。
- 显示任务汇总：Ready、Running、Blocked、Failed、Accepted。
- 支持切换当前项目。
- 支持刷新当前项目，从项目 `.vibeRig/requirements/` 重新导入最新任务定义。
- 支持注册新项目。

交互规则：

- 未选择项目时，不显示任务看板。
- 选择项目后，加载该项目下的需求列表。
- 当前项目应该写入 URL query，刷新页面后可恢复。
- 项目刷新失败时，不清空当前看板，只显示错误状态。

验收标准：

- 用户能看到全局 VibeRig 数据库里的所有项目。
- 用户切换项目后，看板数据随之切换。
- 项目 A 的任务状态不会混入项目 B。

### 2. 需求切换

每个项目下面可能有多个 requirement，每个 requirement 有自己的任务看板。

功能：

- 展示当前项目下的 requirement 列表。
- 显示 requirement id、标题、状态。
- 显示任务数量、已验收数量、阻塞数量、失败数量。
- 显示最后导入时间。
- 显示源文件 hash/revision 是否变化。
- 支持切换当前 requirement。

交互规则：

- 切换 requirement 后，看板列和任务详情都切换到对应 requirement。
- 当前 requirement 应该写入 URL query。
- 如果项目没有 requirement，显示空状态和刷新/导入入口。

验收标准：

- 用户能在同一个项目中切换不同需求。
- 切换需求后任务列、验收项、run 记录都正确更新。

### 3. 任务看板

任务看板是主工作区。

默认列：

```text
Backlog
Ready
Running
Self Accepted
Human Review
Accepted
Blocked
Failed
```

每列功能：

- 显示该状态下的任务数量。
- 支持列内排序。
- 支持接收合法状态迁移的任务卡片。
- 支持折叠低频列，例如 Accepted。

任务卡片展示字段：

- Task id，例如 `T1`。
- 任务标题。
- 所属 roadmap item。
- 依赖数量。
- 验收进度，例如 `3/5`。
- 最近一次 run 状态。
- 人工验收状态。
- 阻塞/失败原因摘要。

任务卡片操作：

- 点击打开任务详情抽屉。
- 拖拽到其他列改变状态。
- 使用卡片菜单改变状态。
- 使用卡片菜单启动 run，如果后端已暴露 run 能力。
- 使用卡片菜单查看 evidence。

拖拽规则：

- 拖拽只是发起状态变更请求，不直接视为成功。
- 后端接受后，卡片才停留在目标列。
- 后端拒绝时，卡片回到原列，并显示原因。
- 非法状态流转不能静默失败。

验收标准：

- 用户可以通过看板了解所有任务当前状态。
- 用户可以通过拖拽或菜单完成状态变更。
- 后端规则拒绝时，前端能清晰显示错误。
- SSE/Event stream 有更新时，看板自动刷新或局部更新。

### 4. 任务详情抽屉

任务详情抽屉用于查看和操作单个任务。

内容：

- 任务标题和 id。
- 当前状态。
- 所属项目和 requirement。
- 所属 roadmap item。
- scope include / exclude。
- 依赖任务。
- validation commands。
- acceptance checklist。
- run history。
- evidence files。
- activity timeline。
- 人工验收入口。

交互：

- 点击任务卡片打开。
- URL query 记录当前 task id，支持刷新恢复。
- 依赖任务可以点击跳转到对应详情。
- 抽屉关闭后，焦点回到原任务卡片。

验收标准：

- 用户不打开 Markdown 文件也能理解任务范围。
- 用户能看到任务为什么不能进入下一状态。
- 用户能从详情里找到验收和执行证据。

### 5. 验收矩阵

验收矩阵用于明确任务是否满足 acceptance criteria。

展示字段：

- Acceptance id。
- Acceptance 描述。
- 当前结果：Not Run、Pass、Fail、Partial、Blocked。
- 关联 evidence。
- 最近 reviewer。
- 残余风险。

功能：

- 展示当前任务关联的验收项。
- 展示每条验收项的执行结果。
- 支持查看 evidence 摘要。
- 支持人工 review 表单。
- 支持显示阻止进入 Accepted 的原因。

人工验收表单：

- reviewer。
- result。
- notes。
- reviewed evidence。
- accepted residual risks。

验收标准：

- `self_accepted` 前必须能看到 validation evidence。
- `accepted` 前必须能看到人工 review 或后端允许的 auto-accept。
- 用户能明确知道哪条验收项还没有通过。

### 6. Run 和 Evidence

Run 和 Evidence 用于回答“任务是否真的执行过”。

Run list 字段：

- run id。
- 状态。
- 开始时间。
- 结束时间。
- exit code。
- command。
- worktree path。

Evidence 字段：

- `self-acceptance.md`
- `validation.json`
- `run.log`
- `changed-files.txt`
- `human-review.md`

功能：

- 查看 run 列表。
- 查看实时或最近 run log。
- 查看 validation 结果摘要。
- 查看 changed files。
- 预览 self-acceptance。
- 打开或复制 evidence 文件路径。

验收标准：

- Running 任务有日志反馈。
- Failed 任务保留失败日志。
- Self Accepted 任务能看到自验收证据。
- Human Review 能看到人工验收记录。

## 前端模块拆分

推荐结构：

```text
dashboard/
  src/
    app/
      DashboardApp.tsx
      api.ts
      events.ts
      types.ts
    projects/
      ProjectSelector.tsx
      ProjectSummary.tsx
    requirements/
      RequirementSelector.tsx
      RequirementHeader.tsx
    board/
      TaskBoard.tsx
      TaskColumn.tsx
      TaskCard.tsx
      boardRules.ts
    task-detail/
      TaskDrawer.tsx
      TaskSummary.tsx
      ScopePanel.tsx
      DependencyPanel.tsx
      ActivityTimeline.tsx
    acceptance/
      AcceptanceMatrix.tsx
      AcceptanceChecklist.tsx
      ManualReviewForm.tsx
    runs/
      RunList.tsx
      RunLogViewer.tsx
      EvidenceList.tsx
    shared/
      EmptyState.tsx
      StatusBadge.tsx
      ToolbarButton.tsx
      ConfirmDialog.tsx
```

## 前端任务拆分

### FE-1: 前端基础结构

目标：建立可维护的 Dashboard 前端结构。

任务：

- 建立 dashboard 前端目录。
- 定义 Project、Requirement、Task、Acceptance、Run、Evidence、Activity 类型。
- 封装 API client。
- 封装 SSE/Event client。
- 建立 loading、error、empty state 基础组件。

验收：

- 前端能获取项目列表。
- API 类型能覆盖看板核心数据。
- SSE 断线后可以重连。

### FE-2: 项目和需求切换

目标：让项目切换成为 Dashboard 第一入口。

任务：

- 实现 ProjectSelector。
- 实现 RequirementSelector。
- 实现 URL query 状态。
- 实现项目刷新。
- 实现无项目、无需求空状态。

验收：

- 选择项目后加载需求。
- 选择需求后加载看板。
- 刷新页面后恢复当前项目和需求。

### FE-3: 任务看板

目标：展示并操作任务状态。

任务：

- 实现 TaskBoard。
- 实现 TaskColumn。
- 实现 TaskCard。
- 接入 dnd-kit。
- 实现列内排序。
- 实现跨列状态变更。
- 实现卡片状态菜单。
- 实现非法移动回滚。

验收：

- 任务按状态进入正确列。
- 拖拽排序能持久化。
- 跨列移动遵守后端状态规则。
- 非法移动有明确错误提示。

### FE-4: 任务详情抽屉

目标：在看板内查看完整任务上下文。

任务：

- 实现 TaskDrawer。
- 展示 summary、scope、dependencies、validation commands。
- 展示 activity timeline。
- 支持依赖任务跳转。
- 支持 URL deep link。

验收：

- 点击卡片打开详情。
- 刷新页面能恢复指定任务详情。
- 后端更新后详情能刷新。

### FE-5: 验收和人工 Review

目标：把验收状态变成可操作界面。

任务：

- 实现 AcceptanceMatrix。
- 实现 AcceptanceChecklist。
- 实现 ManualReviewForm。
- 展示 evidence 关联。
- 展示后端 guardrail 错误。

验收：

- 每个任务能看到关联验收项。
- 人工 review 能写入 reviewer/result/notes。
- Accepted 状态必须由服务端规则允许。

### FE-6: Run 和 Evidence

目标：让执行过程可见。

任务：

- 实现 RunList。
- 实现 RunLogViewer。
- 实现 EvidenceList。
- 展示 changed files。
- 如果后端支持，增加启动 run 按钮。

验收：

- Running 任务能看到日志变化。
- Failed run 能看到失败日志。
- Successful run 能看到 validation 和 self-acceptance。

### FE-7: 响应式和可访问性

目标：保证 Dashboard 在不同窗口下可用。

任务：

- 宽屏显示多列看板。
- 窄屏切换为堆叠列或紧凑列表。
- 所有拖拽操作提供菜单替代。
- 抽屉 focus 管理。
- 状态 badge 对比度检查。

验收：

- 常见桌面宽度无文字重叠。
- 小屏窗口仍可完成项目切换、任务查看、状态变更。
- 不使用拖拽也能完成核心流程。

## 前端验收清单

- Dashboard 先显示项目切换。
- 项目切换后才显示该项目的需求和任务。
- 需求切换后看板数据正确切换。
- 看板列展示任务数量和状态。
- 卡片展示验收进度和最近 run 状态。
- 拖拽和菜单都能改变状态。
- 非法状态变更会回滚并显示原因。
- 任务详情展示 scope、依赖、验收、run、evidence、activity。
- 人工验收可以在 Dashboard 内完成。
- Run 日志和 evidence 可查看。
- 前端不直接写文件或 SQLite。

## 实施顺序

```text
FE-1 前端基础结构
FE-2 项目/需求切换
FE-3 任务看板
FE-4 任务详情抽屉
FE-5 验收和人工 Review
FE-6 Run 和 Evidence
FE-7 响应式和可访问性
```

第一阶段应优先完成项目切换、需求切换和任务看板。只有这三件事可用后，Dashboard 才能替代当前“看日志和猜状态”的工作方式。

## 完成状态

完成日期：2026-05-28。

- FE-1 已完成：新增 `dashboard/` Vite + React + TypeScript 前端结构、服务 API client、SSE client、Project/Requirement/Task/Acceptance/Run/Evidence/Activity 类型和共享 UI 基础组件。
- FE-2 已完成：实现项目选择、需求选择、URL query 状态、项目刷新/注册动作，以及无项目/无需求空状态。
- FE-3 已完成：实现 dnd-kit 看板列、任务卡片、显式状态切换、启动 run、服务端排序动作，以及服务拒绝后的重新加载和错误提示。
- FE-4 已完成：实现任务详情抽屉，展示 summary、scope、依赖、validation commands、activity timeline，并支持任务 deep link。
- FE-5 已完成：实现验收矩阵、验收状态更新、人工 review 表单、evidence 选择和后端 guardrail 错误展示。
- FE-6 已完成：实现 run history、轮询 run log viewer、evidence 列表和复制路径、evidence discovery，以及启动 run 集成。
- FE-7 已完成：实现响应式看板/抽屉布局、窄屏堆叠、键盘可达的按钮/选择控件和高对比状态 badge。
- 服务集成已完成：`api/server.py` 会在存在 `dashboard/dist` 时托管构建后的前端，未构建时保留原内联 Dashboard 兜底，并补齐本计划中的 REST 风格别名路由，同时兼容原 HTTP bridge。

验收命令：

```text
python3 -B -m py_compile api/server.py tests/test_viberig_task_engine.py
python3 -B -m unittest tests.test_viberig_task_engine
npm --prefix dashboard run typecheck
npm --prefix dashboard run build
```
