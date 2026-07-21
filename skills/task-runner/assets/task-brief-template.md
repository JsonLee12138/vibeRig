# Task Brief 模板

`task-runner` 委派实现前填写。只注入当前 Issue 所需的最小充分上下文；所有尖括号字段都必须替换。

## Goal 与 Scope

- 目标：<Issue 的单一交付结果>
- 允许修改：<文件或模块边界>
- 禁止修改：<受保护范围>

## AC

- <AC-ID>：<精确业务预期与 verification 摘要>

## Test Cases

| TC | Level | Automation | Stage | Required | Preconditions / Steps / Expected |
|---|---|---|---|---|---|
| <TC-ID> | <level> | <automation> | <executionStage> | <true/false> | <只放本 Issue 相关内容> |

- `automation: required` 的新行为或 Bug 修复先返回 RED 证据。
- `milestone`、`owner_uat`、`post_release` 或 `manual` TC 只交接，不得伪造 PASS。
- 旧需求没有 `test-cases.json` 时标记 `legacy mode`，从相关 AC 推导窄范围验证。

## Architecture 与 Risk

- 接口/数据契约：<architecture.md 相关片段>
- 风险等级：<low / standard / high>
- 强制审核：<code / test / security / performance 或不适用理由>

## Workspace 与约束

- Workspace：<绝对路径>
- 集成分支：<里程碑分支；standalone 写无>
- 不回退无关改动；不创建分支/worktree；不碰 Linear 或 PR；提交前交回主 Agent。

## 输出契约

- 改动文件与范围说明；
- RED/GREEN 证据及实际命令；
- TC 覆盖、未执行项和原因；
- 残余风险与交接事项。
