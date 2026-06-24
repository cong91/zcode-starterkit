# zcode-starterkit — Design

- **Date:** 2026-06-24
- **Status:** Approved (design validated via Q&A)
- **Scope:** Phase 1 (clean port). Phase 2 (runtime rewrite) is out of scope.

## Goal

Clone `opencode-starterkit` into `zcode-starterkit`: an npm bootstrap package for
the **ZCode Agent** that installs via `npx zcode-starterkit`, keeps **every
portable part** of the OpenCode baseline, maps it onto ZCode's structure, and
ships a **sandboxed home-dir simulation** so it can be tested without touching
the live `C:\Users\PC\.zcode`.

## Key findings (from reading both sources)

1. **ZCode config uses the same schema as OpenCode** — `~/.zcode/v2/config.json`
   declares `$schema: "https://opencode.ai/config.json"`. So `agent{}`, `mcp{}`,
   `provider{}`, `permission{}` merge cleanly.
2. **ZCode loads extensions via plugins, not loose folders.** Each plugin lives
   under `~/.zcode/cli/plugins/cache/<marketplace>/<plugin>/<version>/` with a
   `.zcode-plugin/plugin.json` that declares `skills`, `commands`, `mcpServers`,
   `userConfig`, and optional `hooks`. A `marketplaces/<mp>/marketplace.json`
   registry lists plugins; `cli/config.json` `enabledPlugins` turns them on.
3. **ZCode has no OpenCode-style TS plugin runtime.** OpenCode plugins
   (`memory.ts`, `sessions.ts`, `skill-mcp.ts`, …) use `@opencode-ai/plugin`
   with internal events (`message.part.updated`, `messages.transform`,
   `system.transform`) that do not exist in ZCode. ZCode's only runtime
   extension points are: MCP servers (stdio, `@modelcontextprotocol/sdk`),
   Claude-Code-style shell hooks, and skill/command markdown. → These plugins
   **cannot be ported verbatim** and are deferred to Phase 2.

## What ports verbatim (Phase 1)

| Source | Target | Treatment |
|---|---|---|
| `baseline/opencode.json` | `baseline/config.json` → merge into `v2/config.json` | Additive merge; drop `plugin:[]` (OpenCode TS plugins); keep `mcp{}`, `provider{}`, `agent{}`, `permission{}`, `formatter{}`, etc. |
| `baseline/agent/*.md` (9) | plugin `agents-config` `agents/` | Copy verbatim; agent model refs normalized (invalid provider → removed → falls back to ZCode default GLM) |
| `baseline/command/*.md` (26) | plugin `core` `commands/` | Copy verbatim |
| `baseline/skill/*` (133) | plugin `core` `skills/` | Copy verbatim |
| `baseline/memory/*` (templates) | `baseline/memory/` + project overlay | Copy verbatim |
| `baseline/AGENTS.md`, context docs | `baseline/` docs | Copy verbatim |

## What is NOT ported (Phase 2)

- `baseline/plugin/*.ts` (20 TS plugins, `@opencode-ai/plugin`) — rewrite to MCP
  servers in Phase 2 (reduced: manual tool calls, no auto-capture/inject).
- `baseline/tool/*.ts` (`context7.ts`, `grepsearch.ts`) — rewrite to MCP server.
- `memory-bootstrap.mjs` (bun + SQLite) — Phase 2.
- `br`/beads CLI integration — not relevant to ZCode; dropped entirely.

## Architecture (two tiers, same philosophy as OpenCode)

```
zcode-starterkit/
├── baseline/            # vendored, ported to ZCode
│   ├── config.json      # from opencode.json (plugin[] stripped)
│   ├── agents/          # 9 *.md
│   ├── commands/        # 26 *.md
│   ├── skills/          # 133 SKILL.md
│   ├── memory/          # templates
│   ├── AGENTS.md, context/, ...
│   └── (no plugin/, no tool/)
├── bin/                 # zcode-starterkit.mjs, zcs.mjs
├── src/                 # installer (ported from opencode src/)
├── test/                # sandbox + safety tests
└── package.json
```

### Two plugins shipped under marketplace `zcode-starterkit`

```
~/.zcode/cli/plugins/cache/zcode-starterkit/
├── core/0.1.0/
│   ├── .zcode-plugin/plugin.json   # { name:"core", version, skills:"skills", commands:"commands" }
│   ├── skills/                     # 133 SKILL.md
│   ├── commands/                   # 26 *.md
│   └── package.json
└── agents-config/0.1.0/
    ├── .zcode-plugin/plugin.json   # { name:"agents-config", version }
    ├── agents/                     # 9 *.md (referenced via config merge)
    └── package.json
```

Rationale: `core` holds prompt-level assets (skills/commands) that ZCode loads
as a plugin; `agents-config` separates agent definitions, which are config-level
(merged into `v2/config.json`). Split keeps boundaries clean and allows
selective enable.

## Path mapping (OpenCode → ZCode)

