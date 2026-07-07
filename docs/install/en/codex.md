# Install VibeRig on Codex

Copy this entire file to your AI assistant and ask it to install VibeRig for Codex.

## Prerequisites

- Codex with plugin support enabled.
- No separate Linear account setup is needed ahead of time. VibeRig ships its own Linear MCP server config (`.mcp.json`) pointing at `https://mcp.linear.app/mcp`; running `vb-init` in a project checks login status before registering a Linear project and triggers the OAuth flow on the spot if you aren't logged in yet.

## Install

```sh
codex plugin marketplace add JsonLee12138/codex-marketplace --ref main
codex plugin add vibe-rig@jsonlee
```

Selector format is `PLUGIN@MARKETPLACE`. Marketplace: `jsonlee`, plugin: `vibe-rig`.

## Update

```sh
codex plugin marketplace upgrade jsonlee
```

If installed plugins are not refreshed automatically:

```sh
codex plugin remove vibe-rig
codex plugin add vibe-rig@jsonlee
```

Restart Codex after updating.

## Verify

- Run `codex plugin list` and confirm `vibe-rig@jsonlee` is installed.
- In a project, try: `Use vb-init for this repo.`
