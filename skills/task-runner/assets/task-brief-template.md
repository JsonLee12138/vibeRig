# Task Brief 模板

`task-runner` 向选定 subagent 委派执行时使用。发出前把占位符替换为已解析的任务细节。spec 是动态组装的：只给本 issue 相关的片段，禁止全量文档。

## 目标

<来自 Linear issue 的任务目标>

## Spec（动态组装）

- issue 描述：<目标 + AC-ids + 文档链接>
- 接口契约：<architecture.md 中与本 issue 相关的片段，只截相关部分>
- 验收条目：<acceptance.json 中对应 AC 条目，含 verification>

## 验收标准

- AC-...: <预期结果>

## 约束

- <范围边界>
- 不回退无关的用户改动
- subagent 不更新 Linear、不发起/更新/合并 PR
- 不创建新分支/新 worktree；改动提交前交回主 agent 校验

## 验证

- <命令 / 人工检查步骤>

## Workspace

- 路径: <本次调用使用的 worktree 绝对路径——顺序路径(b/c)是调用级共享 worktree；并发路径(a)是这个 issue 专属的一次性 worktree>
- 集成分支: `milestone/<req-id>-<n>`（standalone issue 无集成分支，基准是 main）

## 输出契约

- 改动文件
- 已尝试的验证及输出
- AC 覆盖情况
- 残余风险
- 交接备注
