#!/usr/bin/env node
// memory-inject hook — inject relevant past observations into context.
// ZCode hook event: UserPromptSubmit.
//
// ZCode analogue of OpenCode memory.ts LTM-injection stage. Searches the
// project memory DB for observations relevant to the prompt and appends them
// via additionalContext. Plain JS (no TypeScript).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function resolveMemoryDbPath() {
  if (process.env.ZCODE_MEMORY_DB_PATH) return process.env.ZCODE_MEMORY_DB_PATH
  const cwd = process.env.ZCODE_PROJECT_DIR || process.env.CWD || process.cwd()
  return path.join(cwd, '.zcode', 'memory.db')
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function noop() {
  process.stdout.write('{}\n')
  process.exit(0)
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) { noop(); return }
  let input
  try { input = JSON.parse(raw) } catch { noop(); return }

  const prompt = String(input.prompt || '').trim()
  if (!prompt) { noop(); return }

  const dbPath = resolveMemoryDbPath()
  if (!fs.existsSync(dbPath)) { noop(); return }

  let rows = []
  try {
    const { DatabaseSync } = require('node:sqlite')
    const db = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 })
    try {
      const words = prompt.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5).join(' ')
      if (!words) { noop(); return }
      rows = db.prepare(
        `SELECT o.id, o.type, o.title, o.facts FROM observations_fts f
         JOIN observations o ON o.id = f.rowid
         WHERE observations_fts MATCH ? ORDER BY rank LIMIT 5`,
      ).all(words)
    } finally {
      db.close()
    }
  } catch { noop(); return }

  if (!rows || rows.length === 0) { noop(); return }

  const context = [
    '<memory-context>',
    `Past observations relevant to your current prompt (auto-injected by zcode-starterkit memory-inject hook):`,
    ...rows.map((r) => `- [#${r.id} ${r.type}] ${r.title}${r.facts ? ` — ${r.facts}` : ''}`),
    'Use these as background; verify against the current codebase before relying on them.',
    '</memory-context>',
  ].join('\n')

  process.stdout.write(JSON.stringify({
    additionalContext: context,
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit' },
  }) + '\n')
  process.exit(0)
}

main()
