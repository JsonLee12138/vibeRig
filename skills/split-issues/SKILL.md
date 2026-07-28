---
name: split-issues
description: 把已确认 Work Item 的里程碑拆成可验证垂直 Issue，先把全部近期详细/远期 indicative 草案写入 Linear 供人工确认，再按 Rolling Wave 激活。由 pre-development 内部调用；不指派人员或 subagent。
---

# Split Issues（Issue 规划）

人工确认前先让老板在 Linear 里看到完整工作范围。批准后保持 Rolling Wave：所有草案继续可见，但只有近期范围获得执行资格。

## 前置门禁

- `requirement.yaml` 有里程碑草案；
- `acceptance.json`、测试用例、架构与风险登记可用；
- 目标里程碑有 AC IDs 和清晰用户价值。

## 三个阶段

### 1. Local Draft

由 `pre-development` 调用：

1. 为所有里程碑在 `delivery-plan.md` 生成 Issue 草案；
2. 第一个里程碑拆到可执行粒度，后续里程碑保持可估算的规划粒度并标记 `indicative`；
3. 每项写目标、范围、AC IDs、测试用例 IDs、风险 IDs、契约引用、验证摘要、尺寸、依赖和完成证据；跨 Issue 的 E2E/回归 TC 只绑定 Milestone；
4. 依赖采用 `blocks` / `blockedBy` 语义；不选择实现人员或 subagent；
5. 与 Milestone 一起计算同一个 `plan_fingerprint`，不单独询问老板。

### 2. Publish Draft

在 Milestone Publish Draft 完成、人工计划确认之前执行：

1. 重新核对代码现状和草案漂移，保持在已确认需求基线内；
2. 请 `vb-linear` 按稳定本地 Issue id、Milestone 和 `plan_fingerprint` 查重，复用或更新已有草案；
3. 为所有 Milestone 创建或更新 Issue：近期项完整，远期项明确标记 `indicative`；
4. 创建 Issue、依赖与 `req:{requirement-id}` label；描述明确列出 AC-ID、TC-ID、风险和契约引用，但不粘贴文档全文；
5. 每个 Issue 带稳定 `VibeRig-Plan-Draft` 标记和同一 `plan_fingerprint`，不指派 assignee/subagent；
6. 请 `vb-linear` 解析团队状态：优先使用 Draft/Backlog；不存在时使用最早的非 started 状态并用描述/评论表达草案语义；禁止 In Progress/Done；
7. 将 `traceability.json` 中本地 `issueIds` 补充为 Linear key，更新 `linear.yaml`；
8. `requirement.status = awaiting_plan_confirmation`，向用户展示 Linear Project、Milestone 和 Issue 链接，只请求一次整体计划确认。

Linear 暂不可用时写入 outbox，并停在 `plan_draft_sync`。同步成功前不得把聊天摘要冒充 Linear 可视化确认。

### 3. Confirm And Activate

用户针对当前 Linear 草案明确决定：

- **批准**：写 plan approval event；更新 `planning.plan_approval` 与 fingerprint；只把第一个可执行 Milestone 的无阻塞 Issues 更新到 Ready/Todo 语义；
- **条件批准**：记录条件；不满足条件的 Issue 保持草案 Gate；
- **修订**：回到 Local Draft，复用稳定 id 更新原 Linear 对象；不得重复建单；
- **删除草案项**：优先标为 `superseded` 并保留审计轨迹；只有用户明确要求且 provider 支持安全删除时才删除。

后续 Milestone 到启动前重新细化并更新原草案；若改变已批准范围、验收或关键风险，生成新 fingerprint 并重新进入计划确认。

## Issue 标准

1. 通常可在 1–2 个专注工作日内完成；
2. 是端到端垂直切片，能单独提交且仓库保持可用；
3. 映射至少一个 AC 和对应测试用例；纯跨 Issue TC 映射到 Milestone，不强塞给单个 Issue；
4. 有明确输入/输出、依赖、风险与完成证据；
5. 优先 XS/S/M；XL 必须继续拆分。

Issue 中的 TC 只表达责任范围，不保存运行结果。`manual`、`owner_uat` 和跨 Issue `milestone` TC 写入里程碑待验收清单，不要求实现 Agent 标记通过。

| 尺寸 | 涉及文件 | 典型范围 |
|---|---:|---|
| XS | 1 | 单函数/单配置 |
| S | 1–2 | 一个小切片 |
| M | 3–5 | 一条完整功能路径 |
| L | 5–8 | 多组件切片，优先再拆 |
| XL | 8+ | 必须再拆 |

禁止纯脚手架、纯层次任务、Checkpoint、独立联调或独立 QA Issue。实现顺序可受 schema/API/UI 依赖约束，但 Issue 本身应尽量交付可验证的纵向结果。

## 红线

- 把草案 Issue 当作已批准任务，或在批准前进入执行态。
- 只写近期 Issue，导致人工确认时看不到后续 indicative 范围。
- Issue 没有 AC、测试用例或可执行验证。
- 把 subagent/assignee 选择固化在规划阶段；执行路由属于 `execute`。
- 为了技术分层创建无法独立验证的壳任务。
- 修订时重复创建 Issue，或让旧 fingerprint 的批准覆盖新计划。
- Linear 同步失败后仍请求用户确认“Linear 中的计划”。

## 完成检查

- [ ] Draft 覆盖所有里程碑，近期详细、远期可估算且标明置信度。
- [ ] 每项映射 AC、测试、风险、依赖和证据，无 XL/壳任务。
- [ ] `traceability.json` 可从 Outcome/AC/TC 定位到本地或 Linear Issue；跨 Issue 与老板验收 TC 留在 Milestone。
- [ ] 人工确认前全部草案已在 Linear 可见，且没有执行语义或 assignee。
- [ ] 用户批准绑定当前 fingerprint；近期 Issues 才进入 Ready/Todo。
- [ ] 计划修订复用原对象；被移除项有 superseded 审计轨迹。
- [ ] 计划漂移生成新 fingerprint 并重新确认。
- [ ] 人读内容使用 `output.language`。

## 下一步

需求基线和 Linear 计划草案均获确认，且近期 Issues 已激活后，更新 Goal Contract 并进入 `execute`。