| OpenCode constant | ZCode target |
|---|---|
| `~/.config/opencode` | `ZCODE_HOME` (default `~/.zcode`) |
| `~/.config/opencode/agents` | merged into `ZCODE_HOME/v2/config.json` `agent{}` |
| `~/.config/opencode/skills` | `ZCODE_HOME/cli/plugins/cache/zcode-starterkit/core/0.1.0/skills/` |
| `~/.config/opencode/command` | `…/core/0.1.0/commands/` |
| `~/.config/opencode/plugin` | dropped (Phase 2) |
| `~/.config/opencode/tool` | dropped (Phase 2) |
| `~/.local/share/opencode/starterkit` | `ZCODE_HOME/cli/plugins/cache/zcode-starterkit/` (vendor) |
| `~/.config/opencode/opencode.json` merge | `ZCODE_HOME/v2/config.json` |
| `~/.local/bin` shims | kept (`zcs`, `zcode-starterkit`) |
| `~/.local/state/opencode` | `ZCODE_HOME/cli/starterkit-state/{backups,logs,manifests}` |

`ZCODE_HOME` env overrides the root for sandboxing; combined with `HOME`/
`USERPROFILE` override it simulates a full home dir.

## Config merge into v2/config.json

Reuse the additive-merge + normalize logic from `config-merge.mjs` (rename
`opencode`→`zcode` in symbols). Specifics:

- Additive merge: only adds missing keys; existing ZCode providers
  (`builtin:zai`, `builtin:zai-coding-plan`, …) are preserved untouched.
- Strip `plugin:[]` from baseline before merge (OpenCode TS plugins don't run).
- `normalizeModelField`/`normalizeAgentModels` remove invalid `model`/
  `small_model`/agent model refs (e.g. `github-copilot/gpt-5.5`) when the
  provider isn't present → agents keep their `description`, model falls back to
  ZCode default. Recorded in merge manifest.
- Keep `mcp{}` (`figma-mcp-go`, `tilth`, `webclaw`) — ZCode config supports it.

## Install flow (port install-global.mjs)

```
installGlobal({ cwd }):
  1. resolve ZCODE_HOME (env or ~/.zcode)
  2. ensureDir state dirs (backups/logs/manifests)
  3. copyBaselineAsPlugin()  → vendor baseline/ into cache/zcode-starterkit/{core,agents-config}/
       + generate .zcode-plugin/plugin.json + package.json per plugin
  4. registerMarketplace()   → write cli/plugins/marketplaces/zcode-starterkit/marketplace.json
  5. enablePlugins()         → merge cli/config.json enabledPlugins: { "core@zcode-starterkit": true, "agents-config@zcode-starterkit": true }
  6. mergeGlobalConfig()     → additive merge baseline/config.json into v2/config.json + normalize
  7. installCliShims()       → ~/.local/bin/zcs, zcode-starterkit
  8. writeInstallLog()
```

Dropped vs OpenCode: `ensureBeadsCliInteractive`, `memory-bootstrap`,
`runCommandInit` (OpenCode-specific). Project overlay (`zcs install`) creates a
thin `.zcode/` overlay (config.json + memory/project/*.md) with **no
command-init runtime call**.

## CLI

| Bin | Function |
|---|---|
| `zcode-starterkit` | global install |
| `zcs` | `zcs install` → project overlay |
| `zcode-starterkit --sandbox` | set `ZCODE_HOME=<repo>/.sandbox/.zcode` then install (safe test) |

`package.json`: `name: zcode-starterkit`, `type: module`, `bin`, `engines.node>=20`,
`scripts.test = node --test`, `scripts.test:smoke = --help checks`. Runnable via
`npx zcode-starterkit` after `npm publish` (or `npm link` for local test).

## Testing (sandboxed home-dir simulation)

`test/sandbox.test.mjs`: set `ZCODE_HOME` + `HOME`/`USERPROFILE` to
`test/.sandbox`, run `installGlobal`, assert:

- `cache/zcode-starterkit/core/0.1.0/.zcode-plugin/plugin.json` exists; `skills/`
  has ~133 dirs; `commands/` has ~26 files.
- `marketplaces/zcode-starterkit/marketplace.json` lists both plugins.
- `cli/config.json` `enabledPlugins` has both entries.
- `v2/config.json` is additive-merged; builtin ZCode providers untouched;
  invalid `model` normalized away.
- **No file written outside the sandbox** (path-escape guard).

`test/install-safety.test.mjs` (ported): backup-before-overwrite, copy denylist,
path-escape guard. `test:smoke`: `--help` exits 0.

## Phase 1 deliverables (this implementation)

- [ ] Repo `zcode-starterkit/` with `baseline/` (config + 9 agents + 26 commands
      + 133 skills + memory templates + MCP config; no plugin/tool TS),
      `src/` (installer port), `bin/`, `test/` (sandbox), `package.json`,
      `README.md`.
- [ ] `npm test` green, `npm run test:smoke` green, sandbox install runs clean
      without touching real `~/.zcode`.
- [ ] `npm link` → `npx zcode-starterkit --sandbox` works.

## Phase 2 (out of scope, separate effort)

- Port `memory.ts`/`sessions.ts`/`skill-mcp.ts` → reduced MCP servers.
- Port `context7.ts`/`grepsearch.ts` → MCP server.
- Real install into `~/.zcode` (user runs `zcode-starterkit install` after
  reviewing sandbox).
