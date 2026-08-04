# Verification Graph

`verification-graph.json` 是 Outcome、AC、TC、权威执行阶段和 Evidence 的统一机器契约，通过 `../assets/verification-graph.schema.json` 校验。

## 图关系

```text
Outcome -> AC -> TC -> authoritative stage -> Evidence
```

每个 TC 必须声明：

- 测试类型；
- 唯一权威执行阶段；
- 最低保真度；
- 命令或人工 procedure；
- 需要保留的 artifact；
- 会使 Evidence 失效的路径、契约、fixture 或环境条件。

Schema 对 TC 强制上述字段，并要求 `command` 或人工 `procedure` 二选一。API/UI E2E 还必须引用 [E2E Test Contract](./e2e-test-contract.md) 的锁定 revision；契约 revision、测试路径或 Oracle 改变会使旧 RED/PASS Evidence 失效。

Issue 阶段运行定向 unit、contract、integration 和可独立局部 E2E。跨 Issue 用户旅程属于 milestone；owner UAT 和 post-release smoke 不由实现 Agent伪造 PASS。

自动 E2E 与人工 UAT 不是两套需求：两者消费同一 AC，并在图中承担不同 TC。证据仍有效时复用；命中 `invalidatedBy`、commit 漂移、fixture/测试定义或环境要求变化时只重跑受影响节点。

Completion Oracle 只读取 required 图节点，不以“测试跑过一次”或 Subagent 完成声明代替图闭合。
