---
name: quick
description: 兼容旧的小任务实现调用。用户显式调用 quick 或旧流程在方向确认后要求快速修复时使用；将已确认范围转发到 execute 的 L0/L1 Goal Loop，持续修改和验证到目标状态。需求未确认时先进入 intake。新工作优先直接使用自然语言或 execute。
---

# Quick Compatibility

`quick` 不再拥有独立实现、提交、审核或验收协议。

1. 查找已确认 Work Item；没有则进入 `intake`；
2. 默认风险为 L0/L1，但遇到公共契约、权限、数据迁移、支付、不可逆操作或大范围影响时升级；
3. 将用户目标映射到 `verified`、`committed` 或 `pr_ready`；
4. 进入 `execute`，使用同一 Goal Loop、Test Environment Broker 和 Completion Oracle；
5. 技术完成后进入 `accept-deliver`，不要求调用 `accept-issue`。

兼容旧的“原地改动”请求时仍要检查当前工作区和无关用户改动。分支/worktree 由项目策略、并发风险和交付目标决定，不由 `quick` 名称决定。

## 完成检查

- [ ] 已转入统一 Goal Contract。
- [ ] 没有固定启动 Code/Security/Test 三路审核。
- [ ] 缺少测试配置时自动解析环境。
- [ ] 未在内部阶段边界打断用户。
