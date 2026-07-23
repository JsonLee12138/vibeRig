---
name: define-acceptance
description: 把统一 Work Item 与架构转成可判定验收标准、工程验证方式和用户可执行 UAT 指南。通常由 intake 在需求确认前建立基础 oracle，或由 pre-development 在确认后补充技术细节；不新增独立人工阶段。
---

# Define Acceptance（验收设计）

产出机器可校验的 `acceptance.json` 和业务验收人可执行的 `acceptance-guide.md`。基础业务 AC 在 `intake` 的需求基线中一次确认，不逐条确认。

## 契约

- 必须读取 confirmed `work-item.json` 与 `intake.md`；存在 PRD、领域报告、`architecture.md`、测试计划时一并读取。
- 新产物使用 schema `version: 2`，并通过 [assets/acceptance.schema.json](./assets/acceptance.schema.json) 校验；schema 继续兼容旧版 `version: 1` 产物。
- 使用 [assets/acceptance-guide-template.md](./assets/acceptance-guide-template.md) 生成老板验证流程。
- 保留 `verification` 字符串，供 `execute`、`accept-deliver` 与旧兼容入口消费。
- 不创建 Milestone / Issue，不实现测试，不单独同步 Linear。

## 每条 AC

基础字段：稳定 `id`、来源、前置、原子动作、精确预期、证据、兼容验证摘要、里程碑。

新增两类验证：

- `ownerVerification`：老板的目标、环境/入口/角色、配置准备、顺序步骤、数据标准、可视化标准、失败信号、证据、清理；
- `engineeringVerification`：自动化命令、检查项、测试层级和残余未覆盖风险。

`verification` 是以上内容的简明可执行摘要，不得与结构化内容矛盾。

## 质量标准

1. **二元可判定**：不用“基本、正常、较快”等程度词；
2. **原子**：一条只验证一个行为；
3. **可独立验证**：不依赖其他 AC 先通过；
4. **量化**：数量、时间、性能、容错写具体阈值；
5. **可追溯**：来源定位到 Intake / PRD 章节；
6. **可操作**：老板和工程验证都能照做；
7. **可观测**：明确数据、页面/图表状态和失败信号；
8. **有负向覆盖**：错误输入、越权、边界、恢复路径不可缺席。

会话交互类 AC 的工程验证必须拆成“实现阶段可验证”和“真实会话验证边界”，并将后者写入残余风险/人工步骤。

## 流程

1. 从每个目标、规则、成功指标和关键风险提取候选 AC。
2. 补齐正向、负向、权限、边界和恢复场景。
3. 按八项标准改写/拆分；超过约 15 条时反馈需求可能过大，由 `pre-development` 决定拆需求或说明理由。
4. 为每条 AC 写工程验证与老板验证，确保步骤、数据、可视化、失败信号闭环。
5. 生成并校验 `acceptance.json`，再生成 `acceptance-guide.md`。
6. 将 AC 交给测试用例、Goal Contract 与追踪表；业务语义变化时返回 `intake`，纯技术补充直接交给 `execute`。

## 红线

- 在内部模式中逐条要求用户确认，或把技术验证细节变成新的产品 Gate。
- `verification` 只有“功能正常”“验证通过”等抽象描述。
- 老板步骤没有前置配置、进入路径、精确预期、失败信号或证据。
- 只验证后台数据，不描述用户可见状态；或只看页面，不验证关键数据。
- 只有正向用例，或目标/成功指标没有任何 AC 覆盖。
- 为绕过 schema 在需求目录复制另一份 schema。

## 完成检查

- [ ] 每条 AC 基础字段与两类验证齐全，兼容 `verification` 可执行。
- [ ] 数据标准、可视化标准、失败信号、证据与清理已明确。
- [ ] 所有目标有覆盖或有显式不覆盖理由，包含负向用例。
- [ ] `acceptance.json` schema 校验通过。
- [ ] `acceptance-guide.md` 可由非开发者按顺序执行。
- [ ] 未创建 Linear 内容，等待完整开发前审批。
