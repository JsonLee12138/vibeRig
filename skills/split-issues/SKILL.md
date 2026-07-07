---
name: split-issues
description: Issues 拆分（Rolling Wave，按里程碑滚动执行）。当用户要把某个里程碑拆成 issue、或 split-milestones 完成后进入执行准备时使用。只拆下一个待做里程碑，每个 issue 必须满足大厂三条标准（1~2 个专注工作日 / 可独立验证 / 可单独 commit），用 save_issue 创建并挂到 Milestone。只建单：不指派、不选 subagent——subagent 路由是 task-runner 执行时的职责。
---

# Split Issues（Issues 拆分）

用本 skill 把**一个**里程碑拆成垂直切片 issue。

## Rolling Wave 规则

- **只拆下一个待做的里程碑**（`requirement.yaml` 中最靠前的 `not_started` 里程碑，或用户指定的那一个）。
- 后续里程碑到启动前再拆——提前拆的计划会腐烂。
- 用户要求一次拆多个里程碑时，说明 Rolling Wave 理由；用户坚持则照做并留痕。

## 前置门禁

- `requirement.yaml` 的 `milestones` 列表非空（`split-milestones` 已完成）。
- `acceptance.json` 存在，目标里程碑有自己的 AC-ids。

## Issue 标准（大厂三条，缺一不可）

1. **1~2 个专注工作日内可完成**；
2. **能独立验证**：映射 ≥1 个 AC-id，且有明确验证命令（取自对应 AC 的 `verification`）；
3. **能单独 commit**：提交粒度独立，不依赖未完成的兄弟 issue 才能编译/通过测试。

尺寸沿用现行 sizing 表，S/M 优先：

| 尺寸 | 涉及文件 | 范围 |
|---|---|---|
| XS | 1 | 单函数/单配置 |
| S | 1–2 | 一个端点或组件 |
| M | 3–5 | 一个功能切片 |
| L | 5–8 | 多组件功能——考虑再拆 |
| XL | 8+ | **过大，必须再拆** |

再拆信号：标题里有"和 / 、/ 与"连接两个关注点；AC 超过 3 条；横跨两个独立子系统。

**无壳任务硬规则**：禁止创建纯脚手架、纯 UI 骨架、"集成/联调/QA/Checkpoint"类 issue——不能独立产出验证证据的不是合法 issue，把它的工作并入相关功能切片。**垂直切片优先**：每个 issue 交付一条完整的用户可验证路径，而不是"先全部 DB、再全部 API、再全部 UI"。

## 流程

1. 读 `requirement.yaml`、`acceptance.json`、`architecture.md`（存在时）、`linear.yaml`、`project.yaml`。
2. 确定目标里程碑（Rolling Wave 规则）。
3. 依据 `architecture.md` 的依赖关系排出实现顺序（自底向上：schema → 模型 → API → 前端），但切片方式保持垂直。
4. 起草 issue 清单：每个 issue 含目标、映射 AC-ids、验证命令、尺寸、依赖（blocks/blockedBy）。逐条核对三条标准。
5. 向用户展示清单，确认后写 Linear。
6. Linear 写入（用共享 `linear` skill 的规则）：
   - 先 `list_issues` 查重（按 Milestone 过滤）；
   - `save_issue` 创建，挂对应 Milestone；`blocks`/`blockedBy` 表达切片依赖；打 `req:<req-id>` label；
   - 描述含：目标、本地文档路径引用（不粘贴全文）、AC-ids、验证命令；
   - **只建单：不指派 assignee、不写推荐 subagent** —— subagent 路由在 `task-runner` 执行时现场进行。
7. 更新 `linear.yaml`（issueKeys）；写一条计划同步评论（issue 清单 + AC 覆盖 + 依赖顺序）。

## 红线

- 一次拆了多个里程碑（用户未坚持要求）→ 违反 Rolling Wave。
- issue 描述里写了推荐 subagent 或直接指派 → 执行时路由是 task-runner 的职责，建单时选定的到执行时往往已不是最优。
- 某个 issue 不映射任何 AC-id → 不可验证的 issue 不建。
- 创建了 Checkpoint / QA / 集成类 issue → agent-sop 每任务自带 QA；集成工作说明切片不垂直。
- 未查重就建单 → 先 `list_issues`。
- Sub-issue 超过一层 → 层级封顶：Issue → Sub-issue（≤1 层）。

## 检查清单

- [ ] 只拆了一个里程碑。
- [ ] 每个 issue 满足三条标准，映射 ≥1 个 AC-id 且有验证命令。
- [ ] 无壳任务、无 QA/集成/Checkpoint 类 issue、无 XL。
- [ ] 依赖用 blocks/blockedBy 表达；查重后创建。
- [ ] 未指派、未选 subagent。
- [ ] `linear.yaml` 已更新；计划同步评论已写。
- [ ] 人读内容使用 `output.language`。

## 下一步

`task-runner <里程碑id 或 issue-id>` 执行；里程碑内全部 issue 完成后走 `accept-milestone`。
