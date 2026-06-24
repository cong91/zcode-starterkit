#!/usr/bin/env node
// session-summary-track hook — record file artifacts touched by the agent.
// ZCode hook event: PostToolUse.
//
// Ported from opencode-starterkit baseline/plugin/session-summary.ts
// (tool.execute.before file-artifact tracking). Persists to
// <cwd>/.zcode/state/session-summary.json. Plain JS (no TypeScript).

import fs from 'node:fs'
import path from 'node:path'

const MAX_READS = 40
const MAX_MODIFIED = 30
const MAX_CREATED = 20

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function noop() {
  process.stdout.write('{}\n')
  process.exit(0)
}

function summaryPath() {
  const cwd = process.env.ZCODE_PROJECT_DIR || process.env.CWD || process.cwd()
  return path.join(cwd, '.zcode', 'state', 'session-summary.json')
}

function emptySummary() {
  return { intent: '', state: 'active', files: { modified: {}, created: [], read: {} }, decisions: [], nextSteps: [] }
}

function loadSummary() {
  try {
    const p = summaryPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      data.files = data.files || { modified: {}, created: [], read: {} }
      data.files.modified = data.files.modified || {}
      data.files.created = data.files.created || []
      data.files.read = data.files.read || {}
      data.decisions = data.decisions || []
      data.nextSteps = data.nextSteps || []
      return data
    }
  } catch { /* corrupt — start fresh */ }
  return emptySummary()
}

function enforceLimits(s) {
  const readEntries = Object.entries(s.files.read)
  if (readEntries.length > MAX_READS) s.files.read = Object.fromEntries(readEntries.slice(readEntries.length - MAX_READS))
  const modEntries = Object.entries(s.files.modified)
  if (modEntries.length > MAX_MODIFIED) s.files.modified = Object.fromEntries(modEntries.slice(modEntries.length - MAX_MODIFIED))
  if (s.files.created.length > MAX_CREATED) s.files.created = s.files.created.slice(-MAX_CREATED)
}

function saveSummary(s) {
  try {
    const p = summaryPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf8')
  } catch { /* best-effort */ }
}

function classify(toolName, input) {
  const t = toolName.toLowerCase()
  const ti = input.tool_input || {}
  const file = String(ti.path || ti.file_path || '')
  if (['read', 'read_file', 'srcwalk_read', 'memory-read', 'grep', 'glob'].includes(t) && file) {
    return { kind: 'read', file, detail: '' }
  }
  if (['edit', 'write_file', 'apply'].includes(t) && file) {
    return { kind: 'modified', file, detail: typeof ti.new_string === 'string' ? ti.new_string.slice(0, 80) : 'edited' }
  }
  if (['create_file', 'write'].includes(t) && file) {
    return { kind: 'created', file, detail: '' }
  }
  return null
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) { noop(); return }
  let input
  try { input = JSON.parse(raw) } catch { noop(); return }

  const event = classify(String(input.tool_name || ''), input)
  if (!event) { noop(); return }

  const s = loadSummary()
  if (event.kind === 'read') {
    if (!(event.file in s.files.read)) s.files.read[event.file] = event.detail
  } else if (event.kind === 'modified') {
    s.files.modified[event.file] = event.detail
    s.files.created = s.files.created.filter((f) => f !== event.file)
  } else if (event.kind === 'created') {
    if (!s.files.created.includes(event.file)) s.files.created.push(event.file)
  }
  enforceLimits(s)
  saveSummary(s)
  noop()
}

main()
