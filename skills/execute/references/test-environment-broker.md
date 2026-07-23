# Test Environment Broker

## 目录

1. 决策原则
2. 环境阶梯
3. 依赖策略
4. Evidence 保真度
5. Gate

## 决策原则

缺少 `.env.test`、测试账号、外部服务或本地依赖时，不要立即询问用户。先识别 TC 真正需要证明的语义，再选择最低成本且充分保真的环境。

Mock 不是默认答案。推荐关系：

```text
现有 fixture
→ deterministic fake
→ protocol stub / emulator
→ ephemeral real dependency
→ provider sandbox
→ 明确授权的 real environment
```

根据语义跳级。例如数据库迁移直接使用 ephemeral real database，不用 repository mock。

## 环境阶梯

1. 复用项目已有测试配置、fixture 和 harness；
2. 为纯计算或简单边界注入 deterministic fake；
3. 为 HTTP、Webhook、邮件等协议使用本地 stub 或 capture sink；
4. 为数据库、队列、缓存、锁和并发语义启动 disposable dependency；
5. 为供应商专有协议使用官方 sandbox 或 emulator；
6. 只有 TC 明确要求真实集成时进入人工 Gate。

自动生成的 Secret 必须语法有效、无真实权限，并确保不会连接生产系统。

## 依赖策略

| 依赖 | 默认方案 | 升级条件 |
|---|---|---|
| Token / Secret | 无权限假值 | 签名或真实授权语义 |
| HTTP API | stub：成功、错误、超时、限流、畸形响应 | 供应商兼容性 |
| 邮件/短信/Webhook | capture sink | 真实送达 UAT |
| 支付 | provider sandbox | 明确授权的真实小额 UAT |
| 数据库 | ephemeral real DB + migration | 目标环境特有行为 |
| Queue / Cache | disposable service；简单语义可 fake | 顺序、TTL、重投递、并发关键 |
| 时间/随机/UUID | deterministic provider | 无需升级 |
| 文件系统 | 临时目录 | 平台权限或文件锁关键 |
| 浏览器 API | 组件 test double | 用户旅程用真实浏览器 |
| Auth / JWKS | local issuer + JWKS | IdP sandbox/UAT |

## Evidence 保真度

每条结果标记 `mock`、`fake`、`stub`、`ephemeral`、`sandbox` 或 `real`，并记录：

- 环境或 fixture 版本；
- 覆盖的语义；
- 与真实环境的差异；
- 对应 commit；
- 是否满足 TC 的最低保真度。

要求 `sandbox` 或 `real` 的 TC 不能被 mock pass 满足。

## Gate

先完成全部可模拟工作，再仅为以下事项请求人：

- 必须由真实身份、真实租户或真实设备完成的 UAT；
- 无 sandbox 的供应商权威行为；
- 会产生费用、通知、生产写入或不可逆副作用；
- 用户必须提供且无法安全生成的访问授权。

请求时说明为何较低保真度不足，以及已经完成的自动化证据。
