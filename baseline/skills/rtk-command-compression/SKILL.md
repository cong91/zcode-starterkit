---
name: rtk-command-compression
description: Use when installing, enabling, testing, or operating RTK command-output compression in OpenCode — keeps RTK opt-in, verifies the correct binary/plugin, protects raw verification evidence, and maintains safe hook exclusions.
version: 1.0.0
tags: [workflow, integration, automation]
dependencies: []
---

# RTK Token Optimization

## Overview

RTK can reduce noisy shell output from commands like `git status`, tests, lint, build tools, Docker, kubectl, and `gh`. Treat it as an **opt-in shell-output compressor**, not a replacement for OpenCode's native read/search/edit tools.

Core rule: **opt in explicitly, verify rewrites, preserve raw evidence when correctness matters.**

## When to Use

- User asks to install, enable, test, tune, or troubleshoot RTK in OpenCode.
- Bash output is consuming too much context from shell-heavy workflows.
- You need to document or validate RTK wiring in a project where `~/.zcode` may be symlinked to `.zcode`.

## When NOT to Use

- Code inspection or editing: prefer `tilth_tilth_read`, `tilth_tilth_search`, LSP, Read, Grep, and Edit.
- Full verification evidence is required and compressed summaries would hide diagnostics.
- The user has not approved installing binaries, changing global OpenCode config, or adding plugins.

## Current OpenCodeKit Wiring

This template supports RTK as optional user-local wiring:

- RTK binary: `~/.local/bin/rtk` after opt-in install.
- Active ZCode hook path in this symlinked setup: `hooks-plugin/hooks/rtk.mjs (ZCode PreToolUse hook)`.
- RTK config path on macOS: `~/Library/Application Support/rtk/config.toml`.
- Keep telemetry disabled unless the user explicitly opts in.
- Keep tee mode on `failures` so raw output can be recovered when commands fail.

If `~/.zcode` is symlinked to this repo's `.zcode`, ZCode may load the same hook as both global and project config. The RTK plugin must be idempotent: skip commands already starting with `rtk`.

## Install / Enable Checklist

Ask before installing or changing global config. Then run:

```bash
command -v rtk || RTK_INSTALL_DIR="$HOME/.local/bin" sh /tmp/rtk-research/install.sh
rtk --version
rtk gain
RTK_TELEMETRY_DISABLED=1 rtk init -g --zcodely
RTK_TELEMETRY_DISABLED=1 rtk config --create
```

Verify OpenCode sees the plugin:

```bash
zcode config show | grep -i 'rtk\|plugin' -C 2
```

Verify RTK itself:

```bash
RTK_TELEMETRY_DISABLED=1 rtk telemetry status
rtk verify
```

`rtk verify` may say a Claude hook is not installed; that is expected when only the OpenCode plugin is enabled. The important checks are the ZCode hook path, telemetry status, and RTK test count.

## Required Safety Settings

In `~/Library/Application Support/rtk/config.toml`, keep exclusions for commands that need raw output or are known unsafe under RTK rewrite:

```toml
[hooks]
exclude_commands = ["curl", "wget", "playwright", "find", "npx oxlint", "git push", "git rebase", "git cherry-pick"]

[telemetry]
enabled = false

[tee]
enabled = true
mode = "failures"
```

Rationale:

| Exclusion                                   | Why                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `curl`, `wget`                              | Preserve raw HTTP output and avoid hiding API/debug evidence.                  |
| `playwright`                                | Browser automation logs/screenshots need full fidelity.                        |
| `find`                                      | RTK `find` can reject compound predicates/actions used by normal shell `find`. |
| `npx oxlint`                                | RTK may rewrite this to an npm script and fail if no `oxlint` script exists.   |
| `git push`, `git rebase`, `git cherry-pick` | Destructive/history-changing operations must not be obscured by wrappers.      |

Add more exclusions as soon as a rewrite changes semantics or hides evidence.

## Runtime Usage Rules

- Use normal shell commands; let RTK rewrite low-risk noisy commands automatically.
- Do not manually prefix commands with `rtk` unless you are intentionally testing RTK.
- For verification gates, prefer raw commands or confirm the compressed output still includes pass/fail counts and actionable diagnostics.
- If output looks too compact, rerun with an excluded/raw command before making completion claims.
- Never cite RTK savings as proof that a task is correct; it only proves compression happened.

## Testing RTK Works

Use one command that should rewrite and one that should not:

```bash
git status
curl https://example.com
rtk gain
```

Expected evidence:

- `git status` output appears in RTK's compact style and `rtk gain` command count increases.
- `curl` shows raw curl progress/body because it is excluded.
- `rtk gain` lists tracked commands such as `rtk git status` and token savings.

## Troubleshooting

| Symptom                          | Check                                           | Fix                                                                     |
| -------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| No rewrites                      | `zcode config show`                         | Restart ZCode and confirm `hooks-plugin/hooks/rtk.mjs (ZCode PreToolUse hook)` is loaded.       |
| Recursive `rtk rtk ...` behavior | Inspect `hooks-plugin/hooks/rtk.mjs (ZCode PreToolUse hook)`               | Add/restore idempotency guard for commands already starting with `rtk`. |
| Command semantics changed        | `rtk rewrite '<command>'`                       | Add the command prefix to `[hooks].exclude_commands`.                   |
| Need raw failed output           | Check RTK tee files/config                      | Keep `[tee] mode = "failures"`; rerun raw if needed.                    |
| Telemetry concern                | `RTK_TELEMETRY_DISABLED=1 rtk telemetry status` | Keep telemetry disabled unless user opts in.                            |

## Gotchas

- **OpenCode path changed from plural to singular** — Initial RTK docs/install path referenced `plugins/rtk.ts`, but active OpenCodeKit loading after restart used `hooks-plugin/hooks/rtk.mjs (ZCode PreToolUse hook)`. Document and inspect the active path, not just installer output.
- **Symlinked global/project config can double-load plugin paths** — When `~/.zcode` points at this repo's `.zcode`, OpenCode can resolve global and project plugin URLs. The plugin must skip commands already starting with `rtk`.
- **Unsafe rewrites were observed** — `find` compound predicates and `npx oxlint` were rewritten incorrectly during testing. Keep them excluded unless RTK behavior changes and is re-verified.
