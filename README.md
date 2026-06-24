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
- **`mcp-tools`** — an MCP server (`@modelcontextprotocol/sdk`) porting OpenCode baseline tools as manual MCP tools:
  - `context7` — library documentation lookup
  - `grepsearch` — real-world code search via grep.app
  - `csearch` — multi-keyword codebase search with BM25 ranking (requires `rg`)
  - `observation`, `memory-search`, `memory-get`, `memory-read` — reduced project memory DB (SQLite, manual; no auto-capture)
  - `find_sessions`, `read_session` — ZCode session/task search

  > Reduced port: ZCode has no OpenCode event bus (`message.part.updated` / `messages.transform`), so memory tools are called manually — auto-capture/inject is not available.

Config is additively merged into `~/.zcode/v2/config.json` (same `https://opencode.ai/config.json` schema). OpenCode-only `plugin[]` TS entries are stripped.

## Rebuilding the MCP bundle (developers)

The `mcp-tools` plugin ships a prebuilt `dist/mcp/server.js`. To rebuild after editing `baseline/mcp-tools/src/**/*.ts`:

```bash
cd baseline/mcp-tools
npm install
npm run build   # esbuild bundles to dist/mcp/server.js
```

See `docs/superpowers/specs/2026-06-24-zcode-starterkit-design.md` for the full design.
