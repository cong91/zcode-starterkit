---
name: srcwalk
compatible_srcwalk: ">=1.0.0"
description: Use when navigating code with srcwalk — repo maps, large-file reads, symbol search, callers/callees, flow slices, impact checks, and precise drill-ins.
version: 2.1.0
tags: [code-intelligence, search, cli, srcwalk]
dependencies: []
agent_types: [planner, worker, reviewer, explorer]
tools: [bash, srcwalk_read, srcwalk_deps, srcwalk_map, srcwalk_callers, srcwalk_callees, srcwalk_flow, srcwalk_impact]
---

# Srcwalk — Code Navigation

Srcwalk is the project's code navigation engine (v1.0.0+). All Pi tools are backed by the installed `srcwalk` binary.

Run the embedded guide before non-trivial use — it is the version-matched source of truth:

```bash
srcwalk guide
```

Do not pipe, truncate, or summarize `srcwalk guide`.

## When to Use

- Any code navigation task: symbol search, large-file reading, repo maps
- Tracing call graphs (callers, callees, transitive chains)
- Checking blast radius before breaking changes
- Understanding repo shape and token budgets
- Quick function orientation (flow slice)
- Heuristic impact triage

## When NOT to Use

- Non-code files where tree-sitter has no grammar → use `read` directly
- Simple one-off reads of small known files → use built-in `read`

## Pi Tool Surface

### Core navigation tools

| Tool | Srcwalk command | Purpose |
|---|---|---|
| `srcwalk_read` | `srcwalk <path>` | Smart file reading: outline or full with sections |
| `srcwalk_deps` | `srcwalk deps` + exact import scan | Blast-radius: importers + dep-aware dependents (v1.0.0) |

### Extended analysis tools

| Tool | Srcwalk command | Purpose |
|---|---|---|
| `srcwalk_map` | `srcwalk overview` | Token-annotated directory skeleton + dep groups (v1.0.0) |
| `srcwalk_callers` | `srcwalk trace callers` | Reverse call graph with BFS depth + filters |
| `srcwalk_callees` | `srcwalk trace callees` | Forward call graph with `--detailed` ordered call sites |
| `srcwalk_flow` | `srcwalk context` | Compact orientation slice |
| `srcwalk_impact` | `srcwalk assess` | Heuristic blast-radius triage |

## Command Routing

| Intent | Use first |
|---|---|
| Understand repo shape | `srcwalk_map` |
| Read or inspect a large file | `srcwalk_read` |
| Jump to exact line | `srcwalk_read({ path: "file:42" })` |
| Read a line range | `srcwalk_read({ path: "file:44-89" })` — v1.0.0 shortcut |
| Read by symbol name | `srcwalk_read({ section: "symbolName" })` |
| Find patterns and symbols | `grep` (exact), `csearch` (multi-keyword) |
| Find files by glob | `glob` |
| Multi-symbol search | `grep({ pattern: "A|B|C" })` |
| Who directly calls this? | `srcwalk_callers` |
| Who reaches this transitively? | `srcwalk_callers({ depth: 2 })` |
| What does this call? | `srcwalk_callees` |
| Ordered calls + arg slots | `srcwalk_callees({ detailed: true })` |
| Quick orientation slice | `srcwalk_flow` |
| File imports and dependents | `srcwalk_deps` |
| Heuristic blast-radius | `srcwalk_impact` (verify with callers) |

## Default Workflows

### Explore unfamiliar code

```
srcwalk_map({ scope: "." })
grep({ pattern: "likely_symbol", path: "src/" })
srcwalk_read({ path: "src/file.ts:42" })         // jump to line
srcwalk_read({ path: "src/file.ts:44-89" })      // range shortcut (v1.0.0)
```

### Read a large file

```
srcwalk_read({ path: "src/file.ts" })                        // structural outline
srcwalk_read({ path: "src/file.ts", section: "handleAuth" }) // drill into symbol
srcwalk_read({ path: "src/file.ts", section: "44-89" })      // exact range
```

Prefer outline/section reads before `full: true`.

### Find and drill into symbols

```
grep({ pattern: "handleAuth", path: "src/" })
grep({ pattern: "A|B|C", path: "src/" })                     // multi-symbol
csearch({ query: "auth token login middleware" })          // multi-keyword chunk search
```

### Trace call graph

```
// upstream
srcwalk_callers({ symbol: "handleAuth", scope: "src" })
srcwalk_callers({ symbol: "handleAuth", depth: 2, scope: "src" })      // transitive
srcwalk_callers({ symbol: "handleAuth", filter: "args:3", scope: "src" })
srcwalk_callers({ symbol: "handleAuth", countBy: "file", scope: "src" })

// downstream
srcwalk_callees({ symbol: "handleAuth", scope: "src" })
srcwalk_callees({ symbol: "handleAuth", detailed: true, scope: "src" }) // ordered sites
srcwalk_callees({ symbol: "handleAuth", depth: 2, scope: "src" })       // transitive

// quick orientation
srcwalk_flow({ symbol: "handleAuth", scope: "src" })
```

Use `grep` for quick single-hop searches. Use `srcwalk_callers` when you need depth, filters, or aggregation.

> Note: `--count-by` and `--depth` are mutually exclusive in `srcwalk_callers` — use one or the other, not both.

### Check file blast radius

```
srcwalk_deps({ path: "src/auth.ts" })
srcwalk_impact({ symbol: "handleAuth", scope: "src" })  // heuristic; follow up with callers
```

## v1.0.0 Features

- **Path range shortcut**: `srcwalk_read({ path: "file:start-end" })` reads a line range directly — no need to pass `section` separately
- **Dependency-aware map**: `srcwalk_map` now shows local relation groups and outbound dependency previews for narrowed scopes
- **JS/TS artifact navigation**: bundle anchors, artifact reads, artifact search snippets, and artifact caller/callee support
- **Improved UX**: more compact semantic rows, directory grouping, footer tips, and clearer scope/depth wording across all commands

## Critical Rules

- **Do NOT** use built-in `read`/`find` when srcwalk_* tools can answer; `grep` is preferred for text searches
- `srcwalk_impact` is heuristic, not proof — verify with `srcwalk_callers` or exact reads
- `srcwalk_flow` may collapse nested/fluent chains — drill with `srcwalk_callees({ detailed: true })` when inner calls matter
- Follow `> Next:` footers in output — they suggest the best next command
- Scope paths are **relative to Pi's CWD** (`.pi/` in this project). Use `scope: "extensions"` not `scope: ".pi/extensions"`

## Supported Languages

Rust, TypeScript, TSX, JavaScript, Python, Go, Java, Scala, C, C++, Ruby, PHP, C#, Swift, Elixir, Kotlin. Unsupported files still get smart text/outline reads.

## Setup

The srcwalk plugin is exposed as MCP tools by `the mcp-tools plugin (srcwalk_* MCP tools)`. Available when the mcp-tools plugin is enabled.

All scope paths are relative to the **project root directory**. The default scope resolves from the project root.
