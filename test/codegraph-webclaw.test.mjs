import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs } from '../src/cli.mjs'
import { CODEGRAPH_MCP_CONFIG, CODEGRAPH_PACKAGE, detectCodegraphCli, getCodegraphCandidatePaths, getCodegraphIntegrationState, installCodegraphCli, installCodegraphGitHooks, mergeCodegraphMcpConfig, removeStarterkitCodegraphMcpConfig } from '../src/codegraph.mjs'
import { resolveCodegraphSetup } from '../src/install-global.mjs'
import { WEBCLAW_MCP_CONFIG, getWebclawIntegrationState, mergeWebclawMcpConfig, removeStarterkitWebclawMcpConfig } from '../src/webclaw.mjs'

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

test('parseArgs exposes global optional MCP installer flags', () => {
  const parsed = parseArgs([
    'install',
    '--with-codegraph',
    '--skip-codegraph',
    '--require-codegraph',
    '--allow-codegraph-hooks',
    '--with-webclaw',
    '--skip-webclaw',
    '--require-webclaw',
  ])
  assert.equal(parsed.command, 'install')
  assert.equal(parsed.options.withCodegraph, true)
  assert.equal(parsed.options.skipCodegraph, true)
  assert.equal(parsed.options.requireCodegraph, true)
  assert.equal(parsed.options.allowCodegraphHooks, true)
  assert.equal(parsed.options.withWebclaw, true)
  assert.equal(parsed.options.skipWebclaw, true)
  assert.equal(parsed.options.requireWebclaw, true)
})

test('parseArgs accepts --no-codegraph / --no-webclaw aliases for --skip-*', () => {
  const parsed = parseArgs(['install', '--no-codegraph', '--no-webclaw'])
  assert.equal(parsed.options.skipCodegraph, true)
  assert.equal(parsed.options.skipWebclaw, true)
})

test('parseArgs keeps --sandbox flag', () => {
  const parsed = parseArgs(['install', '--sandbox'])
  assert.equal(parsed.sandbox, true)
})

test('CodeGraph MCP config is only added when explicitly merged', () => {
  const base = { mcp: { tilth: { command: ['npx', 'tilth'], enabled: true } } }
  const merged = mergeCodegraphMcpConfig(base)
  assert.equal(base.mcp.codegraph, undefined)
  assert.deepEqual(merged.mcp.codegraph, CODEGRAPH_MCP_CONFIG)
  assert.deepEqual(merged.mcp.tilth, base.mcp.tilth)
})

test('CodeGraph MCP config can use absolute npm-global shim path', () => {
  const commandPath = 'C:\\Users\\PC\\AppData\\Roaming\\npm\\codegraph.cmd'
  const merged = mergeCodegraphMcpConfig({}, { commandPath })
  assert.deepEqual(merged.mcp.codegraph.command, [commandPath, 'serve', '--mcp'])
})

test('CodeGraph Windows candidate paths include npm global bin dirs outside PATH', () => {
  const spawn = (cmd, args) => {
    assert.equal(cmd, 'npm')
    if (args.join(' ') === 'bin -g') return { status: 0, stdout: 'C:\\Users\\PC\\AppData\\Roaming\\npm\\n' }
    if (args.join(' ') === 'prefix -g') return { status: 0, stdout: 'C:\\Users\\PC\\AppData\\Roaming\\npm\\n' }
    return { status: 1, stdout: '', stderr: 'unexpected command' }
  }
  const candidates = getCodegraphCandidatePaths({
    env: { PATH: 'C:\\Windows\\System32', APPDATA: 'C:\\Users\\PC\\AppData\\Roaming' },
    platform: 'win32',
    homeDir: 'C:\\Users\\PC',
    spawn,
  })
  assert.equal(candidates.includes('C:\\Users\\PC\\AppData\\Roaming\\npm\\codegraph.cmd'), true)
})

test('detectCodegraphCli finds Windows npm global shim when PATH is stale', () => {
  const commandPath = 'C:\\Users\\PC\\AppData\\Roaming\\npm\\codegraph.cmd'
  const spawn = (cmd, args) => {
    if (cmd === 'codegraph' && args.join(' ') === 'version') {
      return { status: 1, stdout: '', stderr: 'not found', error: new Error('not found on PATH') }
    }
    if (cmd === 'npm' && args.join(' ') === 'bin -g') {
      return { status: 0, stdout: 'C:\\Users\\PC\\AppData\\Roaming\\npm\\n' }
    }
    if (cmd === 'npm' && args.join(' ') === 'prefix -g') {
      return { status: 0, stdout: 'C:\\Users\\PC\\AppData\\Roaming\\npm\\n' }
    }
    if (cmd === commandPath && args.join(' ') === 'version') {
      return { status: 0, stdout: 'codegraph 1.1.3\n' }
    }
    return { status: 1, stdout: '', stderr: `unexpected ${cmd} ${args.join(' ')}` }
  }
  const result = detectCodegraphCli({
    env: { PATH: 'C:\\Windows\\System32', APPDATA: 'C:\\Users\\PC\\AppData\\Roaming' },
    platform: 'win32',
    homeDir: 'C:\\Users\\PC',
    spawn,
    existsFn: (candidate) => candidate === commandPath,
  })
  assert.equal(result.ok, true)
  assert.equal(result.path, commandPath)
  assert.equal(result.version, 'codegraph 1.1.3')
})

