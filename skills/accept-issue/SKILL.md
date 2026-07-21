---
name: accept-issue
description: 对 standalone、高风险或用户明确抽查的单个 Issue 做证据审核与人工验收。当用户说“验收这个 issue”“抽查这个 issue”或明确给出单点验收结论时使用；普通里程碑 Issue 默认等待 accept-milestone 统一验收。
---

# Accept Issue（单 Issue 验收）

## 契约

- 只由用户手动触发，不从 `task-runner` / `agent-sop` 自动调用。
- 适用于 standalone、高风险或显式抽查；普通里程碑 Issue 的技术证据可直接由 `accept-milestone` 汇总，不强制逐个验收。
- 只审核当前 Issue 及 sub-issue，不操作 PR、不合并、不碰 main、不清理 worktree。
- 测试、CI 和 Proof Packet 不能替代用户验收结论；若用户只要求“开始验收”，先执行检查，再请求明确结论。

## 证据复用

先读 `acceptance.json`、`test-cases.json`、`traceability.json`、Proof Packet、PR 当前 commit 和 CI：

- commit、要求环境、测试定义一致的成功自动化证据直接复用，不重跑；
- 新 commit、合入最新 main、相关代码/测试/Fixture/依赖变化或环境不满足时，只重跑受影响 TC/Gate；
- `manual`、`owner_uat` 与尚未真实执行的步骤不能从自动化结果推断 PASS；
- 旧需求没有 TC 时进入 `legacy mode`，按相关 AC 的 `verification` 做窄范围验证。

## 验收评论

评论必须让人可以复现：在哪个文件配置什么、运行什么、打开哪个入口、按什么顺序操作、实际看到哪些精确数据/页面状态、失败信号是什么。不得只写“功能正常”或“验证通过”。

## 流程

1. 读 `.vibeRig/project.yaml`，解析 Issue、归属、全部 sub-issue、评论、Proof Packet 和 PR 当前 commit。
2. 定位相关 AC/TC；若是普通里程碑 Issue，说明单点验收是可选抽查，但用户已经明确要求时继续。
3. 审核 Evidence：逐 TC 判断 `PASS`、`FAIL`、`SKIP`、`BLOCKED` 及有效性；核对当前 commit 的 Required CI 与必需 Review。
4. 只补做缺失、失效或本层人工 TC。属于 `milestone` / `post_release` 的 TC 留给对应阶段；Required TC 失败或阻塞时停止。
5. 按相关 `ownerVerification` / `verification` 展开人工步骤，记录真实结果；向用户汇报证据和残余风险。
6. 用户已在当前对话明确批准时进入通过分支；否则等待用户给出通过、拒绝或条件性结论。
7. **通过**：
   - 确认 commit 与已审 Evidence 一致；
   - 请 `vb-linear` 写验收评论，并把 Issue 与全部 sub-issue 更新到团队最接近 Done 的状态；
   - standalone 告知下一步 `merge-issue`；挂里程碑的 Issue 告知最终合并仍由 `accept-milestone` 完成；
   - 依次触发 `insights` 写复盘评论，再触发 `vb-learn <issue-key>`。
8. **发现问题**：请 `vb-linear` 创建关联 AC-ID/TC-ID、失败证据和修复验证方式的 `type:acceptance-fix` Issue；挂同一 Milestone，原 Issue 保持非终态，修复继续走 `task-runner`。

## 红线

- 相同 commit 的有效 CI/自动化证据被无条件重跑。
- 从 Proof Packet 或测试通过推断用户已经验收。
- 人工、里程碑或发布 TC 未真实执行却标 PASS。
- 在本 skill 发起、更新或合并 PR。
- 普通里程碑 Issue 被描述为必须逐个人工验收。
- 只更新主 Issue，遗漏 sub-issue。

## 完成检查

- [ ] Evidence 对应当前 commit、要求环境和测试定义；复用与重跑都有理由。
- [ ] Required TC、CI 与 Review 无失败；后续阶段 TC 已明确交接。
- [ ] 用户当前明确给出验收结论；评论包含可复现步骤和真实结果。
- [ ] 状态覆盖 Issue 与全部 sub-issue，未操作 PR/main/worktree。
- [ ] 通过后完成 insights 与 vb-learn；失败时建立可追踪的修复 Issue。
- [ ] 人读内容使用 `output.language`。
