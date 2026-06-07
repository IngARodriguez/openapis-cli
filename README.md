# @openapis-online/proxy

One-command setup to point [Claude Code](https://docs.claude.com/en/docs/claude-code) at the free [OpenAPIs](https://openapis.online) proxy.

```bash
npm install -g @openapis-online/proxy
openapis init
```

That's it. Restart your shell, run `claude`, and you're talking to Anthropic through OpenAPIs.

## What it does

Writes two environment variables to your shell's startup file:

```
ANTHROPIC_BASE_URL=https://api.openapis.online/anthropic
ANTHROPIC_API_KEY=admin
```

Auto-detects your platform and shell:

| Platform | Shell | File touched |
| --- | --- | --- |
| Windows | PowerShell | `$PROFILE` |
| Windows | Command Prompt | User environment (via `setx`) |
| macOS | zsh | `~/.zshrc` |
| macOS | bash | `~/.bash_profile` (or `~/.bashrc`) |
| Linux | bash | `~/.bashrc` |
| Linux | zsh | `~/.zshrc` |
| any | fish | `~/.config/fish/config.fish` |

The configuration is written between sentinel comments so it can be removed cleanly:

```
# >>> openapis-cli >>>
# Managed by @openapis-online/proxy. Run `openapis unlink` to remove.
export ANTHROPIC_BASE_URL="https://api.openapis.online/anthropic"
export ANTHROPIC_API_KEY="admin"
# <<< openapis-cli <<<
```

A backup of your rc file is saved next to the original as `<file>.bak.openapis` before the first edit.

## Commands

```bash
openapis init [--key VALUE] [--yes]
```
Interactive setup. Prompts for the API key (default: `admin`, the public beta key). Use `--yes` for non-interactive mode (CI, scripts). Use `--key` to skip the prompt with a specific key.

```bash
openapis status
```
Shows whether the configuration block is present, the target file, and what the current shell sees in its environment. Useful to debug "did I restart my shell?" moments.

```bash
openapis test
```
Performs a live connectivity check: hits `/status` to confirm the proxy is up, then does a tiny Anthropic `/v1/messages` round-trip with the current shell's `ANTHROPIC_API_KEY` to confirm auth works end-to-end.

```bash
openapis unlink
```
Removes the configuration block from your rc file (idempotent). Restart your shell for the change to take effect.

## Why this exists

Without this CLI, configuring Claude Code to use OpenAPIs means:

- knowing your shell's syntax for env vars (`export` vs `$env:` vs `setx`)
- knowing your shell's rc file location
- editing that file safely without breaking what's already there
- remembering to restart your shell

That's a five-step process for what should be a single command. `openapis init` does all of it.

## Requirements

Node 18 or newer (which Claude Code already requires).

## Privacy

The CLI does not collect telemetry, does not phone home on install, and does not write anywhere outside your shell rc file (or `HKCU\Environment` on Windows CMD). The full source is on GitHub: [IngARodriguez/openapis-cli](https://github.com/IngARodriguez/openapis-cli).

## License

MIT
