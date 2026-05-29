# VibeRig

VibeRig 是一个 Codex 插件，用于把模糊需求转成可审查的需求文档、本地可执行任务、隔离 worktree，以及验收后的经验沉淀。

项目地址：[JsonLee12138/vibeRig](https://github.com/JsonLee12138/vibeRig)

英文文档：[README.md](./README.md)

## 提供什么

- `brainstorm`：把需求整理成 `requirement.md`、`research.md`、`acceptance.md`、`roadmap.md` 和 `spec.md`。
- `write-plan`：把 brainstorm 结果继续整理成 `plan.md`、`tasks.yaml`、可选 Linear 子任务草稿、worktree 策略、验证命令和 subagent 分工。
- `init-viberig`：初始化目标项目，创建 `.vibeRig/`、本地 worktree 目录、全局面板注册和默认运行配置。
- `insights`：在需求验收完成后记录保守的经验候选项。
- `api/server.py`：运行本地 VibeRig 后端和面板，默认地址是 `http://127.0.0.1:49160`。

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
git submodule update --init plugins/vibe-rig
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
  requirements/
  insights/
.codex/agents/
worktrees/
.gitignore
```

默认 worktree 目录是 `./worktrees`。VibeRig 还会确保全局本地面板可用，固定地址是：

```text
http://127.0.0.1:49160
```

项目初始化会在需要时启动全局 VibeRig daemon，在支持的 macOS 环境中安装登录自启动 LaunchAgent，并把当前项目注册到全局面板。

## 运行 Planning 和 Implementation

使用全局 VibeRig 面板：

```text
http://127.0.0.1:49160
```

在面板中选择项目、导入需求任务、查看任务看板、运行 ready 状态的本地任务流程，并记录验证证据和验收结果。

## 全局状态

VibeRig 会把本机服务状态放在项目仓库之外：

```text
~/.viberig/
  projects.json
  runtime/
    daemon.json
  logs/
  runs/
  exports/
```

业务代码和实现验收仍然发生在各项目自己的 `worktrees/` 目录下。

## 推荐工作流

1. 让 Codex 使用 VibeRig brainstorm 处理一个需求。
2. 审查 `.vibeRig/requirements/<requirement-name>/` 下生成的需求文档。
3. 让 Codex 使用 VibeRig write-plan 为该需求生成执行计划。
4. 校验 `tasks.yaml`：

   ```sh
   python3 plugins/vibe-rig/scripts/validate_tasks.py \
     .vibeRig/requirements/<requirement-name>/tasks.yaml
   ```

5. 把需求导入 VibeRig 面板并检查任务看板。
6. 每个任务在自己的 branch 和 `./worktrees/<task>` 目录中实现、运行和验收。
7. 记录验证证据、验收评审和代码审查。
8. 需求验收通过后，运行 VibeRig insights 记录经验候选项。

## 注意事项

- 保持 `brainstorm` 和 `write-plan` 分离。brainstorm 负责需求事实，write-plan 负责执行契约。
- 每个完成的任务分支建议先提交代码，再开始依赖它的后续任务。
- 实现前必须同步 worktree base。VibeRig 的任务契约默认基于 `origin/main`。
- 缺少专门 subagent 时，应该显式使用 `agent-creator` skill 创建，而不是把所有职责塞给一个通用 agent。
- `worktrees/`、`.vibeRig/runtime.json` 和 `.vibeRig/context-mode.md` 是本地运行产物，通常不要提交。
