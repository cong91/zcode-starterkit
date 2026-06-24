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

Three ZCode plugins under the `zcode-starterkit` marketplace, enabled in `~/.zcode/cli/config.json`:

- **`core`** — 132 skills + 26 commands (ported verbatim from the OpenCode baseline).
- **`agents-config`** — 9 agent definitions, merged into `~/.zcode/v2/config.json`.
- **`mcp-tools`** — an MCP server (`@modelcontextprotocol/sdk`) porting OpenCode baseline tools as manual MCP tools (16 tools total):
  - `context7` — library documentation lookup
  - `grepsearch` — real-world code search via grep.app
  - `csearch` — multi-keyword codebase search with BM25 ranking (requires `rg`)
  - `observation`, `memory-search`, `memory-get`, `memory-read` — reduced project memory DB (SQLite, manual; no auto-capture)
  - `find_sessions`, `read_session` — ZCode session/task search
  - `srcwalk_read`, `srcwalk_deps`, `srcwalk_map`, `srcwalk_callers`, `srcwalk_callees`, `srcwalk_flow`, `srcwalk_impact` — code intelligence/navigation (grep-based)
  - `/structural-check` slash command (ported from `structural-check.sh`, adapted to the ZCode layout)

  > Reduced port: ZCode has no OpenCode event bus (`message.part.updated` / `messages.transform` / `tool.execute.before` / `system.transform` / `session.compacting` / `auth.provider.loader`), so memory tools are called manually — auto-capture/inject is not available.

  **6 OpenCode plugin files were NOT ported** (verified non-portable + user-approved drop):
  - `copilot-auth.ts` — uses OpenCode `auth.provider.loader` (ZCode manages auth via `credentials.json`/`v2/config.json`).
  - `prompt-leverage.ts` — uses `experimental.chat.messages.transform` (no equivalent in ZCode).
  - `rtk.ts`, `guard.ts` — use `tool.execute.before` (no equivalent in ZCode; permission gating is app-level via `permission{}` config).
  - `session-summary.ts` — uses `tool.execute.before` + `system.transform` + `session.compacting` (none exist in ZCode).
  - `skill-mcp.ts` — duplicates ZCode's native `mcpServers` plugin mechanism.

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
