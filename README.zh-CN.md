# VibeRig

VibeRig 是一个项目级 Codex 插件，用于把模糊需求转成可审查的需求文档、可执行的计划、Symphony 可调度的任务、隔离 worktree，以及验收后的经验沉淀。

项目地址：[JsonLee12138/vibeRig](https://github.com/JsonLee12138/vibeRig)

英文文档：[README.md](./README.md)

## 提供什么

- `brainstorm`：把需求整理成 `requirement.md`、`research.md`、`acceptance.md`、`roadmap.md` 和 `spec.md`。
- `write-plan`：把 brainstorm 结果继续整理成 `plan.md`、`tasks.yaml`、Linear 子任务草稿、worktree 策略和 Symphony 工作流输入。
- `init-viberig`：初始化目标项目，创建 `.vibeRig/`、工作流文件、本地 worktree 目录和默认运行配置。
- `insights`：在需求验收完成后记录保守的经验候选项。
- `vendor/symphony`：插件内置的 Symphony reference runtime，用于辅助脚本执行。

## 从 Marketplace 安装

本仓库包含 `.agents/plugins/marketplace.json`，所以可以作为 Codex marketplace 源被追踪：

```sh
codex plugin marketplace add JsonLee12138/vibeRig --ref main
codex plugin marketplace list
```

然后重启 Codex，打开插件目录，选择 `VibeRig` marketplace，并安装 `VibeRig` 插件。Codex 会把启用的插件安装到自己的插件缓存中，并不是直接从当前源码仓库执行。

## 只在某个 Codex 项目中安装

如果只想让 VibeRig 在某一个项目中可用，使用 repo-scoped marketplace。在目标项目中创建 `.agents/plugins/marketplace.json`：

```json
{
  "name": "viberig-project",
  "interface": {
    "displayName": "VibeRig Project"
  },
  "plugins": [
    {
      "name": "vibe-rig",
      "source": {
        "source": "url",
        "url": "https://github.com/JsonLee12138/vibeRig.git",
        "ref": "main"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

然后重启 Codex，打开插件目录，选择 `VibeRig Project` marketplace，并安装插件。插件技术名是 `vibe-rig`，展示名是 `VibeRig`。

如果你需要一个稳定的本地路径来直接运行辅助脚本，可以把插件放进目标仓库，再让 marketplace 指向这个本地目录：

```sh
mkdir -p .agents/plugins plugins
git submodule add https://github.com/JsonLee12138/vibeRig plugins/vibe-rig
git submodule update --init --recursive plugins/vibe-rig
```

这种方式使用下面的 local-source marketplace entry：

```json
{
  "name": "viberig-project",
  "interface": {
    "displayName": "VibeRig Project"
  },
  "plugins": [
    {
      "name": "vibe-rig",
      "source": {
        "source": "local",
        "path": "./plugins/vibe-rig"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

`source.path` 是相对仓库根目录解析的，不是相对 `.agents/plugins/` 目录。修改本地插件源码后，需要重启 Codex，让已安装的插件缓存重新加载新版本。

## 初始化目标项目

安装插件后，让 Codex 使用 `init-viberig` skill 初始化目标项目。

如果你是以 local-source 方式把 VibeRig 放在 `plugins/vibe-rig`，也可以在目标项目根目录直接执行：

```sh
python3 plugins/vibe-rig/scripts/init_project.py . \
  --project-name "<项目名>" \
  --test-command "npm test"
```

该命令会创建或确认以下结构：

```text
.vibeRig/
  config.yaml
  bin/
    symphony-setup
    symphony-planning
    symphony-implementation
  requirements/
  insights/
.codex/agents/
WORKFLOW.planning.md
WORKFLOW.implementation.md
worktrees/
.gitignore
```

默认 worktree 目录是 `./worktrees`。VibeRig 默认使用较少冲突的高位端口，并在启动 Symphony dashboard 前查找下一个空闲端口：

- planning dashboard 从 `49170` 开始
- implementation dashboard 从 `49180` 开始
- 业务预览端口约定从 `49200` 开始

## 设置 Symphony

Symphony 应该只存在于 VibeRig 插件中，不需要在每个业务项目里单独
vendor 或 submodule 一份。初始化项目时，VibeRig 会在 `.vibeRig/bin/`
下创建项目侧运行命令；这些命令会调用插件里的 Symphony runtime，并把当前业务项目作为运行目标。

如果使用推荐的 local-source 安装，VibeRig 期望插件位于 `plugins/vibe-rig/`，Symphony 位于 `plugins/vibe-rig/vendor/symphony`。由于该目录是 submodule，先确认递归 submodule 已初始化：

```sh
git submodule update --init --recursive plugins/vibe-rig
```

然后构建 Symphony runtime：

```sh
.vibeRig/bin/symphony-setup
```

如果希望项目初始化时就构建插件内置的 Symphony runtime，可以运行：

```sh
python3 plugins/vibe-rig/scripts/init_project.py . --setup-symphony
```

该脚本会进入 `vendor/symphony/elixir` 并使用 `mise`，所以本机需要先安装 `mise`。

如果只通过 Git-backed marketplace 安装，Codex 会从插件缓存运行 VibeRig。此时建议直接在 Codex 里使用插件 skills；如果你希望在 shell 里按固定路径运行辅助脚本，则使用 local-source 安装方式。

## 运行 Planning 和 Implementation

Symphony 需要 Linear API Key：

```sh
export LINEAR_API_KEY="<你的-linear-api-key>"
```

启动 planning workflow：

```sh
.vibeRig/bin/symphony-planning
```

启动 implementation workflow：

```sh
.vibeRig/bin/symphony-implementation
```

实际选中的 dashboard 端口会写入 `.vibeRig/runtime.json`。

## 推荐工作流

1. 让 Codex 使用 VibeRig brainstorm 处理一个需求。
2. 审查 `.vibeRig/requirements/<requirement-name>/` 下生成的需求文档。
3. 让 Codex 使用 VibeRig write-plan 为该需求生成执行计划。
4. 校验 `tasks.yaml`：

   ```sh
   python3 plugins/vibe-rig/scripts/validate_tasks.py \
     .vibeRig/requirements/<requirement-name>/tasks.yaml
   ```

5. 如有需要，渲染 Linear 子任务草稿：

   ```sh
   python3 plugins/vibe-rig/scripts/render_linear_children.py \
     .vibeRig/requirements/<requirement-name>/tasks.yaml
   ```

6. 运行 Symphony planning 或 implementation workflow。
7. 每个任务在自己的 branch 和 `./worktrees/<task>` 目录中实现、运行和验收。
8. 需求验收通过后，运行 VibeRig insights 记录经验候选项。

## 注意事项

- 保持 `brainstorm` 和 `write-plan` 分离。brainstorm 负责需求事实，write-plan 负责执行契约。
- 每个完成的任务分支建议先提交代码，再开始依赖它的后续任务。
- 实现前必须同步 worktree base。VibeRig 的任务契约默认基于 `origin/main`。
- 缺少专门 subagent 时，应该显式使用 `agent-creator` skill 创建，而不是把所有职责塞给一个通用 agent。
- `worktrees/`、`.vibeRig/runtime.json` 和 `.vibeRig/context-mode.md` 是本地运行产物，通常不要提交。