// On Windows, npm-global CLIs ship as `.cmd` shims. Node >= 18.20 / 20.12 / 22
// (CVE-2024-27980) refuses to spawn `.cmd`/`.bat` without `shell: true`, so the
// installer's bare `spawnSync('codegraph', ...)` / `spawnSync('npm', ...)` calls
// fail with ENOENT/EINVAL and CodeGraph silently never wires up. These tests
// pin the fix: the spawn options MUST carry `shell: true` on win32.
test('detectCodegraphCli spawns codegraph with shell:true on win32 so the .cmd shim resolves', () => {
  const seen = []
  const spawn = (cmd, args, opts) => {
    seen.push({ cmd, args, opts })
    return { status: 0, stdout: '1.1.3\n', stderr: '' }
  }
  detectCodegraphCli({
    env: { PATH: 'C:\\Windows\\System32' },
    platform: 'win32',
    homeDir: 'C:\\Users\\PC',
    spawn,
    existsFn: () => false,
  })
  assert.ok(seen.length >= 1, 'a spawn call must happen during detect')
  assert.equal(seen[0].cmd, 'codegraph')
  assert.equal(seen[0].opts.shell, true, 'shell:true is required on win32 for the codegraph.cmd shim')
})

test('npmGlobalBinDirs (via getCodegraphCandidatePaths) spawns npm with shell:true on win32', () => {
  const seen = []
  const spawn = (cmd, args, opts) => {
    seen.push({ cmd, args, opts })
    if (args.join(' ') === 'bin -g') return { status: 1, stdout: '', stderr: 'npm v9+ dropped bin' }
    if (args.join(' ') === 'prefix -g') return { status: 0, stdout: 'C:\\nvm4w\\nodejs\n' }
    return { status: 1, stdout: '', stderr: '' }
  }
  getCodegraphCandidatePaths({
    env: { PATH: 'C:\\Windows\\System32' },
    platform: 'win32',
    homeDir: 'C:\\Users\\PC',
    spawn,
  })
  const npmCalls = seen.filter((c) => c.cmd === 'npm')
  assert.ok(npmCalls.length >= 1, 'npm spawn calls must happen in npmGlobalBinDirs')
  for (const c of npmCalls) {
    assert.equal(c.opts.shell, true, `shell:true required for npm.cmd (args=${c.args.join(' ')})`)
  }
})

test('installCodegraphCli uses the injected spawn with shell:true on win32 (no real npm side effect)', () => {
  const seen = []
  const spawn = (cmd, args, opts) => {
    seen.push({ cmd, args, opts })
    return { status: 0, stdout: '', stderr: '' }
  }
  // Empty PATH so that even if the (pre-fix) code fell back to the real
  // spawnSync, npm cannot be found and no network install is triggered.
  installCodegraphCli({ env: { PATH: '' }, platform: 'win32', spawn })
  assert.equal(seen.length, 1, 'injected spawn must be used instead of real spawnSync')
  assert.equal(seen[0].cmd, 'npm')
  assert.deepEqual(seen[0].args, ['install', '-g', CODEGRAPH_PACKAGE])
  assert.equal(seen[0].opts.shell, true, 'shell:true is required on win32 for the npm.cmd shim')
})

test('starterkit CodeGraph MCP config can be removed cleanly when disabled', () => {
  const base = { mcp: { codegraph: { ...CODEGRAPH_MCP_CONFIG }, tilth: { command: ['npx', 'tilth'], enabled: true } } }
  const stripped = removeStarterkitCodegraphMcpConfig(base)
  assert.equal(stripped.mcp.codegraph, undefined)
  assert.deepEqual(stripped.mcp.tilth, base.mcp.tilth)
})

test('starterkit CodeGraph MCP config with absolute command can be removed cleanly when disabled', () => {
  const base = { mcp: { codegraph: { ...CODEGRAPH_MCP_CONFIG, command: ['C:\\Users\\PC\\AppData\\Roaming\\npm\\codegraph.cmd', 'serve', '--mcp'] } } }
  const stripped = removeStarterkitCodegraphMcpConfig(base)
  assert.equal(stripped.mcp.codegraph, undefined)
})

