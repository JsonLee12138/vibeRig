# 在 Claude Code 上安装 VibeRig

把本文件全文复制给 AI，让它帮你在 Claude Code 上安装 VibeRig。

参考文档：

- [通过 marketplace 发现并安装插件](https://code.claude.com/docs/en/discover-plugins)
- [配置团队 marketplace](https://code.claude.com/docs/en/discover-plugins#configure-team-marketplaces)
- [创建与安装插件](https://code.claude.com/docs/en/plugins)

## 前置条件

- 已安装并更新 Claude Code（`claude --version`）。
- 无需提前单独配置 Linear 账号。VibeRig 在 `.mcp.json` 中自带 Linear MCP 配置；在项目中运行 `vb-init` 时会先校验登录态，注册 Linear project 之前若发现未登录会当场触发 OAuth 授权。

## 安装（交互式）

在 Claude Code 内执行：

```shell
/plugin marketplace add JsonLee12138/vibeRig
/plugin install vibe-rig@viberig
```

Marketplace 名称：`viberig`（来自 `.claude-plugin/marketplace.json`）。插件名称：`vibe-rig`。

按提示选择安装范围（user / project / local）。

## 安装（CLI）

```shell
claude plugin marketplace add JsonLee12138/vibeRig
claude plugin install vibe-rig@viberig
```

加 `--scope project` 可将插件写入 `.claude/settings.json`，供协作者使用。

## 团队 marketplace（可选）

在仓库的 `.claude/settings.json` 中预注册 marketplace：

```json
{
  "extraKnownMarketplaces": {
    "viberig": {
      "source": {
        "source": "github",
        "repo": "JsonLee12138/vibeRig"
      }
    }
  }
}
```

团队成员仍需执行 `claude plugin install vibe-rig@viberig`（或 `/plugin install`）后插件才会加载。

## 更新

```shell
/plugin marketplace update viberig
```

或命令行：

```shell
claude plugin marketplace update viberig
```

必要时重新安装：

```shell
claude plugin install vibe-rig@viberig
```

更新后重启 Claude Code。

## 验证

- 运行 `/plugin` → Installed 标签页 → 确认 `vibe-rig` 已启用。
- 尝试：`/vibe-rig:vb-init`，或让 Claude 在项目中使用 `vb-init` skill。
