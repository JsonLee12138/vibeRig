---
name: accept-issue
description: 兼容旧的单 Issue 验收调用。用户显式调用 accept-issue 或要求验收 standalone、高风险或抽样 Issue 时使用；将目标解析为 accept-deliver 的 work_item 模式，执行 Evidence 审计与人工 UAT。新工作优先直接使用自然语言或 accept-deliver。
---

# Accept Issue Compatibility

1. 精确读取 Issue、Work Item、accepted source、Evidence、CI 和 PR；
2. 设置 `accept-deliver.mode=work_item`；
3. 进入 `accept-deliver` 的 Evidence 审计与人工验收；
4. 失败项返回同一 `execute` Goal Loop；
5. merge 只有在独立明确授权后执行。

不要重复定义验收事件、知识编译或 merge 协议。
