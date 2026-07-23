---
name: accept-milestone
description: 兼容旧的 Milestone 验收调用。用户显式调用 accept-milestone 或要求验收一个里程碑时使用；将聚合范围解析为 accept-deliver 的 milestone 模式，复用有效 Issue Evidence，只补里程碑回归、E2E 与人工 UAT。新工作优先直接使用自然语言或 accept-deliver。
---

# Accept Milestone Compatibility

1. 解析 Milestone、关联 Work Item、Issue、集成分支和 standing PR；
2. 设置 `accept-deliver.mode=milestone`；
3. 聚合仍有效的 Issue Evidence，只运行失效或里程碑层 Gate；
4. 进入 `accept-deliver` 的人工 UAT；
5. 失败项返回 `execute`；通过后等待独立 merge/release authority。

不要为每个普通 Issue 重复完整验收，不要在本入口维护第二套 acceptance/delivery 状态机。
