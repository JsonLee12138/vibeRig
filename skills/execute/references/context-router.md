# Context Router

上下文按当前增量、修改路径、风险和能力加载，不按完整需求目录一次性灌入。

## 路由顺序

1. 读取根 `AGENTS.md` 与 `.vibeRig/project.yaml`。
2. 从 `.vibeRig/context-routes.yaml` 选择所有命中的 route。
3. 对将修改的每个路径读取最近的目录级 `AGENTS.md`。
4. 加载 Work Item、当前 AC/TC、相关契约、ADR 和必要 Runbook。
5. 合并 route 的 `verify` 与 `reviewers`，去重后写入 Task Context。

`nearest:AGENTS.md`、`active:requirement`、`related:contract`、`related:runbook` 是解析指令，不是固定文件名。找不到可选文档时记录缺口；只有缺口改变产品语义、授权或权威验证时才暂停。

## 单一真相源

- `documents.mode=discover` 时优先使用项目已有 PRD、spec、ADR、Runbook 和任务系统；`.vibeRig` 只保存引用与执行状态。
- 不复制完整权威文档到 Requirement 目录。
- 一个事实只能有一个 owner；VibeRig 产物记录 owner 路径和失效条件。
- Subagent 只收到当前 Brief 命中的最小上下文，不接收完整 Intake、全部研究报告或其他 Issue 的 TC。

## 完成检查

- 实际修改路径均被某个 route 或明确 fallback 覆盖。
- Task Context 记录已读 owner、验证命令和 Reviewer 来源。
- 没有建立平行计划、平行验收标准或平行 Runbook。
