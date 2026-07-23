---
name: record-issue
description: 兼容旧的“小需求/小改动记录”调用。用户显式调用 record-issue，或旧提示要求快速建单时使用；将输入归一化到 intake 的统一 Work Item，确认完整问题、原因或限制、方案、影响、范围、验收和测试策略后再记录。新工作优先直接使用自然语言或 intake。
---

# Record Issue Compatibility

这是兼容入口，不再维护独立的小改动流程。

## 转发

1. 读取用户描述、仓库、现有需求和 Issue；
2. 将 `origin` 推断为 `limitation`、`opportunity`、`maintenance` 或 `risk`，不与 Bug 流程分叉；
3. 设置默认 `targetMode=recorded`；
4. 进入 `intake` 完成脑暴与人工基线确认；
5. 确认后一次性写入完整 Work Item，并按用户目标决定是否继续 `execute`。

如果用户实际要求实现，将 `targetMode` 提升为 `verified`、`committed` 或 `pr_ready`，确认后自动进入 `execute`，不要要求再次调用 `task-runner`。

## 约束

- 不直接创建信息不完整的 Issue；
- 不因“看起来很小”跳过影响、scope、验收或测试策略；
- 不要求用户判断它是不是 Bug；
- 不创建独立流程状态；
- Linear 不可用时保留本地权威 Work Item。

## 完成检查

- [ ] 已进入 `intake` 统一契约。
- [ ] 用户确认前没有写外部记录。
- [ ] Issue 含完整 Work Item，而不是只有标题与验证一句话。
- [ ] 需要实现时已连续进入 `execute`。
