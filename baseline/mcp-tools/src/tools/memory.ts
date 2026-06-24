// Memory tools (REDUCED port) for ZCode MCP server.
//
// OpenCode's memory plugin auto-captures messages via event hooks and injects
// knowledge via system.transform. ZCode has no such event bus, so this port is
// MANUAL ONLY: the agent explicitly calls `observation` to store a note and
// `memory-search`/`memory-get` to retrieve it. Graph/compact/admin/timeline/
// update tools are dropped (YAGNI for a manual baseline).
//
// Persistence: <cwd>/.zcode/memory.db (per-project), schema v3 subset.

import path from 'node:path'
import fs from 'node:fs'
import { Database } from '../db.js'

const VALID_TYPES = ['decision', 'bugfix', 'feature', 'pattern', 'discovery', 'learning', 'warning'] as const
const VALID_CONFIDENCE = ['high', 'medium', 'low'] as const

function resolveMemoryDbPath(): string {
  if (process.env.ZCODE_MEMORY_DB_PATH) return process.env.ZCODE_MEMORY_DB_PATH
  return path.join(process.cwd(), '.zcode', 'memory.db')
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('decision','bugfix','feature','pattern','discovery','learning','warning')),
  title TEXT NOT NULL,
  subtitle TEXT,
  facts TEXT,
  narrative TEXT,
  concepts TEXT,
  files_read TEXT,
  files_modified TEXT,
  confidence TEXT CHECK(confidence IN ('high','medium','low')) DEFAULT 'high',
  source TEXT CHECK(source IN ('manual','curator','imported')) DEFAULT 'manual',
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  updated_at TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  title, subtitle, narrative, facts, concepts,
  content='observations', content_rowid='id',
  tokenize='porter unicode61'
);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);
`

function ensureSchema(db: Database): void {
  db.exec(SCHEMA_SQL)
}

// FTS5 triggers to keep the index in sync with the table.
const TRIGGER_SQL = `
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;
CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, facts, concepts)
  VALUES ('delete', old.id, old.title, old.subtitle, old.narrative, old.facts, old.concepts);
END;
`

interface ObservationRow {
  id: number
  type: string
  title: string
  subtitle: string | null
  facts: string | null
  narrative: string | null
  concepts: string | null
  confidence: string | null
  created_at: string
}

function formatObservation(r: ObservationRow): string {
  const lines = [
    `## #${r.id} [${r.type}] ${r.title}${r.confidence ? ` (confidence: ${r.confidence})` : ''}`,
    r.subtitle ? `*${r.subtitle}*` : '',
    r.facts ? `**Facts:** ${r.facts}` : '',
    r.narrative ? `**Narrative:** ${r.narrative}` : '',
    r.concepts ? `**Concepts:** ${r.concepts}` : '',
    `*created: ${r.created_at}*`,
  ]
  return lines.filter(Boolean).join('\n')
}

// --- Tools ---

export const observationTool = {
  name: 'observation',
  description: `Store a structured observation (decision, bugfix, feature, pattern, discovery, learning, warning) into the project memory DB. Call this manually when you want to persist a durable note — there is no auto-capture on ZCode.

Example:
observation({ type: "decision", title: "Use pnpm", facts: "Repo uses pnpm-lock.yaml", confidence: "high" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: { type: 'string', enum: [...VALID_TYPES], description: 'Observation type' },
      title: { type: 'string', description: 'Short title' },
      subtitle: { type: 'string', description: 'Optional subtitle / context' },
      facts: { type: 'string', description: 'Concise factual statement' },
      narrative: { type: 'string', description: 'Longer narrative / explanation' },
      concepts: { type: 'string', description: 'Comma-separated concept tags' },
      confidence: { type: 'string', enum: [...VALID_CONFIDENCE], description: 'Confidence level (default high)' },
    },
    required: ['type', 'title'],
  },
}

async function observationExecute(args: {
  type: string
  title: string
  subtitle?: string
  facts?: string
  narrative?: string
  concepts?: string
  confidence?: string
}): Promise<string> {
  if (!VALID_TYPES.includes(args.type as (typeof VALID_TYPES)[number]))
    return `Error: invalid type "${args.type}". Valid: ${VALID_TYPES.join(', ')}`
  const confidence = args.confidence && VALID_CONFIDENCE.includes(args.confidence as (typeof VALID_CONFIDENCE)[number]) ? args.confidence : 'high'
  const now = new Date()
  const dbPath = resolveMemoryDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  try {
    ensureSchema(db)
    db.exec(TRIGGER_SQL)
    const result = db.run(
      `INSERT INTO observations (type, title, subtitle, facts, narrative, concepts, confidence, source, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
      args.type, args.title, args.subtitle ?? null, args.facts ?? null, args.narrative ?? null, args.concepts ?? null, confidence, now.toISOString(), now.getTime(),
    )
    return `Stored observation #${result.lastInsertRowid} [${args.type}]: ${args.title}`
  } finally {
    db.close()
  }
}

