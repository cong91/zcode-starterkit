#!/usr/bin/env node
// rtk hook — ported from opencode-starterkit baseline/plugin/rtk.ts.
// ZCode hook event: PreToolUse (rewrite bash/shell command for token savings).
//
// Requires: rtk >= 0.23.0 in PATH. If rtk is missing, the hook is a no-op.
// Reads JSON stdin, emits JSON stdout with modifiedToolInput when rtk rewrites.
// Plain JS (no TypeScript) so Node runs it directly.

import fs from 'node:fs'
import { execSync } from 'node:child_process'

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function rtkAvailable() {
  try {
    execSync('rtk --version', { stdio: 'ignore', timeout: 2000 })
    return true
  } catch { return false }
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

  const tool = String(input.tool_name || '').toLowerCase()
  const shellTools = ['bash', 'shell', 'execute_bash', 'run_command', 'terminal']
  if (!shellTools.includes(tool)) { noop(); return }
  const command = input.tool_input?.command
  if (typeof command !== 'string' || !command) { noop(); return }

  // Skip commands already routed through rtk (idempotency guard from donor)
  if (/^\s*(?:RTK_[A-Z_]+=\S+\s+)*rtk\b/.test(command)) { noop(); return }

  if (!rtkAvailable()) { noop(); return }

  try {
    const rewritten = execSync(`rtk rewrite ${JSON.stringify(command)}`, {
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (rewritten && rewritten !== command) {
      process.stdout.write(JSON.stringify({
        modifiedToolInput: { command: rewritten },
        hookSpecificOutput: { hookEventName: 'PreToolUse' },
      }) + '\n')
      process.exit(0)
      return
    }
  } catch { /* rtk rewrite failed — pass through */ }
  noop()
}

main()
