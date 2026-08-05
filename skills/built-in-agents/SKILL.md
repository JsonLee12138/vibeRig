---
name: built-in-agents
description: Install or reconcile the VibeRig baseline agent team across Codex, Claude Code, and Cursor from provider-neutral JSON specs. Use from `vb-init`, when baseline agents are missing or outdated, or when the user asks to restore/reconcile bundled agents. Project-specific roles belong to `update-team`.
---

# Built-in Agents

以 [`agents.manifest.json`](./agents.manifest.json) 为权威能力目录，将 `assets/<agent>.json` 通过 [agent-creator](../agent-creator/SKILL.md) 渲染到：

- Codex：`.codex/agents/<name>.toml`
- Claude Code：`.claude/agents/<name>.md`
- Cursor：`.cursor/agents/<name>.md`

JSON spec 是唯一角色定义；manifest 的 `platformModelDefaults` 是 provider-specific 部署默认值。禁止手写平台文件。`coreAgents` 是每个项目都物化的最小团队，`conditionalAgents` 仅在 `update-team` 提供正向项目证据后物化；`agents` 是完整兼容目录，不代表 init 时全部创建。项目特有角色交给 `update-team`。

Codex 不依赖父会话猜测模型：渲染时把 `platformModelDefaults.codex[name]` 作为 `agent-creator` 的 `platform_model_overrides.codex`。Claude Code/Cursor 没有各自显式策略时继续使用 spec 的 `model: inherit`，禁止复用 Codex slug。

## 角色模型

| 阶段 | Agents | 边界 |
|---|---|---|
| 开发前证据 | `researcher` | 查证事实，不做最终技术裁决 |
| 开发前领域 | `frontend_architect`、`backend_architect`、`data_architect`、`security_auditor`、`reliability_engineer`、`qa`、`uiux_design` | 输出领域报告，不写正式需求/架构，不碰 Linear |
| 架构对抗 | `architecture_red_team` | 只攻击一个指定 focus；不修复、不审批 |
| 开发执行 | `implementation`、`test_engineer`、`backend_e2e_engineer` | 普通实现/测试与真实后端 E2E 分开；不写 Proof Packet、不验收 |
| 开发审核 | `code_review`、`security_auditor`、`qa` | 独立只读审核，按风险路由 |
| 集成交付 | `integrator` | 审核依赖、契约和证据，不合并、不发布 |

CTO、产品经理、白队和 Final QA 不创建为基线 Agent：CTO/产品经理由主 Agent 和 Skills 承担；白队复用原领域负责人；主 Agent直接综合证据，不增加重复 Final QA。

## 输入

- `--core`：处理 manifest 的七个 `coreAgents`；`vb-init` 首次安装必须使用此选择。
- `--only <agent,...>`：只处理指定 manifest Agent；conditional Agent 必须由 `update-team` 的 team profile 选中。
- `--platforms <codex,claude,cursor>`：默认三个平台。
- `--force <agent,...>`：明确覆盖指定 Agent 的现有平台文件。
- `--prune <agent,...>`：仅在用户明确确认后删除 manifest `deprecated` 中的已渲染旧 Agent。

## 安装与升级

1. 读取 manifest，确认 `coreAgents` 与 `conditionalAgents[].name` 的并集等于 `agents[]`，每个 Agent 都有 `assets/<name>.json`，spec 的 `name` 与文件名一致；`platformModelDefaults.codex` 必须精确覆盖全部 `agents[]`，无缺失和孤立项。
2. 未传 `--only` 时只选择 `coreAgents`，不得把完整 `agents[]` 当作默认安装集合。conditional Agent 需要 `.vibeRig/team-profile.yaml` 中同名激活项及非空 evidence；否则标记 `not-selected`。
3. 读取或创建 `.vibeRig/built-in-agents-lock.json`。每个 `(agent, platform)` 记录：
   - `specHash`：源 JSON 的 SHA-256；
   - `renderPolicyHash`：该平台模型 override 与渲染协议的 SHA-256；
   - `renderedHash`：上次写入平台文件后的 SHA-256；
   - `manifestVersion`。
4. 对每个目标组合分类：

| 状态 | 行为 |
|---|---|
| 目标不存在 | 用 JSON spec 经 `agent-creator` 渲染并写入 lock |
| spec、render policy 与 lock 相同，目标 hash 与 lock 相同 | 跳过，标记 `current` |
| spec 或 render policy 已变化，目标仍等于 lock 的 renderedHash | 这是未定制旧基线；重新渲染并更新 lock |
| 目标与 lock 的 renderedHash 不同 | 视为用户定制；不覆盖，标记 `customized` |
| 无 lock 但目标已存在 | 视为 legacy/ownership unknown；默认不覆盖，除非 `--force` |
| 指定 `--force` | 重新渲染指定目标并更新 lock；报告覆盖动作 |

lock 只记录管理元数据，不包含 prompt 内容。哈希必须基于实际文件字节计算，不能由 Agent 猜测。

所有 spec 的 `mcp_servers` 当前必须为空。共享 MCP 配置由项目负责；未经用户确认，不修改 `.cursor/mcp.json`。

## 废弃 Agent

manifest `deprecated` 只用于识别和迁移提示：

- 默认报告已存在的旧 Agent，不自动删除。
- 用户明确传 `--prune` 后，只删除精确指定 Agent 的三个平台文件和对应 lock 条目。
- `self_learner` 的替代流程是显式验收后保留 Evidence，并仅在 novelty、重复缺陷、Milestone 或批量阈值命中时执行 `insights → vb-wiki`；merge 状态只作来源元数据，只有用户另行明确授权时才进入 `vb-learn`。
- 不删除 manifest 未登记的项目 Agent。

## 输出

按 Agent、平台报告：`created`、`updated`、`current`、`customized`、`legacy-skipped`、`pruned`、`failed`。同时报告 spec/manifest 校验、lock 路径、废弃 Agent 和待人工处理项。

## 验证

```bash
jq -e '.version and (.agents | type == "array") and (.deprecated | type == "array")' \
  skills/built-in-agents/agents.manifest.json

for name in $(jq -r '.agents[]' skills/built-in-agents/agents.manifest.json); do
  test -f "skills/built-in-agents/assets/$name.json" || exit 1
  test "$(jq -r .name "skills/built-in-agents/assets/$name.json")" = "$name" || exit 1
done

# Resolve <viberig-root> from this SKILL.md, then validate the target project files.
node <viberig-root>/scripts/validate-rendered-agent-models.mjs \
  --root . --agents <selected-agent-csv> --platforms codex,claude,cursor
```

- [ ] manifest 与 spec 一一对应，无孤立基线 spec。
- [ ] `coreAgents` 恰好七个；core 与 conditional 并集等于完整 `agents` 目录。
- [ ] Codex model policy 精确覆盖全部 Agent：Luna=research/implementation/ordinary tests，Terra=review/QA/integration/domain，Sol=backend E2E/security/red-team。
- [ ] Codex 原生文件包含固定 `model`；Claude Code/Cursor 未被 Codex slug 污染。
- [ ] 全新项目未物化没有正向 evidence 的 conditional Agent。
- [ ] 每个目标平台文件均由对应 JSON spec 渲染。
- [ ] 未定制旧基线可升级；用户定制文件不被静默覆盖。
- [ ] lock hash 对应实际 spec 和平台文件。
- [ ] 废弃 Agent 未经明确 `--prune` 不删除。
- [ ] 未修改共享 MCP 配置、项目特有 Agent 或 `project.yaml`。
