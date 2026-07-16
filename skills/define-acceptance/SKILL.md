---
name: define-acceptance
description: 定验收标准（DoR 门禁）。当用户要定义验收标准、验收条件、AC，或准备拆分里程碑/issue 之前使用。本 skill 未完成前，split-milestones 与 split-issues 拒绝运行。
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

**会话交互类 AC**（验证依赖真实 agent-用户会话行为——如"agent 是否问了一次问题并按回答分支处理""task-runner 起手时是否引用了旧沉淀"——无法用命令或脚本复现）：`verification` 必须在定稿时就拆成两段分别写清楚，不要留到实现阶段才补：

1. `实现阶段可验证`：结构性/确定性的部分（如文档契约是否无歧义、环境 no-op 核对、底层工具的报错行为）；
2. `真实会话验证边界`：明确点名哪部分必须留给首次真实使用时人工核对。

这样每个下游 issue 的 proof packet 直接引用该 AC 自己的这两段文字即可，不需要每个 issue 各自重新解释一遍"实现阶段只能验证到这里"。

## AC 标准（五条，缺一不可）

每条候选 AC 必须同时满足：

1. **二元可判定**：结果只有过/不过，`expected` 出现"基本、正常、较快、大致"等程度词即打回重写；
2. **原子性**：一条 AC 只验一个行为——`action`/`expected` 里出现"和 / 、/ 与"连接两个关注点 → 拆成两条；
3. **可独立验证**：`verification` 不依赖其他 AC 先通过才能执行；
4. **量化**：涉及性能、数量、时限的写数字（如"P95 < 300ms""重试 3 次"），不写形容词；
5. **可追溯**：`source` 指到 intake.md / prd.md 的具体段落，不接受"用户口头说的"。

## 粒度信号

- 单需求 AC 超过 **~15 条** → 需求可能过大，提示用户回 `intake` 拆需求后再定验收。
- 某个目标/成功信号 **0 条** AC → 覆盖缺口，必须在最终报告中列为"未覆盖项"并说明原因。

## 流程

1. 读 `intake.md`（必需）、`prd.md`、`architecture.md`、`research/feasibility.md`（存在则读）。
2. 起草 AC 清单：覆盖每个目标与成功信号；负向用例（错误输入、越权、边界值）不可缺席。
3. 对每条候选 AC 逐条核对五条标准，不满足则改写或拆分；核对粒度信号（总数、目标覆盖）。
4. **逐条向用户展示并确认**：每条给出五要素 + 验证方式，用户可改可删可加；全部确认后才进入下一步。
5. 写入 `acceptance.json`，用本 skill 的 `assets/acceptance.schema.json` 校验；校验器不可用时明确报告"校验被跳过"及原因。
6. 报告：AC 总数、覆盖的目标、未覆盖项及原因。

## 红线

- 未经用户确认就写入 acceptance.json → 撤回，回到逐条确认。
- 某条 AC 的 `verification` 是抽象描述而非命令/步骤 → 改写到可照做为止。
- `expected` 含程度词（"基本正常""比较快"）→ 违反二元可判定，改写为可判定表述或量化指标。
- 一条 AC 里塞了两个行为 → 违反原子性，拆成两条再确认。
- 只有正向用例、没有负向用例 → 补齐错误路径与边界值。
- AC 总数超过 ~15 条仍继续定稿 → 先提示需求过大，与用户确认是否回 `intake` 拆分。
- 在需求目录里复制了 schema 文件 → schema 由本 skill `assets/` 统一提供，校验时引用。
- intake.md 缺失就起草 AC → 先走 `intake`，AC 必须有来源。

## 检查清单

- [ ] 每条 AC 八字段齐全，`verification` 可直接执行或可照做。
- [ ] 会话交互类 AC 的 `verification` 已拆成"实现阶段可验证"+"真实会话验证边界"两段。
- [ ] 每条 AC 满足五条标准（二元可判定 / 原子 / 可独立验证 / 量化 / 可追溯）。
- [ ] 粒度信号已核对：总数未超限（或已与用户确认），每个目标 ≥1 条 AC 或已列为未覆盖项。
- [ ] 含负向用例。
- [ ] 用户已逐条确认（记录确认轮次）。
- [ ] schema 校验通过，或明确报告跳过原因。
- [ ] 未写入任何 Linear 内容。
- [ ] 人读字符串值使用 `output.language`；JSON 字段名保持英文。

## 下一步

DoR 已满足 → `split-milestones`（跨模块需求先确认 `architecture.md` 存在）。
