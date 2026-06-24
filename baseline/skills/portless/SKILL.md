---
name: portless
description: Use when local web app, browser, OAuth callback, webhook, or multi-service verification would benefit from stable named localhost URLs via Portless. Keeps Portless optional and safety-gated because it can alter local networking, trust stores, and hosts files.
version: 1.0.0
tags: [workflow, integration, testing]
dependencies: []
---

# Portless Local URL Workflow

## Overview

Portless replaces ad-hoc port numbers with stable, named local URLs such as `https://myapp.localhost`. In OpenCodeKit, treat it as an **optional verification aid** for local web workflows, not as a project dependency or default dev-server wrapper.

Core rule: **read-only checks are allowed; installation, proxy startup, CA trust, hosts changes, cleanup, and LAN exposure require explicit user approval.**

## When to Use

- A PRD or task requires browser verification, OAuth callbacks, webhooks, cookies, cross-origin flows, or multiple local services.
- Port numbers are brittle across git worktrees, parallel dev servers, or subagent/browser automation.
- A user asks for stable local URLs, Portless setup, Portless troubleshooting, or named `.localhost` routes.
- You need to record a human-verifiable local URL in `/ship`, `/verify`, or PR testing notes.

## When NOT to Use

- Pure CLI, library, docs, config, or unit-test-only work.
- CI verification or non-interactive environments where privileged proxy setup could hang or fail.
- The user has not approved installing Portless or making local machine changes.
- The only goal is to run a single test or inspect code; use normal project commands instead.

## Safety Model

Portless can touch machine-level state. Classify commands before running them:

| Class            | Examples                                                              | Policy                                             |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| Read-only        | `portless --version`, `portless list`, `portless get <service>`       | OK if binary exists                                |
| Process-local    | `portless run npm run dev`                                            | Ask first; starts a long-running server/proxy path |
| Machine-mutating | install, CA trust, hosts sync, proxy start/stop, aliases, prune/clean | Ask first; explain impact                          |
| Network-exposing | LAN mode, `.local` sharing                                            | Ask first; mention local network exposure          |

Never run `sudo`, trust a CA, edit `/etc/hosts`, start/stop global proxies, prune/clean state, or expose LAN services without explicit approval in the current conversation.

## Detection Checklist

Before suggesting Portless:

```bash
command -v portless >/dev/null 2>&1 && portless --version
```

If installed, read current state without mutating it:

```bash
portless list
```

If a service is already known, resolve its URL:

```bash
portless get <service>
```

If Portless is not installed, do **not** install automatically. Ask whether the user wants global/user-local Portless setup and state that it may configure local proxy, HTTPS trust, and hosts entries depending on the chosen setup path.

## Verification Workflow

When approved and useful for a local web task:

1. Prefer the project's existing dev command from `package.json`, `Makefile`, or docs.
2. Ask before wrapping it with Portless.
3. Start the dev server with Portless in a visible terminal/process:
   ```bash
   portless run npm run dev
   ```
4. Resolve the stable URL:
   ```bash
   portless get <service>
   ```
5. Use the stable URL for browser automation, OAuth/webhook callback notes, manual checkpoints, or PR testing instructions.
6. Keep normal verification gates (`typecheck`, `lint`, `test`, `build`) separate; a reachable Portless URL does not prove code correctness.

## Command Integration Rules

- `/create` and `/plan`: mention Portless only when success criteria involve browser/manual local-web verification or callback URLs.
- `/ship`: use Portless during Phase 4 only if approved and relevant; never auto-install or auto-start it.
- `/verify`: may use read-only `portless list` / `portless get` evidence and approved stable URLs for manual or browser checks.
- `/status`: may include `portless list` if installed; no Portless mutations from status.
- `/lfg`: inherits Portless behavior through `/plan`, `/ship`, and `/verify`; do not add a separate Portless branch.

## Reporting

When Portless is used, report:

```text
Portless: [not installed | installed | approved active]
Service: <name>
URL: https://<name>.localhost
Evidence: <command used to resolve or verify>
Limitations: normal gates still required
```

If setup was skipped because approval was missing, say exactly what was skipped and continue with normal localhost/port verification.

## Gotchas

- **Privileged local networking is not a harmless helper** — Portless may bind 80/443, invoke sudo, add a local CA, or mutate hosts/proxy state. Always separate read-only discovery from machine-mutating setup.
- **Pre-1.0 tool behavior can churn** — Verify current CLI behavior with `portless --version` and read-only commands before relying on exact subcommand output.
- **Stable URL reachability is not correctness** — A named URL only proves routing. Still run project gates and feature-specific tests before claiming completion.