export const memorySearchTool = {
  name: 'memory-search',
  description: `Full-text search (FTS5, BM25) across stored observations in the project memory DB.

Example:
memory-search({ query: "pnpm dependency", limit: 5 })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 6, max 20)' },
    },
    required: ['query'],
  },
}

async function memorySearchExecute(args: { query: string; limit?: number }): Promise<string> {
  const trimmed = (args.query || '').trim()
  if (!trimmed) return 'Error: query is required'
  const limit = Math.min(args.limit ?? 6, 20)
  const dbPath = resolveMemoryDbPath()
  if (!fs.existsSync(dbPath)) return `No memory DB yet at ${dbPath}. Store an observation first.`
  const db = new Database(dbPath, { readonly: true })
  try {
    const rows = db.query<ObservationRow>(
      `SELECT o.id, o.type, o.title, o.subtitle, o.facts, o.narrative, o.concepts, o.confidence, o.created_at
       FROM observations_fts f
       JOIN observations o ON o.id = f.rowid
       WHERE observations_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    ).all(trimmed, limit)
    if (rows.length === 0) return `No observations matched "${trimmed}".`
    return `Found ${rows.length} observation(s) for "${trimmed}":\n\n` + rows.map(formatObservation).join('\n\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Error searching memory: ${message}`
  } finally {
    db.close()
  }
}

export const memoryGetTool = {
  name: 'memory-get',
  description: `Read a single observation by id.

Example:
memory-get({ id: 3 })`,
  inputSchema: {
    type: 'object' as const,
    properties: { id: { type: 'number', description: 'Observation id' } },
    required: ['id'],
  },
}

async function memoryGetExecute(args: { id: number }): Promise<string> {
  const dbPath = resolveMemoryDbPath()
  if (!fs.existsSync(dbPath)) return `No memory DB yet at ${dbPath}.`
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.query<ObservationRow>(
      `SELECT id, type, title, subtitle, facts, narrative, concepts, confidence, created_at FROM observations WHERE id = ?`,
    ).get(args.id)
    if (!row) return `Observation #${args.id} not found.`
    return formatObservation(row)
  } finally {
    db.close()
  }
}

export const memoryReadTool = {
  name: 'memory-read',
  description: `Read a markdown memory file from the project memory directory (.zcode/memory/). Use for human-curated context files (project.md, gotchas.md, etc.).

Example:
memory-read({ file: "project/project.md" })`,
  inputSchema: {
    type: 'object' as const,
    properties: { file: { type: 'string', description: 'Path relative to .zcode/memory/' } },
    required: ['file'],
  },
}

async function memoryReadExecute(args: { file: string }): Promise<string> {
  const rel = String(args.file || '').trim()
  if (!rel) return 'Error: file is required'
  const root = path.join(process.cwd(), '.zcode', 'memory')
  const full = path.resolve(root, rel)
  if (!full.startsWith(path.resolve(root) + path.sep) && full !== path.resolve(root))
    return `Error: path escape blocked (${rel})`
  if (!fs.existsSync(full)) return `File not found: ${path.join('.zcode', 'memory', rel)}`
  return fs.readFileSync(full, 'utf8')
}

export const memoryTools = [observationTool, memorySearchTool, memoryGetTool, memoryReadTool]

export const memoryExecute: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  observation: observationExecute as (a: Record<string, unknown>) => Promise<unknown>,
  'memory-search': memorySearchExecute as (a: Record<string, unknown>) => Promise<unknown>,
  'memory-get': memoryGetExecute as (a: Record<string, unknown>) => Promise<unknown>,
  'memory-read': memoryReadExecute as (a: Record<string, unknown>) => Promise<unknown>,
}
