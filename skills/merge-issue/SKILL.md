---
name: merge-issue
description: 兼容旧的已验收 standalone Issue 合并调用。用户显式调用 merge-issue 或明确授权合并已验收 PR 时使用；将目标解析为 accept-deliver 的 delivery 模式，校验 acceptance、accepted commit、PR head、CI 和 provider 状态后幂等交付。
---

# Merge Issue Compatibility

1. 读取 acceptance event 和 immutable delivery target；
2. 设置 `accept-deliver.mode=delivery` 与 `targetMode=merged`；
3. 确认用户有明确 merge authority；
4. 进入 `accept-deliver` 的 Delivery Intent、动态 Gate 和幂等 merge；
5. provider 已合并时只证明并 reconcile，不重复调用 API。

没有人工验收、内容漂移、CI/审批不满足或 merge 未授权时停止。不要在本入口重跑实现、验收、复盘或知识编译。
