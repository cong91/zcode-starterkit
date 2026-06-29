# zcode-starterkit

Bootstrap package for the **ZCode Agent**. Installs a shared baseline (skills, commands, agents, config) as ZCode plugins globally, then creates a thin per-project `.zcode/` overlay.

## Install (global baseline)

```bash
npx zcode-starterkit
```

By default the installer also sets up two optional integrations (both auto-install if their CLI is missing):

- **CodeGraph** — project intelligence (MCP server, local indexing, auto-refresh git hooks). Disable with `--skip-codegraph`.
- **WebClaw MCP** — URL extraction / browser-agent tools. Disable with `--skip-webclaw`.

See the install flags section below for opt-out / fail-fast flags.

## Sandbox test (does not touch real ~/.zcode)

```bash
zcode-starterkit --sandbox --skip-codegraph --skip-webclaw
```

## Install flags

| Flag | Effect |
| --- | --- |
| `--sandbox` | Install into `<repo>/.sandbox/.zcode` instead of real `~/.zcode` |
| `--with-codegraph` | Enable CodeGraph; install it automatically if missing (default behavior) |
| `--skip-codegraph` | Disable CodeGraph; no MCP, indexing, refresh, or hooks |
| `--require-codegraph` | Fail install if CodeGraph cannot be enabled |
| `--allow-codegraph-hooks` | Append CodeGraph refresh hooks even when `core.hooksPath`/Husky is configured |
| `--with-webclaw` | Enable WebClaw MCP; download/install it automatically if missing (default behavior) |
| `--skip-webclaw` | Disable WebClaw MCP and remove starterkit-managed webclaw config |
| `--require-webclaw` | Fail install if WebClaw MCP cannot be enabled |

## What is installed

Four ZCode plugins under the `zcode-starterkit` marketplace, enabled in `~/.zcode/cli/config.json`:

> **Curated for ZCode (not a raw port):** the 13 workflow skills that overlap with ZCode's native `superpowers@zcode-plugins-official` plugin (brainstorming, writing-plans, test-driven-development, systematic-debugging, verification-before-completion, executing-plans, etc.) were **removed** so ZCode uses the native versions. OpenCode-only model/provider config was **stripped** so ZCode uses its native GLM provider. All `.opencode` path refs in skills/commands were rewritten to `.zcode`, and OpenCode-specific runtime refs (DCP, `opencode run`, plugin TS paths) were adapted to ZCode equivalents.

