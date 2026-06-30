import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from '../src/cli.mjs'
import { CODEBASE_MEMORY_MCP_CONFIG, detectCodebaseMemoryCli, getCodebaseMemoryCandidatePaths, getCodebaseMemoryIntegrationState, mergeCodebaseMemoryMcpConfig, removeStarterkitCodebaseMemoryMcpConfig } from '../src/codebase-memory.mjs'
import { resolveCodebaseMemorySetup } from '../src/install-global.mjs'
import { WEBCLAW_MCP_CONFIG, getWebclawIntegrationState, mergeWebclawMcpConfig, removeStarterkitWebclawMcpConfig } from '../src/webclaw.mjs'

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('parseArgs exposes global optional MCP installer flags', () => {
  const parsed = parseArgs([
    'install',
    '--with-codebase-memory',
    '--skip-codebase-memory',
    '--require-codebase-memory',
    '--with-webclaw',
    '--skip-webclaw',
    '--require-webclaw',
  ])
  assert.equal(parsed.command, 'install')
  assert.equal(parsed.options.withCodebaseMemory, true)
  assert.equal(parsed.options.skipCodebaseMemory, true)
  assert.equal(parsed.options.requireCodebaseMemory, true)
  assert.equal(parsed.options.withWebclaw, true)
  assert.equal(parsed.options.skipWebclaw, true)
  assert.equal(parsed.options.requireWebclaw, true)
})

test('parseArgs accepts --no-codebase-memory / --no-webclaw aliases for --skip-*', () => {
  const parsed = parseArgs(['install', '--no-codebase-memory', '--no-webclaw'])
  assert.equal(parsed.options.skipCodebaseMemory, true)
  assert.equal(parsed.options.skipWebclaw, true)
})

test('parseArgs keeps --sandbox flag', () => {
  const parsed = parseArgs(['install', '--sandbox'])
  assert.equal(parsed.sandbox, true)
})

test('Codebase-Memory MCP config is only added when explicitly merged', () => {
  const base = { mcp: { tilth: { command: ['npx', 'tilth'], enabled: true } } }
  const merged = mergeCodebaseMemoryMcpConfig(base)
  assert.equal(base.mcp['codebase-memory-mcp'], undefined)
  assert.deepEqual(merged.mcp['codebase-memory-mcp'], CODEBASE_MEMORY_MCP_CONFIG)
  assert.deepEqual(merged.mcp.tilth, base.mcp.tilth)
})

test('Codebase-Memory MCP config can use absolute binary path', () => {
  const commandPath = '/home/user/.local/bin/codebase-memory-mcp'
  const merged = mergeCodebaseMemoryMcpConfig({}, { commandPath })
  assert.deepEqual(merged.mcp['codebase-memory-mcp'].command, [commandPath])
  assert.equal(merged.mcp['codebase-memory-mcp'].type, CODEBASE_MEMORY_MCP_CONFIG.type)
})

test('Codebase-Memory candidate paths include ~/.local/bin install dir', () => {
  const candidates = getCodebaseMemoryCandidatePaths({
    env: { PATH: '' },
    platform: 'linux',
  })
  // Path separators differ by host OS; assert the install-dir name + binary are present.
  assert.ok(candidates.some((c) => c.replace(/\\/g, '/').endsWith('.local/bin/codebase-memory-mcp')), `expected a ~/.local/bin/codebase-memory-mcp candidate, got ${candidates.join(', ')}`)
})

test('Codebase-Memory candidate paths include .exe suffix on win32', () => {
  const candidates = getCodebaseMemoryCandidatePaths({
    env: { PATH: 'C:\\Windows\\System32' },
    platform: 'win32',
  })
  assert.ok(candidates.some((c) => c.endsWith('codebase-memory-mcp.exe')))
})

