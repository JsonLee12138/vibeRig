# VibeRig

VibeRig 是一个面向 Linear-native 软件交付的 Codex 插件。它把模糊需求整理成本地 Docs as Code 契约，把已确认的计划映射到 Linear issues，通过合适的 Codex subagents 执行任务，并把证据、验收结果和经验沉淀写回 Linear。

英文文档：[README.md](./README.md)

## 目录

1. [安装](#安装)
2. [更新](#更新)
3. [人工使用方法](#人工使用方法)
4. [内置 skills 和 subagents](#内置-skills-和-subagents)
5. [运行流程](#运行流程)

## 安装

添加 VibeRig marketplace，并安装插件：

```sh
codex plugin marketplace add JsonLee12138/vibeRig --ref main
codex plugin add vibe-rig@viberig
```

当前 Codex CLI selector 格式是 `PLUGIN@MARKETPLACE`。本仓库中 marketplace 是 `viberig`，plugin 是 `vibe-rig`。

当你需要 VibeRig 创建或更新 Linear project、document、issue、comment 时，需要同时启用并登录 Linear 插件。

## 更新

刷新 marketplace snapshot：

```sh
codex plugin marketplace upgrade viberig
```

如果当前 Codex 安装不会自动刷新已安装插件缓存，可以重新安装插件：

```sh
codex plugin remove vibe-rig
codex plugin add vibe-rig@viberig
```

更新后重启 Codex，让新的 skills 生效。

## 人工使用方法

在目标项目中，直接让 Codex 使用对应的 VibeRig skill。

常用提示词：

- `Use init-viberig for this repo.`
- `Use brainstorm for this requirement: ...`
- `Use write-plan for .vibeRig/requirements/<requirement-id>.`
- `Use task-runner for Linear issue ABC-123.`
- `Use human-acceptance: all ACs are accepted for ABC-123.`
- `Use insights for the accepted Linear work.`

VibeRig 会创建或使用这些项目本地文件：

```text
.vibeRig/
  project.yaml
  requirements/
.worktrees/
  <issue-key>-<short-slug>/
```

Linear 是任务和状态界面。本地 requirement docs 是契约，不是 issues。

## 内置 Skills 和 Subagents

Skills：

- `init-viberig`：初始化 `.vibeRig/project.yaml`、`.vibeRig/requirements/`、`.worktrees/`、Linear 项目注册、门禁策略、PR 策略和默认路由。
- `brainstorm`：把粗略想法整理成本地 Docs as Code 需求契约。
- `write-plan`：根据本地验收标准创建或更新 Linear issues 和 sub-issues。
- `task-runner`：在当前 Codex 会话中执行 Linear task，委派合适 subagent，完成验证，提交 PR，并写入 Linear Proof Packet。
- `human-acceptance`：记录用户显式给出的人工验收通过或拒绝；全量验收时合并 PR、清理任务 worktree、更新 Linear 最终状态，并触发 insights。
- `insights`：从已验收工作中生成保守的经验候选项。
- `subagent-routing`：选择并 brief 专用 subagent，同时保证 context-mode 和 Linear 更新只在主 agent 中发生。
- `agent-creator`：帮助创建或更新项目本地 Codex custom subagents。
- `agent-sop`：编排分阶段实现、验证、QA 和基于证据的 rework。
- `blocker-resume`：检查被阻塞的 Linear work，并决定恢复执行或请求缺失决策。

内置 subagent prompt entries：

- `Agent Creator`
- `Agent SOP`
- `Brainstorm`
- `Subagent Routing`
- `Task Runner`

具体的实现、QA、review、调研或集成 subagent 是项目或用户自己的 agents。VibeRig 通过 `subagent-routing` 路由到它们；subagents 不应使用 context-mode、不应更新 Linear、不应做最终验收判断。

## 运行流程

1. 使用 `init-viberig` 初始化项目。
2. 使用 `brainstorm` 发现和结构化需求；审查 `.vibeRig/requirements/<requirement-id>/` 下生成的本地文件。
3. 使用 `write-plan` 把已确认的计划转成 Linear issues。
4. 使用 `task-runner` 执行 Linear issue；VibeRig 默认在项目内 `.worktrees/<issue-key>-<short-slug>/` worktree 中执行，验证结果，提交或更新 PR，把 Proof Packet 写到 Linear，并让 issue 进入人工验收或 review 状态。
5. 人工 review 后，显式调用 `human-acceptance`。全量验收会合并 PR，在安全时移除任务 worktree，更新 Linear 最终状态，并运行验收后 insights。
6. 只有在用户明确确认后，才应用 insights 提出的 skill 或 workflow 更新。
