# zcode-starterkit

Bootstrap package for the **ZCode Agent**. Installs a shared baseline (skills, commands, agents, config) as ZCode plugins globally, then creates a thin per-project `.zcode/` overlay.

## Install (global baseline)

```bash
npx zcode-starterkit
```

## Sandbox test (does not touch real ~/.zcode)

```bash
zcode-starterkit --sandbox
```

## Project overlay

```bash
zcs install
```

## What is installed

Four ZCode plugins under the `zcode-starterkit` marketplace, enabled in `~/.zcode/cli/config.json`:

- **`core`** — 132 skills + 27 commands (ported verbatim from the OpenCode baseline, plus `structural-check`).
- **`agents-config`** — 9 agent definitions, merged into `~/.zcode/v2/config.json`.
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

Config is additively merged into `~/.zcode/v2/config.json` (same `https://opencode.ai/config.json` schema). OpenCode-only `plugin[]` TS entries are stripped.

The **core** plugin also bundles these portable content dirs from the OpenCode baseline (reference assets the agent reads via filesystem / `srcwalk_read`): `templates/` (adr, design, prd, project, proposal, roadmap, state, tasks, tech-stack, user), `workflows/`, `plans/`, `artifacts/`, `dcp-prompts/`.

**OpenCode-specific config files NOT carried** (no ZCode equivalent):
- `dcp.jsonc` — OpenCode DCP (Dynamic Context Pruning) plugin config; ZCode has no DCP.
- `opencodex-fast.jsonc`, `tui.json` — OpenCode TUI/plugin config; ZCode uses an Electron UI.
- `baseline/package.json` / `tsconfig.json` — OpenCode TS plugin build files (the ZCode MCP plugin has its own `baseline/mcp-tools/package.json`).

## Rebuilding the MCP bundle (developers)

The `mcp-tools` plugin ships a prebuilt `dist/mcp/server.js`. To rebuild after editing `baseline/mcp-tools/src/**/*.ts`:

```bash
cd baseline/mcp-tools
npm install
npm run build   # esbuild bundles to dist/mcp/server.js
```

See `docs/superpowers/specs/2026-06-24-zcode-starterkit-design.md` for the full design.