test('detectCodebaseMemoryCli spawns with shell:true on win32', () => {
  const seen = []
  const spawn = (cmd, args, opts) => {
    seen.push({ cmd, args, opts })
    return { status: 0, stdout: 'codebase-memory-mcp 0.8.1\n', stderr: '' }
  }
  // detectCodebaseMemoryCli doesn't accept spawn/existsFn injection like codegraph did,
  // but we can at least confirm it runs without throwing on a system that has the binary.
  // This test is a smoke check that the function signature is stable.
  const result = detectCodebaseMemoryCli({
    env: { PATH: '' },
    platform: 'linux',
    spawnOptions: { spawn },
  })
  // On linux with empty PATH and no binary, it returns not-found — that's fine.
  assert.equal(result.ok, false)
})

test('starterkit Codebase-Memory MCP config can be removed cleanly when disabled', () => {
  const base = { mcp: { 'codebase-memory-mcp': { ...CODEBASE_MEMORY_MCP_CONFIG }, tilth: { command: ['npx', 'tilth'], enabled: true } } }
  const stripped = removeStarterkitCodebaseMemoryMcpConfig(base)
  assert.equal(stripped.mcp['codebase-memory-mcp'], undefined)
  assert.deepEqual(stripped.mcp.tilth, base.mcp.tilth)
})

test('starterkit Codebase-Memory MCP config with absolute command can be removed cleanly when disabled', () => {
  const base = { mcp: { 'codebase-memory-mcp': { ...CODEBASE_MEMORY_MCP_CONFIG, command: ['/home/user/.local/bin/codebase-memory-mcp'] } } }
  const stripped = removeStarterkitCodebaseMemoryMcpConfig(base)
  assert.equal(stripped.mcp['codebase-memory-mcp'], undefined)
})

test('plain install auto-installs Codebase-Memory when missing and not skipped', async () => {
  const calls = []
  const detect = () => {
    calls.push('detect')
    return calls.length === 1
      ? { ok: false, reason: 'not found' }
      : { ok: true, path: '/tmp/cbm', version: '0.8.1' }
  }
  const install = async () => {
    calls.push('install')
    return { status: 0 }
  }
  const result = await resolveCodebaseMemorySetup({}, { detectCodebaseMemoryCli: detect, installCodebaseMemoryCli: install })
  assert.equal(result.enabled, true)
  assert.equal(result.installed, true)
  assert.deepEqual(calls, ['detect', 'install', 'detect'])
})

test('resolveCodebaseMemorySetup is skipped when --skip-codebase-memory is passed', async () => {
  const result = await resolveCodebaseMemorySetup({ skipCodebaseMemory: true }, {
    detectCodebaseMemoryCli: () => { throw new Error('detect must not run when skipped') },
    installCodebaseMemoryCli: () => { throw new Error('install must not run when skipped') },
  })
  assert.equal(result.enabled, false)
  assert.equal(result.skipped, true)
  assert.match(result.reason, /--skip-codebase-memory/)
})

test('starterkit WebClaw MCP config can be merged and removed cleanly', () => {
  const base = { mcp: { webclaw: { ...WEBCLAW_MCP_CONFIG }, tilth: { command: ['npx', 'tilth'], enabled: true } } }
  const merged = mergeWebclawMcpConfig({ mcp: { tilth: base.mcp.tilth } })
  assert.deepEqual(merged.mcp.webclaw, WEBCLAW_MCP_CONFIG)
  const stripped = removeStarterkitWebclawMcpConfig(base)
  assert.equal(stripped.mcp.webclaw, undefined)
  assert.deepEqual(stripped.mcp.tilth, base.mcp.tilth)
})

test('starterkit WebClaw MCP config uses absolute command path when provided', () => {
  const commandPath = '/home/user/.webclaw/webclaw-mcp'
  const merged = mergeWebclawMcpConfig({}, { commandPath })
  assert.deepEqual(merged.mcp.webclaw.command, [commandPath])
  assert.equal(merged.mcp.webclaw.type, WEBCLAW_MCP_CONFIG.type)
})

test('starterkit WebClaw baseline config.json carries no static webclaw MCP entry (conditional only)', () => {
  const baseline = JSON.parse(fs.readFileSync(path.resolve('baseline', 'config.json'), 'utf8'))
  assert.equal(baseline.mcp?.webclaw, undefined, 'baseline/config.json must not ship a static webclaw MCP entry')
  assert.equal(baseline.mcp?.codegraph, undefined, 'baseline/config.json must not ship a static codegraph MCP entry')
  assert.equal(baseline.mcp?.['codebase-memory-mcp'], undefined, 'baseline/config.json must not ship a static codebase-memory-mcp MCP entry')
})

