---
name: blocker-resume
description: 兼容旧的 VibeRig 阻塞恢复调用。用户要求恢复、继续、解除 blocker，或提供被阻塞的 Issue、PR、测试日志时使用；读取历史尝试和当前证据，恢复 execute Goal Loop。只有产品决策、权限、不可模拟真实环境或连续三次无进展才向用户请求输入。
---

# Blocker Resume Compatibility

恢复是 `execute` 的原生状态，不再是一条独立人工流程。

## 恢复

1. 读取 Work Item、Goal Contract、Linear 评论、本地文档、git、PR/CI、Evidence 和 attempt history；
2. 重新计算当前状态，不相信旧的“blocked”或“done”描述；
3. 将阻塞分类为实现、验证、测试环境、范围/契约、外部状态或 authority；
4. 可自行解决时进入 `execute` 的 `REPAIR`、`TEST_ENV_RESOLVE` 或 `REPLAN`；
5. 只有真实 Gate 才向用户提交一个收敛后的请求；
6. 解除后更新 Evidence 和外部状态。

相同失败第二次出现必须改变策略。连续三次没有新证据或状态进展才保持 blocked。

## 完成检查

- [ ] 已读取 prior attempts 和当前事实。
- [ ] 可模拟配置或可修复失败没有转交用户。
- [ ] 恢复后进入同一 Goal Loop。
- [ ] 真正 Gate 只请求最小必要输入。
