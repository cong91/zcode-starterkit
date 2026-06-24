#!/usr/bin/env node
// session-summary-persist hook — render the tracked summary to markdown on Stop.
// ZCode hook event: Stop.
//
// Ported from opencode-starterkit baseline/plugin/session-summary.ts
// (experimental.session.compacting persistence). Reads
// .zcode/state/session-summary.json and writes .zcode/state/session-summary.md.
// Plain JS (no TypeScript).

import fs from 'node:fs'
import path from 'node:path'

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function noop() {
  process.stdout.write('{}\n')
  process.exit(0)
}

function stateDir() {
  const cwd = process.env.ZCODE_PROJECT_DIR || process.env.CWD || process.cwd()
  return path.join(cwd, '.zcode', 'state')
}

function loadSummary() {
  try {
    const p = path.join(stateDir(), 'session-summary.json')
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch { return null }
}

function render(s) {
  const lines = [
    '---',
    'purpose: Anchored session summary (survives across turns)',
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    'source: generated-by-zcode-starterkit-session-summary-hook',
    '---',
    '',
    '# Session Summary',
    '',
  ]
  if (s.intent) { lines.push(`## Intent`, s.intent, '') }
  lines.push(`## State`, s.state || 'active', '')

  const readKeys = Object.keys(s.files.read || {})
  lines.push(`## Files Read (${readKeys.length})`)
  for (const f of readKeys) lines.push(`- ${f}`)
  if (readKeys.length === 0) lines.push('- (none)')
  lines.push('')

  const modEntries = Object.entries(s.files.modified || {})
  lines.push(`## Files Modified (${modEntries.length})`)
  for (const [f, detail] of modEntries) lines.push(`- ${f} — ${detail}`)
  if (modEntries.length === 0) lines.push('- (none)')
  lines.push('')

  const created = s.files.created || []
  lines.push(`## Files Created (${created.length})`)
  for (const f of created) lines.push(`- ${f}`)
  if (created.length === 0) lines.push('- (none)')
  lines.push('')

  const decisions = s.decisions || []
  lines.push(`## Decisions (${decisions.length})`)
  for (const d of decisions) lines.push(`- **${d.what}** — ${d.rationale}`)
  if (decisions.length === 0) lines.push('- (none)')
  lines.push('')

  const nextSteps = s.nextSteps || []
  lines.push(`## Next Steps (${nextSteps.length})`)
  for (const n of nextSteps) lines.push(`- ${n}`)
  if (nextSteps.length === 0) lines.push('- (none)')
  lines.push('')

  return lines.join('\n')
}

function main() {
  readStdin() // drain stdin (Stop payload unused for persist)
  const s = loadSummary()
  if (!s) { noop(); return }
  try {
    const dir = stateDir()
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'session-summary.md'), render(s), 'utf8')
  } catch { /* best-effort */ }
  noop()
}

main()
