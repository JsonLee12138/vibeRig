# Proof Packet 评论模板

用 `.vibeRig/project.yaml` `output.language` 渲染。尖括号字段必须替换；不适用项写清理由。自动化证据必须绑定当前 commit，人工或更高阶段 TC 不得伪造 PASS。

```markdown
## Proof Packet

**Issue**: <issue-key> — <目标>
**Workspace**: `<路径>`
**Path**: <a 并发集成 | b 顺序集成 | c standalone>
**Branch / Commit / PR**: `<分支>` / `<完整 commit>` / <PR 链接>
**Evidence mode**: <test-cases-v2 | legacy-ac>

## Scope

- `<文件>` — <改动>

## TC Coverage

| TC | Result | Commit | Environment | Executor | Command / Evidence | Time |
|---|---|---|---|---|---|---|
| <TC-ID> | <PASS/FAIL/SKIP/BLOCKED> | <commit> | <local/ci/staging/...> | <main-agent/CI/human> | <命令与证据> | <ISO 8601> |

- Required 未覆盖：<TC-ID 与原因；没有则写无>
- 延迟到 Milestone/UAT/Post-release：<TC-ID 与执行阶段>

## Gates 与 Reviews

- `<gate/CI job>` → <PASS/FAIL/BLOCKED> — <当前 commit 的证据>
- Code Review：<APPROVE/REQUEST CHANGES/不适用理由>
- Test/Security/Performance Review：<结论或未触发理由>

## AC Coverage

- 已覆盖：<AC-ID>
- 未覆盖：<AC-ID 与原因>

## Residual Risk

- <风险、SKIP/BLOCKED、人工待办；没有则写无>
```

证据仅在 commit、要求的环境和测试定义未变化时可复用；合入最新 main、相关依赖/Fixture/测试变化或执行环境不满足时必须重跑受影响项。
