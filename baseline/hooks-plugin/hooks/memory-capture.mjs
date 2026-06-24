#!/usr/bin/env node
// memory-capture hook — auto-track tool usage into the project memory DB.
// ZCode hook event: PostToolUse (runs after each tool call completes).
//
// ZCode analogue of OpenCode memory.ts capture stage. Persists observations to
// <cwd>/.zcode/memory.db (schema shared with the mcp-tools observation tool).
// Plain JS (no TypeScript).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function resolveMemoryDbPath() {
  if (process.env.ZCODE_MEMORY_DB_PATH) return process.env.ZCODE_MEMORY_DB_PATH
  const cwd = process.env.ZCODE_PROJECT_DIR || process.env.CWD || process.cwd()
  return path.join(cwd, '.zcode', 'memory.db')
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
  confidence TEXT CHECK(confidence IN ('high','medium','low')) DEFAULT 'high',
  source TEXT CHECK(source IN ('manual','curator','imported')) DEFAULT 'curator',
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  updated_at TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  title, subtitle, narrative, facts, concepts,
  content='observations', content_rowid='id',
  tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;
`

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function noop() {
  process.stdout.write('{}\n')
  process.exit(0)
}

function classify(toolName, input) {
  const t = toolName.toLowerCase()
  const ti = input.tool_input || {}
  const cmd = Array.isArray(ti.command) ? ti.command.join(' ') : typeof ti.command === 'string' ? ti.command : ''
  const filePath = String(ti.path || ti.file_path || '')

  if (['read', 'read_file', 'srcwalk_read', 'memory-read', 'grep', 'glob'].includes(t)) {
    return { type: 'discovery', title: `Agent read ${filePath || t}`, facts: `Tool ${t} accessed ${filePath || 'resource'}` }
  }
  if (['write', 'write_file', 'edit', 'create_file', 'apply'].includes(t)) {
    return { type: 'feature', title: `Agent edited ${filePath || t}`, facts: `Tool ${t} modified ${filePath || 'resource'}` }
  }
  if (['bash', 'shell', 'execute_bash', 'run_command', 'terminal'].includes(t) && cmd) {
    return { type: 'pattern', title: `Agent ran: ${cmd.slice(0, 80)}`, facts: `Shell command executed` }
  }
  return null
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) { noop(); return }
  let input
  try { input = JSON.parse(raw) } catch { noop(); return }

  const obs = classify(String(input.tool_name || ''), input)
  if (!obs) { noop(); return }

  try {
    const dbPath = resolveMemoryDbPath()
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(dbPath, { timeout: 5000 })
    try {
      db.exec(SCHEMA_SQL)
      const now = new Date()
      db.prepare(
        `INSERT INTO observations (type, title, facts, source, created_at, created_at_epoch)
         VALUES (?, ?, ?, 'curator', ?, ?)`,
      ).run(obs.type, obs.title, obs.facts, now.toISOString(), now.getTime())
    } finally {
      db.close()
    }
  } catch { /* best-effort capture — never break the session */ }
  noop()
}

main()
