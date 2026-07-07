# Install VibeRig on Claude Code

Copy this entire file to your AI assistant and ask it to install VibeRig for Claude Code.

References:

- [Discover and install plugins through marketplaces](https://code.claude.com/docs/en/discover-plugins)
- [Configure team marketplaces](https://code.claude.com/docs/en/discover-plugins#configure-team-marketplaces)
- [Create plugins](https://code.claude.com/docs/en/plugins)

## Prerequisites

- Claude Code installed and updated (`claude --version`).
- No separate Linear account setup is needed ahead of time. VibeRig bundles Linear MCP config in `.mcp.json`; running `vb-init` in a project checks login status before registering a Linear project and triggers the OAuth flow on the spot if you aren't logged in yet.

## Install (interactive)

Inside Claude Code:

```shell
/plugin marketplace add JsonLee12138/vibeRig
/plugin install vibe-rig@viberig
```

Marketplace name: `viberig` (from `.claude-plugin/marketplace.json`). Plugin name: `vibe-rig`.

Choose installation scope when prompted (user / project / local).

## Install (CLI)

```shell
claude plugin marketplace add JsonLee12138/vibeRig
claude plugin install vibe-rig@viberig
```

Add `--scope project` to pin the plugin in `.claude/settings.json` for collaborators.

## Team marketplace (optional)

To pre-register the marketplace for a repository, add to `.claude/settings.json`:

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

Team members still run `claude plugin install vibe-rig@viberig` (or `/plugin install`) before the plugin loads.

## Update

```shell
/plugin marketplace update viberig
```

Or from the shell:

```shell
claude plugin marketplace update viberig
```

Reinstall if needed:

```shell
claude plugin install vibe-rig@viberig
```

Restart Claude Code after updating.

## Verify

- Run `/plugin` → Installed tab → confirm `vibe-rig` is enabled.
- Try: `/vibe-rig:vb-init` or ask Claude to use the `vb-init` skill in a project.