- **`core`** — 119 curated skills + 27 commands (ported from OpenCode baseline, deduped against native superpowers, paths/CLI refs adapted to ZCode). Also bundles portable content dirs: `templates/`, `workflows/`, `plans/`, `artifacts/`, `dcp-prompts/`, `memory/` (project templates the `/init` runbook copies into the per-project overlay).
- **`agents-config`** — 9 agent definitions (description only, no model refs), merged into `~/.zcode/v2/config.json`. ZCode's native GLM provider supplies the model.
- **`mcp-tools`** — an MCP server (`@modelcontextprotocol/sdk`) porting OpenCode baseline tools as MCP tools (18 tools total):
  - `context7` — library documentation lookup
  - `grepsearch` — real-world code search via grep.app
  - `csearch` — multi-keyword codebase search with BM25 ranking (requires `rg`)
  - `observation`, `memory-search`, `memory-get`, `memory-read` — project memory DB (SQLite). `observation`/`memory-search` are also fed automatically by the `memory-capture`/`memory-inject` hooks below.
  - `find_sessions`, `read_session` — ZCode session/task search
  - `srcwalk_read`, `srcwalk_deps`, `srcwalk_map`, `srcwalk_callers`, `srcwalk_callees`, `srcwalk_flow`, `srcwalk_impact` — code intelligence/navigation (grep-based)
  - `skill_mcp_list`, `skill_mcp_connect` — on-demand spawn of skill-scoped MCP servers (complements ZCode's native `mcpServers`)
  - `/structural-check` slash command (ported from `structural-check.sh`, adapted to the ZCode layout)
- **`hooks`** — ZCode shell hooks (Claude Code-style) porting OpenCode event-hook plugins. ZCode supports `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop` hook events:
  - **guard** (PreToolUse) — blocks high-risk commands (rm -rf, sudo, git push --force, db:reset, DROP, TRUNCATE).
  - **rtk** (PreToolUse) — rewrites bash commands through `rtk rewrite` for token savings (requires `rtk` on PATH).
  - **memory-capture** (PostToolUse) — auto-records tool usage (files read/edited, commands run) as observations in `.zcode/memory.db`. This is the ZCode analogue of OpenCode's auto-capture (no `message.part.updated`, but PostToolUse covers the most valuable signal).
  - **memory-inject** (UserPromptSubmit) — FTS5-searches past observations relevant to the prompt and injects them via `additionalContext`.
  - **prompt-leverage** (UserPromptSubmit) — appends an execution-framing scaffold (objective, context, tool rules, verification, done criteria).
  - **session-summary-track** (PostToolUse) + **session-summary-persist** (Stop) — tracks file artifacts touched per session and renders an anchored `.zcode/state/session-summary.md` that survives across turns.

  These hooks run as plain Node `.mjs` scripts (no TypeScript at runtime) so ZCode can launch them directly.

  > Auto-capture/inject is now available via the `hooks` plugin (PostToolUse + UserPromptSubmit). It is not as granular as OpenCode's `message.part.updated` (which captured every message token), but it covers tool-usage signal — the most valuable memory input.

  **Only 1 OpenCode plugin file was NOT ported** (verified non-portable + user-approved drop):
  - `copilot-auth.ts` — uses OpenCode `auth.provider.loader` (ZCode manages auth via `credentials.json`/`v2/config.json`; no plugin auth-loader surface).

  The other 5 formerly-dropped files are now ported via the `hooks` plugin: `guard`, `rtk`, `prompt-leverage`, `session-summary` as shell hooks, and `skill-mcp` as 2 MCP tools.

Config is additively merged into `~/.zcode/v2/config.json` (same `https://opencode.ai/config.json` schema). The curated baseline keeps `mcp{}`, `permission{}`, `formatter{}`, `agent{}` (descriptions), `compaction{}`, `keybinds`, `instructions`, `share`, `watcher` — and **drops** OpenCode-only `model`/`small_model`/`provider{}` so ZCode uses its native GLM provider. OpenCode-only `plugin[]` TS entries are stripped.

The **core** plugin also bundles these portable content dirs from the OpenCode baseline (reference assets the agent reads via filesystem / `srcwalk_read`): `templates/` (adr, design, prd, project, proposal, roadmap, state, tasks, tech-stack, user), `workflows/`, `plans/`, `artifacts/`, `dcp-prompts/`.

**OpenCode-specific config files NOT carried** (no ZCode equivalent):
- `dcp.jsonc` — OpenCode DCP (Dynamic Context Pruning) plugin config; ZCode has no DCP.
- `opencodex-fast.jsonc`, `tui.json` — OpenCode TUI/plugin config; ZCode uses an Electron UI.
- `baseline/package.json` / `tsconfig.json` — OpenCode TS plugin build files (the ZCode MCP plugin has its own `baseline/mcp-tools/package.json`).

## CodeGraph integration

When enabled (default), `zcode-starterkit install`:

1. Installs the `codegraph` CLI globally via `npm install -g @colbymchenry/codegraph` if it is not already on PATH.
2. Adds a `codegraph` MCP server entry to `~/.zcode/v2/config.json` (so the agent can query the indexed source graph).
3. Adds `.codegraph/` to `.git/info/exclude` (local-only ignore; never edits tracked `.gitignore` without approval).
4. Installs best-effort git refresh hooks (`post-merge`, `post-checkout`, `post-rewrite`) into `.git/hooks` that run `codegraph sync .` / `codegraph init .` after pull/checkout/rebase. Hooks are skipped when `core.hooksPath` is configured (Husky/custom) unless `--allow-codegraph-hooks` is passed.
5. Records enablement in `~/.zcode/cli/starterkit-state/starterkit-state.json`.

Worktree clones (`.git` is a file) are skipped — CodeGraph should be refreshed in the source-origin checkout.

## WebClaw MCP integration

When enabled (default), `zcode-starterkit install`:

1. Downloads the latest `webclaw-mcp` release binary for the current platform/arch into `~/.webclaw/` if `webclaw-mcp` is not already on PATH.
2. Adds a `webclaw` MCP server entry to `~/.zcode/v2/config.json` for URL extraction / browser-agent tools.
3. Records enablement in `~/.zcode/cli/starterkit-state/starterkit-state.json`.

The baseline `config.json` ships **no** static `webclaw` (or `codegraph`) MCP entry — both are added conditionally during install so the agent never loads a missing MCP server. When an integration is disabled, any stale starterkit-managed MCP entry is stripped from the merged config.

## /init project setup

After the global install, run `/init` inside a project to materialize a thin `.zcode/` overlay, refresh CodeGraph for that project, detect the stack, and synthesize an `AGENTS.md` from the `memory/_templates/agents.md` scaffold. The `/init` runbook is agent-driven (no legacy project-install shim) and is the only project setup path.

## Rebuilding the MCP bundle (developers)

The `mcp-tools` plugin ships a prebuilt `dist/mcp/server.js`. To rebuild after editing `baseline/mcp-tools/src/**/*.ts`:

```bash
cd baseline/mcp-tools
npm install
npm run build   # esbuild bundles to dist/mcp/server.js
```

See `docs/superpowers/specs/2026-06-24-zcode-starterkit-design.md` for the full design.

## Releasing to NPM

Releases are published by the `release` GitHub Action (`.github/workflows/release.yml`). It runs the full test suite (Linux + Windows) as a gate, rebuilds the `mcp-tools` bundle, then publishes the root package to NPM.

### One-time setup

Add an `NPM_TOKEN` secret to the GitHub repo (Settings → Secrets and variables → Actions → New repository secret). Use an npm **automation** or **granular access** token scoped to publish `zcode-starterkit`.

### Cut a release

```bash
# 1. Ensure package.json version + src/constants.mjs PLUGIN_VERSION are bumped
#    and the test suite is green locally: npm test && npm run test:smoke
# 2. Commit + push the version bump
# 3. Tag with the matching v<prefix> and push the tag
git tag v1.0.0
git push origin v1.0.0
```

The workflow refuses to publish if the tag version does not equal `package.json` `version`. Manual fallback: run the `release` workflow from the Actions tab (`workflow_dispatch`).

