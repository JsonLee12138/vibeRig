---
name: intake
description: 记录一个新需求（访谈式）。当用户说"记录需求"、"新需求"、"intake"、或描述了一个想做的功能/想法时使用。不创建任何 Linear Milestone / Issue。
---

# Intake（记录需求）

用本 skill 把一个模糊的需求想法变成一份结构化的需求记录。这是最小必经链的第一步（intake → define-acceptance → split-milestones → split-issues）。

## 契约

- 只做需求访谈与记录，产出 `intake.md` + `requirement.yaml`，并同步叙事副本到 Linear Document。
- **禁止**在本 skill 内创建任何 Linear Milestone / Issue —— 结构化写入只发生在 `split-milestones` / `split-issues` / `record-issue` / `bugger` 中。
- 不做技术调研（走 `tech-research`）、不做架构设计（走 `architecture-design`）、不定验收标准（走 `define-acceptance`）。
- 需求过小（一句话能说清、单点改动）时，停止并引导用户走 `record-issue`。

## 访谈规则（先问清，后落文档）

以产品经理对接客户的方式**逐轮提问**，一次只问一个问题，附上你的最佳猜测，等用户回答后再问下一个。必须问清：

1. **目标用户**：这是给谁用的？
2. **痛点场景**：现在什么事做不了 / 做得很痛苦？
3. **期望结果**：做完后用户能做一件什么之前做不了的事？
4. **边界与非目标**：明确不做什么？
5. **约束**：时间、技术栈、兼容性等硬约束。

追问到你能预测用户对接下来三个问题的回答为止。用户给出"要可扩展""要现代化"这类套话时要追问："如果不用向任何人交代，你真正想要的是什么？"

**访谈结束才落文档。** 不把访谈过程、内部推理写进文件，只写收敛后的结论。

## 产出

读 `.vibeRig/project.yaml` 取 `docs.root` 与 `output.language`。需求 id 用**语义 slug**（从需求标题提炼），或采用用户指定的 id：

- 格式：全小写 ASCII kebab-case，2–5 个英文单词，如 `payment-refactor`、`offline-sync`；无空格、下划线或其他特殊字符（它会直接进入分支名和 worktree 路径）。
- 唯一性：扫描 `requirements/` 与 `requirements/archive/`（新旧格式目录都算，含历史 `req-NNNN`），撞名则追加 `-2`/`-3`。
- 稳定性：id 创建后**永不改名**——需求标题中途变了也不改 id，所有引用（分支、Linear、acceptance.json）都以它为键。

```text
.vibeRig/requirements/<req-id>/
  intake.md          # 访谈结论：目标用户 / 痛点 / 期望结果 / 非目标 / 约束 / 成功信号
  requirement.yaml   # 溯源文件（见下）
```

`requirement.yaml` 初始内容（风格同 `project.yaml`，schema 见本 skill 的 [assets/requirement.schema.json](./assets/requirement.schema.json)）：

```yaml
version: 1
requirement:
  id: "payment-refactor"
  title: "……"
  status: "intake"        # intake | planned | in_progress | accepted | archived
  prd: null               # 有关联 PRD 时填 prd-id（如 "checkout-revamp"）
  created: "YYYY-MM-DD"
milestones: []            # 由 split-milestones 回填
```

## Linear 操作

请 `vb-linear` 执行，遵守其能力映射与语言策略：

- 请 `vb-linear` 把 `intake.md` 的同步副本写为 Linear Document（挂容器 Project），供人评论评审。文档标题用 `output.language`。
- 把 documentId 记入 `<req-id>/linear.yaml`。
- **不建 issue、不建 milestone、不发评论。**

## 红线

- 没访谈完就写文件 → 回到提问环节；访谈是本 skill 的核心，不是装饰。
- 在本 skill 内创建了 Milestone / Issue → 违反探索阶段禁令，撤回并说明。
- 把访谈聊天记录原样倒进 `intake.md` → 只写收敛结论。
- 需求明显是 bug → 引导走 `bugger`；是单点小改动 → 引导走 `record-issue`。
- 编造用户没说过的需求事实来填空 → 停下来问那个最关键的阻塞问题。

## 检查清单

- [ ] 访谈覆盖：目标用户、痛点、期望结果、非目标、约束。
- [ ] `intake.md` 与 `requirement.yaml` 已写入，id 不与现有需求冲突。
- [ ] `requirement.yaml` 的 `prd` 字段已确认（有 PRD 填 id，没有填 null）。
- [ ] Linear Document 同步副本已创建，documentId 已记入 `linear.yaml`。
- [ ] 没有创建任何 Milestone / Issue。
- [ ] 人读内容使用 `output.language`。

## 下一步

告诉用户：验收标准未定义前无法拆分（DoR 门禁）。推荐路径：

- 技术不确定 → `tech-research`（可选，用户主动触发）；
- 跨模块 → `architecture-design`（必开）；
- 然后 `define-acceptance` → `split-milestones` → `split-issues`。

若本需求应归属某产品级 PRD 但尚未建立，应先走 `prd-brainstorm`，再回到 `intake` 并填写 `requirement.yaml` 的 `prd` 字段。
