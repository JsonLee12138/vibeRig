---
name: architecture-design
description: 架构/接口设计。跨模块需求必开——它的模块图直接决定里程碑怎么切。当用户要做架构设计、模块划分、接口契约、数据流设计时使用。先脑暴模块边界与契约，再由多个 subagent 并发做对抗性校验（红队挑刺），修订定稿为 architecture.md（含 mermaid 模块依赖图）。不同步 Linear。
---

# Architecture Design（架构/接口设计）

用本 skill 为一个需求定稿模块边界、接口契约与数据流。**跨模块需求必开**：`split-milestones` 依据本 skill 产出的模块依赖图切里程碑。

## 契约

- 产出 `requirements/<req-id>/architecture.md`（含 mermaid 模块依赖图 + 接口契约 + 数据流）。
- **不同步 Linear**——代码级契约留仓库；需要人评审时走 PR。
- 不建任何 Linear Milestone / Issue；不定验收标准。
- 有 `research/feasibility.md` 时必须先读，架构决策要与调研结论一致或写明偏离理由。

## 流程

1. **脑暴（主 agent，与用户对齐）**：
   - 模块边界：切几个模块、各自职责、明确不属于谁的东西；
   - 接口契约：模块间的调用签名 / 数据格式 / 错误语义；
   - 数据流：数据从哪来、经过谁、落到哪；状态在哪保存。
2. **对抗性校验（多 subagent 并发，红队挑刺）**：
   - 给每个 subagent 唯一使命："只找问题，不做肯定"。分头攻击：
     - 边界不清：哪个职责两个模块都能管、或没人管；
     - 契约缺口：哪个接口缺错误语义 / 缺版本策略 / 参数含糊；
     - 数据流断点：哪条数据链路断了、哪个状态没有唯一属主；
     - 失败模式：超时、重试、部分失败、并发冲突时会发生什么。
   - subagent 只返回发现，**不写文件、不碰 Linear**。
3. **修订定稿（主 agent）**：
   - 采纳的发现改进设计；驳回的发现在文末"评审记录"里写明驳回理由；
   - 定稿写入 `architecture.md`。

## architecture.md 结构

```markdown
# <需求标题> 架构设计
## 模块依赖图        # mermaid flowchart / classDiagram，split-milestones 按此切里程碑
## 模块职责           # 每模块：职责 / 非职责
## 接口契约           # 模块间接口：签名、数据格式、错误语义
## 数据流             # mermaid sequenceDiagram / flowchart
## 失败模式与对策
## 评审记录           # 对抗性校验：采纳项 / 驳回项及理由
```

## 红线

- 跳过对抗性校验直接定稿 → 校验是强制的；看似显然的架构最容易藏坑。
- 校验发现被静默丢弃 → 采纳或写明理由驳回，二选一，全部留痕在"评审记录"。
- 模块依赖图缺失或不是 mermaid → `split-milestones` 无法据此切里程碑，必须补。
- 把 architecture.md 同步到了 Linear Document → 本 skill 不同步 Linear。
- 与 `feasibility.md` 结论矛盾却未写偏离理由 → 补理由或回到调研。

## 检查清单

- [ ] 模块边界、接口契约、数据流三部分齐全。
- [ ] mermaid 模块依赖图存在且与"模块职责"一致。
- [ ] 多 subagent 对抗性校验已执行，评审记录含采纳/驳回及理由。
- [ ] 每个接口有错误语义；每个状态有唯一属主。
- [ ] 未写入任何 Linear 内容。
- [ ] 人读内容使用 `output.language`。

## 下一步

`define-acceptance`（DoR 门禁）→ `split-milestones`（按本文件的模块依赖图切）。
