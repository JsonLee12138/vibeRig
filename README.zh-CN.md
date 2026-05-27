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
    viberig
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

默认 worktree 目录是 `./worktrees`。VibeRig 还会确保全局本地面板可用，固定地址是：

```text
http://127.0.0.1:49160
```

项目初始化会在需要时启动全局 VibeRig daemon，在支持的 macOS 环境中安装登录自启动 LaunchAgent，并把当前项目注册到全局面板。Symphony runner 端口属于内部细节；用户日常只需要通过 VibeRig 面板操作，不需要管理 runner 命令或端口。

## 设置 Symphony

Symphony 应该只存在于 VibeRig 插件中，不需要在每个业务项目里单独
vendor 或 submodule 一份。全局 VibeRig daemon 会在面板触发 planning 或 implementation 时，为对应项目启动独立的 Symphony runner。

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

使用全局 VibeRig 面板：

```text
http://127.0.0.1:49160
```

在面板中选择项目并启动 planning 或 implementation。`.vibeRig/bin/symphony-planning` 和 `.vibeRig/bin/symphony-implementation` 这类直接命令只保留为调试 fallback，不是日常用户入口。

如果全局 daemon 是登录自启动的，shell 里临时 export 的环境变量不会自动进入 runner 进程。`LINEAR_API_KEY` 这类 runner secret 应放到 `~/.viberig/secrets.env`，或者等面板提供配置入口后从面板配置。

## 全局状态

VibeRig 会把本机服务状态放在项目仓库之外：

```text
~/.viberig/
  projects.json
  secrets.env
  runtime/
    daemon.json
    runners/
  logs/
```

`runtime/runners/` 是 daemon 管理项目级 Symphony runner 进程的运行账本，记录 pid、workflow、project id、日志路径和状态。它不存放业务代码；真正的实现和验收仍然发生在各项目自己的 `worktrees/` 目录下。

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
