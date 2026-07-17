---
name: record-issue
description: 记录小需求/小改动的快速入口，不走完整需求流水线。当用户提出一个单点改动、小功能、小优化，且明显撑不起一个里程碑时使用。与 bugger 是两个独立 skill：record-issue 面向"要加/要改的东西"，bugger 面向"坏了的东西"。
---

# Record Issue（记录小需求）

用本 skill 快速记录一个小需求/小改动为单个 Linear issue，跳过完整流水线（intake → … → split-issues）。

**与 `bugger` 的分界**：`record-issue` 处理"要加/要改的东西"（先评影响面）；`bugger` 处理"坏了的东西"（先归因分析）。两套流程互不复用——东西坏了就走 `bugger`。

## 契约

- 产出一个 Linear issue（挂当前活跃 Milestone 或容器 Project backlog）。
- 不创建 Milestone、不创建需求目录、不写 requirement.yaml。
- 影响面大时**必须停止**并引导升级为完整需求流程。

## 流程

### 1. 影响面分析

建单前先分析并向用户报告：

- **涉及模块**：改动会碰哪些模块/文件？
- **是否触碰现有 AC**：会不会改变某个已验收/在途需求的验收标准语义？
- **是否影响在途 issue**：其他里程碑正在做的 issue 会不会被这个改动波及？

### 2. 归属判定

| 情况 | 处理 |
|---|---|
| 与当前活跃里程碑同模块、不破坏其 AC | 挂该 Milestone |
| 与任何在途里程碑无关的小改动 | 挂容器 Project 的 backlog（不挂 Milestone） |
| **影响面大**：跨模块 / 需要新 AC / 会改变现有 AC 语义 | **停止建单**，引导走完整流程（`intake` 起步） |

### 3. 建单

请 `vb-linear` 执行，遵守其规则：

- 先请 `vb-linear` 查重已有 issue；
- 请 `vb-linear` 创建 issue：标题用 `output.language`；描述含**影响面分析结论 + 验证方式**（具体命令或可照做的人工步骤，禁止"改完验证一下"这类抽象话）；
- 不指派、不选 subagent（执行时由 `task-runner` 路由）。

## 红线

- 跳过影响面分析直接建单 → 影响面分析是本 skill 存在的理由。
- 影响面大却继续建单 → 停止，引导 `intake`；小需求入口不是绕过 DoR 的后门。
- 记录的其实是 bug → 转 `bugger`，两套流程不混用。
- 建了 Milestone 或需求目录 → 小需求不建结构，撑得起结构就该走完整流程。
- 描述里没有验证方式 → 不可验证的 issue 不建。

## 检查清单

- [ ] 影响面分析三项（模块 / 现有 AC / 在途 issue）已完成并写入描述。
- [ ] 归属判定正确（Milestone / backlog / 升级完整流程）。
- [ ] 查重后创建；描述含验证方式。
- [ ] 未指派、未选 subagent；未建 Milestone。
- [ ] 人读内容使用 `output.language`。
