---
name: codebase-memory
description: MUST load for code intelligence — call graphs (callers/callees, depth-aware), dead-code detection, Cypher queries, architecture overview, cross-service HTTP linking, type-aware calls across 158 languages. Prefer over srcwalk for structural code navigation. Primary code-intelligence backend — prefer over codegraph/srcwalk for any non-trivial structural query.
---

# Codebase-Memory Skill

High-performance code intelligence MCP server. Pure-C single static binary indexes a codebase into a persistent knowledge graph (tree-sitter + Hybrid LSP type resolution). Answers structural queries in under 1ms. 158 languages, 14 MCP tools, Cypher query support, 3D graph visualization. Local-only — your code never leaves the machine.

## Prerequisites

- `codebase-memory-mcp` binary installed at `~/.local/bin/codebase-memory-mcp` (or on PATH)
- Install: `codebase-memory-mcp install` (auto-detects and configures ZCode/OpenCode/agents)
- Or: download from https://github.com/DeusData/codebase-memory-mcp/releases
- MCP server enabled in `~/.zcode/v2/config.json` (ZCode) or `~/.config/opencode/opencode.json` (OpenCode)
- Verify: `codebase-memory-mcp --version` (the starterkit `install --with-codebase-memory` auto-installs)

## When to Use

| Scenario | Tool | Why |
| --- | --- | --- |
| Trace who calls a function (and transitively) | `trace_path` | BFS depth 1-5, inbound/outbound, type-aware |
| Find dead code (functions with zero callers) | `query_graph` | Cypher `WHERE NOT EXISTS { (f)<-[:CALLS]-() }` |
| Architecture overview of a repo | `get_architecture` | languages, packages, entrypoints, hotspots, clusters |
| Search symbols by name pattern / degree | `search_graph` | regex name, label filter, file scope, min/max degree |
| Run graph queries (Cypher) | `query_graph` | openCypher read subset: MATCH, WHERE, RETURN, aggregates |
| Code search (grep-like, indexed only) | `search_code` | graph-augmented grep over indexed files |
| Read a function's source by qualified name | `get_code_snippet` | exact code for a graph node |
| Map uncommitted git changes to affected symbols | `detect_changes` | blast radius with risk classification |
| Persist architectural decisions across sessions | `manage_adr` | CRUD for Architecture Decision Records |
| Discover node/edge schema before querying | `get_graph_schema` | labels, edge types, property definitions |

## When NOT to Use

- **Decisional memory** (decisions, bugfixes, patterns, handoffs) → use `memory-system` / `memory-search`. Codebase-Memory is structural code intelligence, NOT decisional memory — different layer.
- **Reading a single small known file** → use built-in `read` or `srcwalk_read` (range reads). Codebase-Memory queries the graph, not raw file I/O.
- **Simple text grep across files** → use `grep` / `csearch`. `search_code` is indexed-only (faster on large repos but scoped to indexed files).
- **Directory tree / token budget** → use `srcwalk_map` (Codebase-Memory has no directory-tree tool).

## Tool Selection (3 memory layers — pick the right one)

| Need | Use |
| --- | --- |
| "Why was X decided?" / "What did we learn last session?" | `memory-system` (decisional, FTS5) |
| "Who calls `installGlobal`?" / "Is this function dead?" / "Show me the architecture" | `codebase-memory` (structural graph) |
| "Read lines 44-89 of src/foo.ts" | `read` / `srcwalk_read` (file I/O) |

## Tool Surface (14 MCP tools)

### Indexing
| Tool | Description |
| --- | --- |
| `index_repository` | Index a repo into the graph. Auto-sync keeps it fresh. |
| `list_projects` | List all indexed projects with node/edge counts. |
| `delete_project` | Remove a project and all its graph data. |
| `index_status` | Check indexing status of a project. |