test('plain install auto-installs CodeGraph when missing and not skipped', async () => {
  const calls = []
  const detect = () => {
    calls.push('detect')
    return calls.length === 1
      ? { ok: false, reason: 'not found' }
      : { ok: true, path: '/tmp/codegraph', version: '1.1.3' }
  }
  const install = () => {
    calls.push('install')
    return { status: 0 }
  }
  const result = await resolveCodegraphSetup({}, { detectCodegraphCli: detect, installCodegraphCli: install })
  assert.equal(result.enabled, true)
  assert.equal(result.installed, true)
  assert.deepEqual(calls, ['detect', 'install', 'detect'])
})

test('resolveCodegraphSetup is skipped when --skip-codegraph is passed', async () => {
  const result = await resolveCodegraphSetup({ skipCodegraph: true }, {
    detectCodegraphCli: () => { throw new Error('detect must not run when skipped') },
    installCodegraphCli: () => { throw new Error('install must not run when skipped') },
  })
  assert.equal(result.enabled, false)
  assert.equal(result.skipped, true)
  assert.match(result.reason, /--skip-codegraph/)
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
})

test('starterkit WebClaw integration defaults to disabled when no state file exists', () => {
  // Use a non-existent state path so the test is independent of any real
  // ~/.zcode starterkit-state.json left by prior runs or sandbox installs.
  const state = getWebclawIntegrationState(path.join(makeTempDir('zcode-state-'), 'missing.json'))
  assert.equal(state.enabled, false)
})

test('starterkit CodeGraph integration defaults to disabled when no state file exists', () => {
  const state = getCodegraphIntegrationState(path.join(makeTempDir('zcode-state-'), 'missing.json'))
  assert.equal(state.enabled, false)
})

function makeGitRepo(root, hooksPath = null) {
  fs.mkdirSync(root, { recursive: true })
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(init.status, 0, init.stderr || init.stdout)
  if (hooksPath !== null) {
    const config = spawnSync('git', ['config', 'core.hooksPath', hooksPath], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(config.status, 0, config.stderr || config.stdout)
  }
}

function hooksDir(root) {
  const result = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const value = result.stdout.trim()
  return path.isAbsolute(value) ? value : path.resolve(root, value)
}

function readHook(root, name) {
  return fs.readFileSync(path.join(hooksDir(root), name), 'utf8')
}

function writeHook(root, name, content) {
  const dir = hooksDir(root)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), content, 'utf8')
}

function hookExists(root, name) {
  return fs.existsSync(path.join(hooksDir(root), name))
}

function installHooksWithGitConfig(root, allowCustomHooksPath = false) {
  const gitConfigArgs = allowCustomHooksPath ? { allowCustomHooksPath: true } : {}
  return installCodegraphGitHooks(root, gitConfigArgs)
}

test('installCodegraphGitHooks skips custom hooksPath unless advanced opt-in is enabled', () => {
  const root = makeTempDir('zcode-codegraph-hooks-skip-')
  makeGitRepo(root, '.husky')

  const result = installHooksWithGitConfig(root, false)

  assert.equal(result.skipped, true)
  assert.match(result.reason, /advanced opt-in/i)
  assert.equal(hookExists(root, 'codegraph-refresh'), false)
  assert.equal(hookExists(root, 'post-merge'), false)
})

test('installCodegraphGitHooks appends refresh snippets into custom hooksPath when advanced opt-in is enabled', () => {
  const root = makeTempDir('zcode-codegraph-hooks-allow-')
  makeGitRepo(root, '.husky')
  writeHook(root, 'post-merge', '#!/usr/bin/env bash\necho husky\n')

  const result = installHooksWithGitConfig(root, true)

  assert.equal(result.ok, true)
  assert.equal(result.skipped, undefined)
  assert.equal(hookExists(root, 'codegraph-refresh'), true)
  const postMerge = readHook(root, 'post-merge')
  assert.match(postMerge, /echo husky/)
  assert.match(postMerge, /CodeGraph starterkit refresh \(opt-in\)/)
  assert.match(postMerge, /codegraph-refresh/)
})

test('installCodegraphGitHooks writes default .git/hooks refresh hooks when no custom hooksPath is configured', () => {
  const root = makeTempDir('zcode-codegraph-hooks-default-')
  makeGitRepo(root)

  const result = installHooksWithGitConfig(root, false)

  assert.equal(result.ok, true)
  assert.equal(result.skipped, undefined)
  assert.equal(hookExists(root, 'codegraph-refresh'), true)
  assert.equal(hookExists(root, 'post-checkout'), true)
  assert.match(readHook(root, 'post-merge'), /codegraph-refresh/)
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
  assert.equal(initRunbook.includes('Phase 2: Ensure beads'), false)
  assert.equal(initRunbook.includes('.beads/'), false)
})
