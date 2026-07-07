# 在 Cursor 上安装 VibeRig

把本文件全文复制给 AI，让它帮你在 Cursor 上安装 VibeRig。

源码分支：[github.com/JsonLee12138/vibeRig/tree/cursor](https://github.com/JsonLee12138/vibeRig/tree/cursor)

## 前置条件

- Cursor 已启用 plugin support。参见 [Cursor Plugins 文档](https://cursor.com/docs/plugins)。
- 无需提前单独配置 Linear 账号。VibeRig 自带 Linear MCP server 配置（`mcp.json`）；在项目中运行 `vb-init` 时会先校验登录态，注册 Linear project 之前若发现未登录会当场触发 OAuth 授权。

## 安装

将 `cursor` 分支克隆到 Cursor 本地插件目录：

```sh
git clone https://github.com/JsonLee12138/vibeRig.git ~/.cursor/plugins/local/vibe-rig
```

克隆后重启 Cursor，以加载插件与 skills。

## 更新

```sh
cd ~/.cursor/plugins/local/vibe-rig
git pull origin cursor
```

更新后重启 Cursor。

## 验证

- 打开 Cursor Settings → Plugins，确认 `vibe-rig` 已列出。
- 在项目中尝试：`用 vb-init 初始化这个仓库`。