### Querying
| Tool | Description |
| --- | --- |
| `search_graph` | Structured search: label, name pattern, file pattern, degree filters. |
| `trace_path` | BFS traversal — who calls a function and what it calls. Depth 1-5. |
| `detect_changes` | Map git diff to affected symbols + blast radius + risk. |
| `query_graph` | Execute Cypher-like graph queries (read-only openCypher subset). |
| `get_graph_schema` | Node/edge counts, relationship patterns, property definitions. Run this first. |
| `get_code_snippet` | Read source code for a function by qualified name. |
| `get_architecture` | Codebase overview: languages, packages, routes, hotspots, clusters, ADR. |
| `search_code` | Grep-like text search within indexed project files. |
| `manage_adr` | CRUD for Architecture Decision Records. |
| `ingest_traces` | Ingest runtime traces to validate HTTP_CALLS edges. |

## Default Workflows

### First time on a repo

```
index_repository({ repo_path: "<absolute-forward-slash-path>" })
list_projects()                              // confirm indexed
get_graph_schema({ project: "<name>" })      // learn the shape
get_architecture({ project: "<name>" })       // languages, packages, hotspots
```

### Trace a call graph

```
trace_path({ project: "<name>", function_name: "installGlobal", direction: "inbound", depth: 3 })
trace_path({ project: "<name>", function_name: "installGlobal", direction: "outbound", depth: 2 })
```

### Find dead code

```
query_graph({ project: "<name>", query: "MATCH (f:Function) WHERE NOT EXISTS { (f)<-[:CALLS]-() } RETURN f.name LIMIT 50" })
```

### Find symbols + drill in

```
search_graph({ project: "<name>", name_pattern: "merge.*", label: "Function" })
get_code_snippet({ project: "<name>", qualified_name: "<from search result>" })
```

## ⚠️ Windows Path Quirk

`index_repository` and `cli` commands **FAIL with backslash Windows paths** (`C:\Users\...`). Always use **forward slashes** (`C:/Users/...`). The MCP `repo_path` parameter and the `cli` JSON `repo_path` must both be forward-slash. This is a known upstream quirk; the starterkit's install/index paths already use forward-slash.

## Command Routing

| Intent | Use first |
| --- | --- |
| Understand repo architecture | `get_architecture` |
| Who calls X? (direct + transitive) | `trace_path` direction=inbound |
| What does X call? | `trace_path` direction=outbound |
| Is X dead code? | `query_graph` (Cypher NOT EXISTS) |
| Find symbols by name | `search_graph` |
| Read a function's source | `get_code_snippet` (qualified name) |
| Text search in indexed files | `search_code` |
| What changed + blast radius | `detect_changes` |
| Persist architectural decision | `manage_adr` |

## CLI Mode

Every MCP tool can run from the command line (no MCP client needed):

```bash
codebase-memory-mcp cli index_repository '{"repo_path":"C:/path/to/repo"}'
codebase-memory-mcp cli list_projects
codebase-memory-mcp cli search_graph '{"project":"<name>","name_pattern":".*Handler.*","label":"Function"}'
codebase-memory-mcp cli trace_path '{"project":"<name>","function_name":"Search","direction":"both"}'
codebase-memory-mcp cli query_graph '{"project":"<name>","query":"MATCH (f:Function) RETURN f.name LIMIT 5"}'
```

Index storage: `~/.cache/codebase-memory-mcp/` (global, NOT per-project — no `.gitignore` entry needed).

## Setup

```bash
# Auto-install (recommended) — auto-configures ZCode/OpenCode + agents
codebase-memory-mcp install

# Or manual binary download from
# https://github.com/DeusData/codebase-memory-mcp/releases
```

Security: every release binary is SLSA-3 provenance, sigstore-signed, VirusTotal-scanned (0/72), SHA-256 checksummed. 100% local — no telemetry.

## See Also

- `srcwalk` — file reads, range reads, directory maps (Codebase-Memory has no file-I/O tools)
- `memory-system` — decisional memory (decisions/bugfixes/patterns), a different layer
- `code-navigation` — general navigation guidance
