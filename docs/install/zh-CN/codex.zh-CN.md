# 在 Codex 上安装 VibeRig

把本文件全文复制给 AI，让它帮你在 Codex 上安装 VibeRig。

## 前置条件

- Codex 已启用 plugin support。
- 无需提前单独配置 Linear 账号。VibeRig 自带 Linear MCP server 配置（`.mcp.json`），指向 `https://mcp.linear.app/mcp`；在项目中运行 `vb-init` 时会先校验登录态，注册 Linear project 之前若发现未登录会当场触发 OAuth 授权。

## 安装

```sh
codex plugin marketplace add JsonLee12138/codex-marketplace --ref main
codex plugin add vibe-rig@jsonlee
```

选择器格式为 `PLUGIN@MARKETPLACE`。本仓库中 marketplace 是 `jsonlee`，plugin 是 `vibe-rig`。

## 更新

```sh
codex plugin marketplace upgrade jsonlee
```

若已安装插件未自动刷新：

```sh
codex plugin remove vibe-rig
codex plugin add vibe-rig@jsonlee
```

更新后重启 Codex。

## 验证

- 运行 `codex plugin list`，确认 `vibe-rig@jsonlee` 已安装。
- 在项目中尝试：`用 vb-init 初始化这个仓库`。
