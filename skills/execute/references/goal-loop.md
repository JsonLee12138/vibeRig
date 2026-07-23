# Goal Loop

## 目录

1. 状态机
2. 下一步选择
3. 进展守卫
4. Completion Oracle
5. 恢复

## 状态机

```text
CAPTURE → UNDERSTAND → FRAME → PLAN → IMPLEMENT → VERIFY → REVIEW → DELIVER → DONE
                                      ↑          │        │
                                      └─ REPAIR ─┴────────┘
VERIFY → TEST_ENV_RESOLVE → VERIFY
任意状态 → AUTHORITY_GATE → 原状态
```

`CAPTURE`、`FRAME` 通常由 `intake` 完成。`execute` 必须验证基线是否仍与代码和用户目标一致，但不得无故重新访谈。

## 下一步选择

每轮选择能最大化以下比值的下一步：

```text
预期信息增益或目标进展 / Token、时间、外部副作用与认知成本
```

优先：

1. 能证伪当前假设的最小检查；
2. 能产生 RED/GREEN 证据的最小切片；
3. 能解除多个后续不确定性的契约或环境检查；
4. 局部、可逆、可回滚的实现；
5. 只在独立性或专业性真正增加信息时调用 Subagent。

## 进展守卫

一次迭代只有出现以下至少一项才算进展：

- 新事实或新证据；
- 失败范围缩小；
- 假设被证实或证伪；
- 代码或测试产生与目标相关的有效变化；
- Completion Oracle 的未满足条件减少；
- 一个外部 Gate 被解除。

第一次失败允许同策略定向修正。相同失败第二次出现必须改变策略。连续三次无进展时进入 `BLOCKED`，不得继续消耗预算。

## Completion Oracle

按 `targetMode` 检查：

| Mode | 必需条件 |
|---|---|
| `diagnosed` | 因果事实或带置信度的假设、影响、验证方法、建议 |
| `recorded` | 已确认完整 Work Item 已写入目标记录 |
| `planned` | 范围、方案、AC/TC、风险、依赖和步骤可执行 |
| `verified` | diff 在 scope 内，Required Evidence 有效，无 blocking finding |
| `committed` | `verified` 且 Evidence 绑定完整 commit |
| `pr_ready` | `committed` 且 PR/CI/head commit 对齐 |
| `merged` | 人工验收通过、明确授权、provider merge 证据有效 |
| `released` | `merged`、明确发布授权、发布与回滚/Smoke 证据有效 |

## 恢复

恢复时先读取 Work Item、Goal Contract、attempt history、git 状态、Evidence、PR/CI 和外部记录。重新计算当前状态，不相信旧的自然语言“已完成”声明。

幂等规则：

- 已存在且绑定相同 commit 的有效证据直接复用；
- 已成功的外部写入通过稳定 id 认领，不重复创建；
- PR 已合并时只验证 provider 状态，不再次调用 merge；
- 记录系统暂不可用时保留 outbox，不回滚本地有效进展；
- 范围或 commit 漂移时只失效受影响证据。
