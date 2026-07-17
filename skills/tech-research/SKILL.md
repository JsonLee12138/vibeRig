---
name: tech-research
description: 技术调研（用户主动触发，非必经）。当用户在 intake 或 PRD 之后要求做技术调研、可行性分析、技术选型、spike 时使用。不在其他 skill 中自动连带调用。
---

# Tech Research（技术调研）

用本 skill 对一个需求或 PRD 做技术可行性调研。**只由用户主动触发**，不是必经环节——不要在其他 skill 里自动连带调用。

## 契约

- 产出 `research/feasibility.md`（结论 + 风险清单）与 `research/spike-<topic>.md`（限时 spike 记录）。
- 不写架构定稿（走 `architecture-design`）、不定验收标准、不建任何 Linear Milestone / Issue。
- 调研范围绑定一个需求（`requirements/<req-id>/research/`）；针对 PRD 级的调研，选 PRD 下最相关的需求目录存放并在文中注明覆盖面。

## 流程

1. **专业调研（主 agent 或 researcher subagent）**：
   - 盘点现有代码：相关模块、已有能力、技术债；
   - 外部资料：库/框架/API 的成熟度、许可证、社区活跃度；
   - 输出调研素材包（事实、来源链接、置信度分层：事实 / 推断 / 假设）。
2. **按领域拆分，多 subagent 并发讨论**：
   - 按调研发现的领域切分（如：存储、鉴权、前端集成、性能）；
   - 每个 subagent 基于调研素材包独立展开该领域的技术讨论：候选方案、权衡、风险、验证手段；
   - subagent 只返回分析结论，**不写文件、不碰 Linear**。
3. **汇总定稿（主 agent）**：
   - 合并各领域结论为一份技术方案 + 可行性结论；
   - 冲突的结论要么裁决（写明理由），要么列为开放问题；
   - 需要动手验证的点做限时 spike，记录到 `spike-<topic>.md`（目标 / 时间盒 / 结果 / 结论）。
4. 落文件 + 同步 Linear Document。

## 产出

```text
.vibeRig/requirements/<req-id>/research/
  feasibility.md      # 可行性结论 + 方案对比 + 风险清单 + 开放问题
  spike-<topic>.md    # 每个 spike 一个文件：目标 / 时间盒 / 做了什么 / 结论
```

`feasibility.md` 必须区分：**事实**（有来源）、**推断**（从事实推出）、**假设**（未验证），并给风险清单（风险 / 影响 / 缓解手段）。

## Linear 操作

- 请 `vb-linear` 把可行性结论同步副本写为 Linear Document；documentId 记入 `linear.yaml`。
- **不建 issue、不建 milestone。**

## 红线

- 未做第 1 步调研就直接开 subagent 讨论 → 讨论必须基于调研素材，凭空讨论产出的是幻觉。
- subagent 写了文件或碰了 Linear → 只有主 agent 落盘和写 Linear。
- spike 无时间盒、无结论就结束 → spike 必须有明确结论（可行 / 不可行 / 需要更多信息）。
- 把调研结论直接当架构定稿 → 定稿走 `architecture-design`。

## 检查清单

- [ ] 现有代码盘点与外部资料调研均已完成并留有来源。
- [ ] 领域拆分合理，各 subagent 基于同一份调研素材包并发讨论。
- [ ] `feasibility.md` 区分事实/推断/假设，含风险清单。
- [ ] 每个 spike 有时间盒和明确结论。
- [ ] Linear Document 同步副本已创建；未建任何 Milestone / Issue。
- [ ] 人读内容使用 `output.language`。
