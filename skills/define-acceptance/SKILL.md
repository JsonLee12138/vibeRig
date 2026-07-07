---
name: define-acceptance
description: 定验收标准（DoR 门禁）。当用户要定义验收标准、验收条件、AC，或准备拆分里程碑/issue 之前使用。起草每条 AC（五要素 + 验证方式），先向用户逐条展示确认，确认通过后才写入 acceptance.json 并做 schema 校验。本 skill 未完成前，split-milestones 与 split-issues 拒绝运行。
---

# Define Acceptance（定验收标准）

用本 skill 为一个需求定稿机器可校验的验收标准。这是 **DoR（Definition of Ready）门禁**：没有 `acceptance.json`，不允许拆分里程碑与 issue。

## 契约

- 产出 `requirements/<req-id>/acceptance.json`，schema 用本 skill 的 [assets/acceptance.schema.json](./assets/acceptance.schema.json) 校验（不在需求目录里复制 schema）。
- **先与用户逐条确认，确认通过后才写入**——未确认不落盘。
- 不建任何 Linear Milestone / Issue；不做架构设计。

## AC 条目结构

每条 AC 必须包含：

| 字段 | 含义 |
|---|---|
| `id` | 稳定 id，`AC-1`、`AC-2`… 顺序编号 |
| `source` | 来源引用：intake.md / prd.md 的段落 |
| `precondition` | 前置条件：系统处于什么状态 |
| `action` | 动作：做什么操作 |
| `expected` | 预期：应该看到什么结果 |
| `evidence` | 证据形式：命令输出 / 截图 / 日志 / 页面表现 |
| `verification` | 验证方式：**具体命令**或**逐步人工操作**（原 validation.md 职责并入此字段） |
| `milestone` | 归属里程碑 id，拆分前为 null，由 `split-milestones` 回填 |

`verification` 写法要求：自动化的写出可直接执行的命令；人工的写成可照做的步骤（第一步做什么、打开哪个页面、应该看到什么）。**禁止**写"功能正常""验证通过"这类抽象话。

## 流程

1. 读 `intake.md`（必需）、`prd.md`、`architecture.md`、`research/feasibility.md`（存在则读）。
2. 起草 AC 清单：覆盖每个目标与成功信号；负向用例（错误输入、越权、边界值）不可缺席。
3. **逐条向用户展示并确认**：每条给出五要素 + 验证方式，用户可改可删可加；全部确认后才进入下一步。
4. 写入 `acceptance.json`，用本 skill 的 `assets/acceptance.schema.json` 校验；校验器不可用时明确报告"校验被跳过"及原因。
5. 报告：AC 总数、覆盖的目标、未覆盖项及原因。

## 红线

- 未经用户确认就写入 acceptance.json → 撤回，回到逐条确认。
- 某条 AC 的 `verification` 是抽象描述而非命令/步骤 → 改写到可照做为止。
- 只有正向用例、没有负向用例 → 补齐错误路径与边界值。
- 在需求目录里复制了 schema 文件 → schema 由本 skill `assets/` 统一提供，校验时引用。
- intake.md 缺失就起草 AC → 先走 `intake`，AC 必须有来源。

## 检查清单

- [ ] 每条 AC 八字段齐全，`verification` 可直接执行或可照做。
- [ ] 含负向用例。
- [ ] 用户已逐条确认（记录确认轮次）。
- [ ] schema 校验通过，或明确报告跳过原因。
- [ ] 未写入任何 Linear 内容。
- [ ] 人读字符串值使用 `output.language`；JSON 字段名保持英文。

## 下一步

DoR 已满足 → `split-milestones`（跨模块需求先确认 `architecture.md` 存在）。
