#!/usr/bin/env node
// guard hook — ported from opencode-starterkit baseline/plugin/guard.ts.
// ZCode hook event: PreToolUse (and PermissionRequest for deny decisions).
//
// Reads JSON stdin: { hook_event_name, tool_name, tool_input: { command }, ... }
// Behavior:
//   - If tool is high-risk (rm -rf, sudo, git push --force, db:reset, etc.),
//     emit JSON { decision: "deny", reason: "..." } and exit 2 to block.
//   - Otherwise emit { decision: "allow" } and exit 0.
//
// This mirrors OpenCode guard.ts (tool.execute.before gating) using ZCode's
// PreToolUse/PermissionRequest shell-hook surface. Plain JS (no TypeScript) so
// Node can run it directly as an .mjs hook.

import fs from 'node:fs'

const HIGH_RISK_PATTERNS = [
  { re: /\brm\s+-rf?\b/, reason: 'rm -rf is destructive and blocked by guard hook' },
  { re: /\bsudo\b/, reason: 'sudo is blocked by guard hook' },
  { re: /git\s+push\s+.*--force/, reason: 'git push --force is blocked by guard hook' },
  { re: /git\s+push\s+-f\b/, reason: 'git push -f is blocked by guard hook' },
  { re: /npm\s+run\s+db:reset/, reason: 'db:reset is destructive and blocked by guard hook' },
  { re: /git\s+reset\s+--hard/, reason: 'git reset --hard is destructive and blocked by guard hook' },
  { re: /git\s+clean\s+-[a-z]*d/, reason: 'git clean -d removes untracked files; blocked by guard hook' },
  { re: /DROP\s+(TABLE|DATABASE|SCHEMA)/i, reason: 'DROP statement is destructive and blocked by guard hook' },
  { re: /TRUNCATE\s+TABLE/i, reason: 'TRUNCATE is destructive and blocked by guard hook' },
]

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function emitAllow() {
  process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n')
  process.exit(0)
}

function emitDeny(reason) {
  process.stdout.write(JSON.stringify({ decision: 'deny', reason, hookSpecificOutput: { hookEventName: 'PreToolUse' } }) + '\n')
  process.exit(2)
}

function main() {
  const raw = readStdin()
  if (!raw.trim()) { emitAllow(); return }
  let input
  try { input = JSON.parse(raw) } catch { emitAllow(); return }

  const toolName = String(input.tool_name || '').toLowerCase()
  const toolInput = input.tool_input || {}
  const cmdRaw = toolInput.command
  const commandStr = Array.isArray(cmdRaw) ? cmdRaw.join(' ') : typeof cmdRaw === 'string' ? cmdRaw : ''

  const shellTools = ['bash', 'shell', 'execute_bash', 'run_command', 'terminal']
  if (!shellTools.includes(toolName) || !commandStr) { emitAllow(); return }

  for (const { re, reason } of HIGH_RISK_PATTERNS) {
    if (re.test(commandStr)) { emitDeny(reason); return }
  }
  emitAllow()
}

main()