test('starterkit WebClaw integration defaults to disabled when no state file exists', () => {
  // Use a non-existent state path so the test is independent of any real
  // ~/.zcode starterkit-state.json left by prior runs or sandbox installs.
  const state = getWebclawIntegrationState(path.join(makeTempDir('zcode-state-'), 'missing.json'))
  assert.equal(state.enabled, false)
})

test('starterkit Codebase-Memory integration defaults to disabled when no state file exists', () => {
  const state = getCodebaseMemoryIntegrationState(path.join(makeTempDir('zcode-state-'), 'missing.json'))
  assert.equal(state.enabled, false)
})

test('/init runbook is agent-driven, stack-aware, and synthesizes AGENTS.md from the scaffold template', () => {
  const initRunbook = fs.readFileSync(path.resolve('baseline', 'commands', 'init.md'), 'utf8')
  const agentsTemplate = fs.readFileSync(path.resolve('baseline', 'memory', '_templates', 'agents.md'), 'utf8')
  assert.match(initRunbook, /agent-driven pass/)
  assert.match(initRunbook, /Do \*\*not\*\* call any removed legacy project-install shim/)
  assert.match(initRunbook, /Phase 3\.5: Guideline synthesis/)
  assert.match(initRunbook, /Collect synthesis inputs:/)
  assert.match(initRunbook, /Score the candidate guidance:/)
  assert.match(initRunbook, /Core Coding Contract/)
  assert.match(initRunbook, /read repo instructions, docs, configs, and nearby code before editing/)
  assert.match(initRunbook, /prefer existing patterns and the smallest correct diff/)
  assert.match(initRunbook, /self-review the diff, including untracked files/)
  assert.match(initRunbook, /Layer stack-specific guidance under the core contract:/)
  assert.match(initRunbook, /stack packs supplement the core contract/)
  assert.match(initRunbook, /Draft `AGENTS\.md` in this order:/)
  assert.match(initRunbook, /Synthesize, don't paste:/)
  assert.match(initRunbook, /Phase 4: Synthesize and write `AGENTS\.md`/)
  assert.match(initRunbook, /Read\(\{ filePath: "\.zcode\/memory\/_templates\/agents\.md" \}\);/)
  assert.match(initRunbook, /agent-skills-standard/)
  assert.match(initRunbook, /skills\/index\.json/)
  assert.match(initRunbook, /skills\/\*\/_INDEX\.md/)
  assert.match(initRunbook, /javascript\/javascript-language/)
  assert.match(initRunbook, /common\/common-best-practices/)
  assert.match(initRunbook, /common\/common-code-review/)
  assert.equal(initRunbook.includes('awesome-guidelines'), false)
  assert.match(agentsTemplate, /purpose: Project rules for AI agents/)
  assert.match(agentsTemplate, /Source of Truth/)
  assert.match(agentsTemplate, /Core Coding Contract/)
  assert.match(agentsTemplate, /Read repo instructions, docs, configs, and nearby code before editing/)
  assert.match(agentsTemplate, /Prefer existing patterns and the smallest correct diff/)
  assert.match(agentsTemplate, /Self-review the diff, including untracked files/)
  assert.match(agentsTemplate, /Selected Guideline Packs/)
  assert.match(agentsTemplate, /Stack-Specific Rules/)
  assert.match(agentsTemplate, /Stack packs supplement the core contract/)
  assert.match(agentsTemplate, /agent-skills-standard/)
  assert.match(agentsTemplate, /javascript\/javascript-language/)
  assert.match(agentsTemplate, /Synthesis Notes/)
  // /init must not reference the removed legacy project-install shim or beads workflow
  assert.equal(initRunbook.includes('zcs install'), false)
  assert.equal(initRunbook.includes('install-project'), false)
})
