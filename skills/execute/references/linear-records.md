# Linear execution records

Linear 是执行过程的可见投影，本地 Work Item、Goal Contract 与 Evidence Packet 仍是工程权威来源。记录使用 `.vibeRig/project.yaml` 的 `output.language`，保留所有稳定技术标识符。

## Execution started

- 目标与 `targetMode`
- scope / non-goals
- Work Item、plan fingerprint、AC/TC 与契约路径
- workspace、branch、base commit
- 计划运行的验证与当前风险
- `<!-- VibeRig-Event: <event-id> -->`
- `<!-- VibeRig-Record: phase:<event-id> -->`

## Phase update

- phase：`review_started`、`repair_started` 或 `acceptance_rejected`
- 触发该阶段的具体证据
- 影响的 AC/TC、文件或组件
- 下一步与仍存在的 Gate
- 稳定 event marker 与 payload fingerprint

没有阶段变化或新增证据时不写新记录。返修后再次进入 Review 是新事件，使用新的稳定 event id，并引用前一条 finding。

## Technically ready Proof Packet

- workspace、branch、base 与完整 commit；未提交时明确写 `uncommitted workspace` 和 diff identity
- 变更文件与行为摘要
- 验证命令、结果、时间、环境及 fidelity
- AC/TC 覆盖与 Evidence Packet 路径
- Review findings 及关闭证据
- CI、PR 与当前 commit 的对齐情况
- 残余风险、未覆盖差异与人工验收步骤
- PR 链接；不适用时写原因
- `<!-- VibeRig-Event: <event-id> -->`
- `<!-- VibeRig-Record: phase:<event-id> -->`

Proof Packet 与 `technically_ready` 状态是两个独立投影。分别持久化 intent、调用 Linear、read-back 与 ack。若写入结果丢失，先在固定 host 搜索 typed marker 并核对 fingerprint；找到唯一匹配则 adopt，多个或冲突匹配 fail closed。
