# Install VibeRig on Cursor

Copy this entire file to your AI assistant and ask it to install VibeRig for Cursor.

Source branch: [github.com/JsonLee12138/vibeRig/tree/cursor](https://github.com/JsonLee12138/vibeRig/tree/cursor)

## Prerequisites

- Cursor with plugin support enabled. See [Cursor Plugins documentation](https://cursor.com/docs/plugins).
- No separate Linear account setup is needed ahead of time. VibeRig ships its own Linear MCP server config (`mcp.json`); running `vb-init` in a project checks login status before registering a Linear project and triggers the OAuth flow on the spot if you aren't logged in yet.

## Install

Clone the `cursor` branch into Cursor's local plugin directory:

```sh
git clone https://github.com/JsonLee12138/vibeRig.git ~/.cursor/plugins/local/vibe-rig
```

Restart Cursor after cloning so the plugin and its skills load.

## Update

```sh
cd ~/.cursor/plugins/local/vibe-rig
git pull origin cursor
```

Restart Cursor after updating.

## Verify

- Open Cursor Settings → Plugins and confirm `vibe-rig` is listed.
- In a project, try: `Use vb-init for this repo.`
