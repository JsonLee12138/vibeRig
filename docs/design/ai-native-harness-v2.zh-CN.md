# AI-Native Harness V2

## 目标

V2 保留 `intake → execute → accept-deliver` 三阶段，把项目上下文、本地环境、测试追踪和 Runbook 从提示词约定提升为可执行契约。目标不是增加流程，而是让简单工作保持轻量，让复杂工作拥有足够 Evidence。

## 核心决策

| ID | 决策 | 理由 |
|---|---|---|
| D-01 | 既有项目文档和任务系统继续做唯一 owner | 避免 `.vibeRig` 成为第二套真相源 |
| D-02 | Project Profile V2 声明文档、环境、命令、Evidence 和 tracker adapter | Agent 不再猜怎样运行项目 |
| D-03 | Context Router 按路径、风险和能力加载最小上下文 | 降低上下文成本与错误引用 |
| D-04 | Verification Graph 统一 Outcome—AC—TC—Stage—Evidence | 自动 E2E 与人工 UAT 共享需求定义但证据独立 |
| D-05 | Environment Driver 优先使用项目真实本地命令 | mock 只覆盖适合替代的边界 |
| D-06 | Runbook 只由 Operational change 触发，完成条件是实际演练 | 防止空文档与不可执行操作指南 |
| D-07 | Tracking provider 是 adapter，不阻塞本地工作 | Linear/GitHub 故障不能中断交付 |
| D-08 | 人确认业务 Oracle 和必要 UI 方向；普通测试由 AI/QA 内部审查 | 保留可靠性，减少人工接力 |

## Project Profile

`.vibeRig/project.yaml` V2 是项目 Harness 索引，不是完整工程手册。它引用：

- 项目架构 owner；
- 文档发现模式和 Requirement 状态目录；
- Context Route manifest；
- Environment manifest 与默认 profile；
- bootstrap/start/reset/health/test/smoke 命令；
- Evidence root 与保留策略；
- tracker adapter；
- PR、Gate 和 recurring Subagent 偏好。

`documents.mode=discover` 时，VibeRig 读取已有 PRD、spec、ADR、Runbook 和 issue owner，并在 Work Item 中保存引用。只有项目没有合适 owner 时才创建新文档。

## 上下文与规则路由

每个实现增量按照以下顺序形成 Task Context：

1. 根 `AGENTS.md` 与 Project Profile；
2. 活跃 Work Item / Goal Contract；
3. 命中的 `context-routes.yaml`；
4. 每个修改路径最近的目录级 `AGENTS.md`；
5. 当前 AC/TC、相关 contract/ADR/Runbook；
6. route 声明的验证命令和 Reviewer。

不得把全部需求、全部研究报告或整个 `docs/` 注入 Subagent。

## 环境与凭据

Environment Driver 先运行项目声明的真实命令；只有仍有缺口时才通过 Test Environment Broker 选择 fake、stub、ephemeral dependency、emulator 或 provider sandbox。

| 凭据类别 | 自治边界 |
|---|---|
| Disposable local | 可生成和使用，不输出具体值 |
| Provider sandbox | 已配置且 profile 允许时使用 |
| Shared dev | 只使用现有受限凭据 |
| Production | 默认禁止，写入必须独立授权 |

本地环境必须通过配置或网络拒绝生产端点。Prompt 不是安全边界。

## Verification Graph

复杂 Work Item 形成：

```text
Outcome → AC → TC → authoritative stage → Evidence
```

TC 的权威阶段只能是 `issue_local`、`pr_ci`、`milestone`、`owner_uat` 或 `post_release`。每条 TC 声明最低保真度、命令/人工步骤、artifact 和失效条件。

- Issue：定向 unit、contract、integration、可独立局部 E2E；
- Milestone：跨 Issue E2E、回归和集成；
- Owner UAT：产品语义、体验和无法自动裁决的结果；
- Post release：生产 Smoke、观察窗口和真实运行信号。

自动 E2E 与 owner UAT 可以验证同一 AC，但不能互相替代。

## 最少充分拆分

Milestone 按可观察、可演示、可做决策的用户价值划分。Issue 是可独立验收、通常能由一个有意义 PR 交付的垂直单元。

继续拆分只因为：

1. 子项可独立验收或发布；
2. 可以真正并行；
3. 有独立验证或回滚风险；
4. 整体明显超过一个合理 PR。

代码、测试、迁移和文档共同完成一个行为时放入内部 checklist。每个 Milestone 默认 2–6 个 Issue；超过 8 个必须逐项解释独立价值。

`parallelGroup` 表示收益，`conflictSet` 表示不能并发修改的共享契约/迁移/核心文件，`integrationPoints` 定义 join，`rollbackUnit` 定义回退边界。前后端不默认分 Issue；只有契约稳定且能分别验收时才并发。

## 人工 Gate

| Gate | 默认 |
|---|---|
| 需求目标、范围、非目标、业务 AC | 必须确认一次 |
| 新页面/主流程/信息架构/视觉方向 | 合并进需求 Gate 条件确认 |
| 普通技术方案与测试用例 | AI/QA 内部完成 |
| 资金、权限、核心不变量、不可逆迁移的测试契约 | 条件人工审查 |
| 产品/UI UAT | 必须明确结论 |
| Merge/Release/生产副作用 | 独立明确授权 |

## Runbook

新服务、运行配置、部署、迁移、回填、恢复、监控、外部依赖、Smoke 或回滚变化触发 Runbook。Runbook 必须有 owner、触发条件、诊断/执行/验证/回滚命令和演练 Evidence。

只有 Markdown 文件存在不代表完成；必须在允许的 local、ephemeral 或 staging 环境按当前 commit 实际演练。

## 兼容迁移

V1 项目不会被普通 `viberig init` 静默改写。用户明确运行：

```bash
viberig init --upgrade --yes
```

迁移会：

- 将 `version` 更新为 2；
- 将 `docs.root` 映射到 `documents.requirement_root`；
- 删除固定 `.worktrees` 的旧 `workspace` 段；
- 补齐 V2 section；
- 保留已有已知配置和未知扩展键；
- 不覆盖已存在的 context/environment/Runbook manifest。

## 非目标

- 不在本阶段实现所有宿主的机械 Hook adapter；
- 不强制项目采用完整标准 `docs/` 目录；
- 不把所有 40+ Skills 重写成新入口；
- 不让 VibeRig 取代现有 issue tracker、CI 或 secrets provider；
- 不将生产写入权限从本地高自治自动推断出来。
