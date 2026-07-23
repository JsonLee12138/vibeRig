# Acceptance 与 Delivery 状态契约

## 目录

1. Acceptance Event
2. Delivery Intent
3. Delivery Event
4. 幂等与恢复

## Acceptance Event

Acceptance Event 至少绑定：

- Work Item / Issue / Milestone；
- confirmed requirement fingerprint；
- accepted source commit；
- Evidence Packet id 或内容摘要；
- 用户结论、时间和条件；
- 未覆盖项与残余风险；
- 不可变 delivery target。

同一来源和结论重试时认领已有 event，不创建第二条验收记录。source commit 漂移时旧验收失效。

## Delivery Intent

任何 merge/release API 前先持久化 Intent：

- acceptance event；
- provider、repository、PR 或 release target；
- expected base/head；
- merge/release method；
- 用户授权记录；
- 幂等 id。

Intent 写入后重新检查动态 Gate。目标漂移或用户撤销授权时停止。

## Delivery Event

Delivery Event 记录：

- Intent；
- provider immutable result；
- merge commit 或 release version；
- remote reachability / deployment status；
- Smoke 与回滚证据；
- reconciliation 状态。

不得用目标分支当前 HEAD 冒充 provider merge commit。

## 幂等与恢复

- zero match：写 pending event；
- one structurally complete match：认领并继续；
- multiple、malformed 或 identity conflict：fail closed；
- provider 已完成：观察并证明，不重复调用 API；
- knowledge/reconciliation 失败：单独恢复，不回滚验收；
- implementation 漂移：返回 `execute`，只重验受影响 Evidence。
