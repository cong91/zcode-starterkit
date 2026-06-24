#!/usr/bin/env node
// prompt-leverage hook — upgrade the user prompt with structured framing.
// ZCode hook event: UserPromptSubmit.
//
// Ported from opencode-starterkit baseline/plugin/prompt-leverage.ts. Appends
// an execution-framing scaffold as additionalContext. Plain JS (no TypeScript).

import fs from 'node:fs'

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
  if (!prompt || prompt.length < 10) { noop(); return }

  const framing = [
    '<execution-framing>',
    'Before acting on this prompt, ensure you have:',
    '1. A clear objective — restate what the user wants as a concrete goal.',
    '2. Context — read the relevant files/commands before changing anything.',
    '3. Tool rules — prefer read tools before write tools; verify before claiming done.',
    '4. Verification — run the project\'s verify/test command after changes.',
    '5. Done criteria — state what "done" looks like before declaring success.',
    '</execution-framing>',
  ].join('\n')

  process.stdout.write(JSON.stringify({
    additionalContext: framing,
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit' },
  }) + '\n')
  process.exit(0)
}

main()
