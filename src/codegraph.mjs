import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ensureDir, exists } from './fs-utils.mjs'
import { GLOBAL_STARTERKIT_STATE_PATH } from './constants.mjs'

export const CODEGRAPH_PACKAGE = '@colbymchenry/codegraph'
export const CODEGRAPH_MCP_CONFIG = {
  command: ['codegraph', 'serve', '--mcp'],
  enabled: true,
  timeout: 120000,
  type: 'local',
}


function readJsonIfExists(filePath, fallback = {}) {
  try {
    if (!exists(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

export function readStarterkitState(statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return readJsonIfExists(statePath, {})
}

export function writeStarterkitStatePatch(patch, statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  const current = readStarterkitState(statePath)
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  ensureDir(path.dirname(statePath))
  fs.writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export function writeCodegraphIntegrationState(codegraph, statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return writeStarterkitStatePatch({ codegraph }, statePath)
}

export function getCodegraphIntegrationState(statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return readStarterkitState(statePath).codegraph || { enabled: false, reason: 'starterkit state has no CodeGraph record' }
}

function pathEntries(env = process.env, platform = process.platform) {
  const delimiter = platform === 'win32' ? ';' : ':'
  return String(env.PATH || '')
    .split(delimiter)
    .filter(Boolean)
}

function candidateNames({ platform = process.platform } = {}) {
  return platform === 'win32' ? ['codegraph.cmd', 'codegraph.exe', 'codegraph'] : ['codegraph']
}

function pathApiForPlatform(platform = process.platform) {
  return platform === 'win32' ? path.win32 : path.posix
}

function isBareCommandPath(commandPath) {
  return commandPath === 'codegraph'
}

function npmGlobalBinDirs({ env = process.env, platform = process.platform, spawn = spawnSync } = {}) {
  const pathApi = pathApiForPlatform(platform)
  // `npm` is a `.cmd` shim on Windows; spawn it through the shell or Node
  // rejects with EINVAL/ENOENT (CVE-2024-27980) and the global bin dir is missed.
  const useShell = platform === 'win32'
  const result = spawn('npm', ['bin', '-g'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    shell: useShell,
  })
  const dirs = []
  if (result.status === 0) {
    const value = String(result.stdout || '').trim()
    if (value) dirs.push(value)
  }
  const prefix = spawn('npm', ['prefix', '-g'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    shell: useShell,
  })
  if (prefix.status === 0) {
    const value = String(prefix.stdout || '').trim()
    if (value) dirs.push(platform === 'win32' ? value : pathApi.join(value, 'bin'))
  }
  return dirs
}

function commonGlobalBinDirs({ env = process.env, platform = process.platform, homeDir = os.homedir() } = {}) {
  const pathApi = pathApiForPlatform(platform)
  const dirs = []
  if (platform === 'win32') {
    if (env.APPDATA) dirs.push(pathApi.join(env.APPDATA, 'npm'))
    if (homeDir) dirs.push(pathApi.join(homeDir, 'AppData', 'Roaming', 'npm'))
    return dirs
  }
  if (homeDir) {
    dirs.push(pathApi.join(homeDir, '.npm-global', 'bin'))
    dirs.push(pathApi.join(homeDir, '.local', 'bin'))
  }
  dirs.push('/usr/local/bin')
  return dirs
}

export function getCodegraphCandidatePaths({ env = process.env, platform = process.platform, homeDir = os.homedir(), spawn = spawnSync } = {}) {
  const pathApi = pathApiForPlatform(platform)
  const names = candidateNames({ platform })
  const candidates = []
  const dirs = [
    ...pathEntries(env, platform),
    ...npmGlobalBinDirs({ env, platform, spawn }),
    ...commonGlobalBinDirs({ env, platform, homeDir }),
  ]
  for (const dir of dirs) {
    for (const name of names) candidates.push(pathApi.join(dir, name))
  }
  return [...new Set(candidates)]
}

function runVersion(command, { spawn = spawnSync, ...options } = {}) {
  return spawn(command, ['version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

export function detectCodegraphCli({ env = process.env, platform = process.platform, homeDir = os.homedir(), spawnOptions = {}, spawn = spawnSync, existsFn = exists } = {}) {
  // Windows npm-global CLIs are `.cmd` shims; Node (CVE-2024-27980) refuses to
  // spawn them without `shell: true`, so the version probe must go through the
  // shell on win32 or detect silently fails with ENOENT/EINVAL.
  const useShell = platform === 'win32'
  const direct = runVersion('codegraph', { env, spawn, shell: useShell, ...spawnOptions })
  if (direct.status === 0) {
    return { ok: true, command: 'codegraph', path: 'codegraph', version: String(direct.stdout || direct.stderr || '').trim() }
  }

  for (const candidate of getCodegraphCandidatePaths({ env, platform, homeDir, spawn })) {
    if (!existsFn(candidate)) continue
    const result = runVersion(candidate, { env, spawn, shell: useShell, ...spawnOptions })
    if (result.status === 0) {
      return { ok: true, command: candidate, path: candidate, version: String(result.stdout || result.stderr || '').trim() }
    }
  }

  return { ok: false, reason: direct.error?.message || String(direct.stderr || '').trim() || 'codegraph not found' }
}

export function installCodegraphCli({ env = process.env, stdio = 'inherit', platform = process.platform, spawn = spawnSync } = {}) {
  return spawn('npm', ['install', '-g', CODEGRAPH_PACKAGE], {
    encoding: 'utf8',
    stdio,
    env,
    // `npm` is a `.cmd` shim on Windows; without the shell Node refuses to
    // spawn it (CVE-2024-27980) and the auto-install silently no-ops.
    shell: platform === 'win32',
  })
}

export function getCodegraphInstallCommand() {
  return `npm install -g ${CODEGRAPH_PACKAGE}`
}

export function mergeCodegraphMcpConfig(config, { commandPath = null } = {}) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? out.mcp : {}
  out.mcp = {
    ...currentMcp,
    codegraph: {
      ...(currentMcp.codegraph && typeof currentMcp.codegraph === 'object' && !Array.isArray(currentMcp.codegraph) ? currentMcp.codegraph : {}),
      ...CODEGRAPH_MCP_CONFIG,
      command: [commandPath || CODEGRAPH_MCP_CONFIG.command[0], ...CODEGRAPH_MCP_CONFIG.command.slice(1)],
    },
  }
  return out
}

export function removeStarterkitCodegraphMcpConfig(config) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? { ...out.mcp } : null
  if (!currentMcp?.codegraph) return out

  const codegraph = currentMcp.codegraph
  const commandTail = Array.isArray(codegraph.command) ? codegraph.command.slice(1) : []
  const isStarterkitShape = Array.isArray(codegraph.command)
    && commandTail.join('\0') === CODEGRAPH_MCP_CONFIG.command.slice(1).join('\0')
    && (isBareCommandPath(codegraph.command[0]) || String(codegraph.command[0] || '').toLowerCase().includes('codegraph'))
    && codegraph.type === CODEGRAPH_MCP_CONFIG.type
  if (isStarterkitShape) {
    delete currentMcp.codegraph
    out.mcp = currentMcp
  }
  return out
}

export function gitRoot(cwd) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return null
  return String(result.stdout || '').trim() || null
}

export function isGitWorktreeClone(repoRoot) {
  if (!repoRoot) return false
  try {
    return fs.statSync(path.join(repoRoot, '.git')).isFile()
  } catch {
    return false
  }
}

export function ensureCodegraphLocalIgnore(cwd) {
  const repoRoot = gitRoot(cwd)
  if (!repoRoot || isGitWorktreeClone(repoRoot)) return { ok: false, skipped: true, reason: 'not source-origin git checkout' }
  const excludePath = path.join(repoRoot, '.git', 'info', 'exclude')
  ensureDir(path.dirname(excludePath))
  const current = exists(excludePath) ? fs.readFileSync(excludePath, 'utf8') : ''
  if (/^\.codegraph\/$/m.test(current)) return { ok: true, changed: false, path: excludePath }
  const prefix = current && !current.endsWith('\n') ? '\n' : ''
  fs.appendFileSync(excludePath, `${prefix}\n# CodeGraph local index\n.codegraph/\n`, 'utf8')
  return { ok: true, changed: true, path: excludePath }
}

function parseStatusJson(result) {
  if (result.status !== 0) return null
  try {
    return JSON.parse(result.stdout)
  } catch {
    return null
  }
}

export function getCodegraphStatus(cwd, { command = 'codegraph' } = {}) {
  const result = spawnSync(command, ['status', cwd, '--json'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { result, status: parseStatusJson(result) }
}


function hookPath(repoRoot, name) {
  return path.join(getGitHooksDir(repoRoot), name)
}

function getGitConfigValue(repoRoot, key) {
  const result = spawnSync('git', ['config', '--get', key], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return null
  return String(result.stdout || '').trim() || null
}

function getGitHooksDir(repoRoot) {
  const result = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return path.join(repoRoot, '.git', 'hooks')
  const resolved = String(result.stdout || '').trim()
  if (!resolved) return path.join(repoRoot, '.git', 'hooks')
  return path.isAbsolute(resolved) ? resolved : path.resolve(repoRoot, resolved)
}

function buildCodegraphRefreshBody() {
  return `#!/usr/bin/env bash
set -euo pipefail
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$repo_root"
if ! command -v codegraph >/dev/null 2>&1; then
  echo "[codegraph] codegraph command not found; skip refresh" >&2
  exit 0
fi
status_json=$(codegraph status . --json 2>/dev/null || true)
if [[ -z "$status_json" ]] || ! printf '%s' "$status_json" | grep -q '"initialized":true'; then
  codegraph init . || echo "[codegraph] init failed; continuing" >&2
elif printf '%s' "$status_json" | grep -q '"reindexRecommended":true'; then
  codegraph index . || echo "[codegraph] index failed; continuing" >&2
else
  codegraph sync . || echo "[codegraph] sync failed; continuing" >&2
fi
`
}

function buildHookRefreshSnippet({ hookName, refreshPath }) {
  const helperCall = hookName === 'post-rewrite'
    ? `if [[ "\${1:-}" == "rebase" ]]; then\n  "${refreshPath}" || true\nfi`
    : `"${refreshPath}" || true`
  return `\n# CodeGraph starterkit refresh (opt-in)\n${helperCall}\n`
}

function appendCodegraphRefresh(existing, { hookName, refreshPath }) {
  if (existing.includes('CodeGraph starterkit refresh (opt-in)') || existing.includes(refreshPath)) {
    return existing
  }
  const body = existing.endsWith('\n') ? existing : `${existing}\n`
  return `${body}${buildHookRefreshSnippet({ hookName, refreshPath })}`
}

export function installCodegraphGitHooks(cwd, { allowCustomHooksPath = false } = {}) {
  const repoRoot = gitRoot(cwd) || cwd
  if (isGitWorktreeClone(repoRoot)) {
    return { ok: true, skipped: true, reason: 'git worktree clone; hooks belong in source-origin checkout', repoRoot }
  }

  const gitDir = path.join(repoRoot, '.git')
  if (!exists(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    return { ok: false, skipped: true, reason: 'not a source-origin git checkout', repoRoot }
  }

  const configuredHooksPath = getGitConfigValue(repoRoot, 'core.hooksPath')
  if (configuredHooksPath && !allowCustomHooksPath) {
    return {
      ok: true,
      skipped: true,
      reason: `custom git hooks path is configured (${configuredHooksPath}); use advanced opt-in to install into Husky/custom hooks`,
      repoRoot,
    }
  }

  const hooksDir = getGitHooksDir(repoRoot)
  ensureDir(hooksDir)
  const refreshBody = buildCodegraphRefreshBody()
  const refreshHelperPath = path.join(hooksDir, 'codegraph-refresh')
  const files = {
    'codegraph-refresh': refreshBody,
    'post-merge': `#!/usr/bin/env bash
set -euo pipefail
if command -v git-lfs >/dev/null 2>&1; then git lfs post-merge "$@" || true; fi
"${refreshHelperPath}" || true
`,
    'post-checkout': `#!/usr/bin/env bash
set -euo pipefail
if command -v git-lfs >/dev/null 2>&1; then git lfs post-checkout "$@" || true; fi
"${refreshHelperPath}" || true
`,
    'post-rewrite': `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "rebase" ]]; then
  "${refreshHelperPath}" || true
fi
`,
  }

  const installed = []
  const preserved = []
  for (const [name, body] of Object.entries(files)) {
    const target = hookPath(repoRoot, name)
    const current = exists(target) ? fs.readFileSync(target, 'utf8') : null
    if (name === 'codegraph-refresh' || !current) {
      fs.writeFileSync(target, body, 'utf8')
      fs.chmodSync(target, 0o755)
      installed.push(target)
      continue
    }

    if (!allowCustomHooksPath && configuredHooksPath) {
      preserved.push(target)
      continue
    }

    if (current.includes('CodeGraph starterkit refresh (opt-in)') || current.includes(refreshHelperPath)) {
      preserved.push(target)
      continue
    }

    if (allowCustomHooksPath && configuredHooksPath) {
      const merged = appendCodegraphRefresh(current, { hookName: name, refreshPath: refreshHelperPath })
      fs.writeFileSync(target, merged, 'utf8')
      fs.chmodSync(target, 0o755)
      installed.push(target)
      continue
    }

    if (current && !current.includes('codegraph-refresh') && name !== 'codegraph-refresh') {
      preserved.push(target)
      continue
    }
    fs.writeFileSync(target, body, 'utf8')
    fs.chmodSync(target, 0o755)
    installed.push(target)
  }
  return { ok: true, repoRoot, installed, preserved }
}

export function uninstallCodegraphGitHooks(cwd) {
  const repoRoot = gitRoot(cwd) || cwd
  if (isGitWorktreeClone(repoRoot)) return { ok: true, skipped: true, reason: 'git worktree clone', repoRoot }
  const removed = []
  for (const name of ['codegraph-refresh', 'post-merge', 'post-checkout', 'post-rewrite']) {
    const target = hookPath(repoRoot, name)
    if (!exists(target)) continue
    const current = fs.readFileSync(target, 'utf8')
    if (name === 'codegraph-refresh' || current.includes('codegraph-refresh')) {
      fs.rmSync(target, { force: true })
      removed.push(target)
    }
  }
  return { ok: true, repoRoot, removed }
}

export function refreshProjectCodegraph({ cwd, strict = false, command = 'codegraph' } = {}) {
  const repoRoot = gitRoot(cwd) || cwd
  if (isGitWorktreeClone(repoRoot)) {
    return { ok: true, skipped: true, reason: 'git worktree clone; refresh CodeGraph in the source-origin checkout', repoRoot }
  }

  const integration = getCodegraphIntegrationState()
  if (!integration.enabled) {
    return { ok: true, skipped: true, reason: integration.reason || 'CodeGraph disabled in starterkit state', repoRoot }
  }

  const detected = detectCodegraphCli()
  if (!detected.ok) {
    const result = { ok: false, skipped: true, reason: `codegraph not found; run ${getCodegraphInstallCommand()}`, repoRoot }
    if (strict) result.strictFailed = true
    return result
  }

  ensureCodegraphLocalIgnore(repoRoot)

  const before = getCodegraphStatus(repoRoot, { command })
  let action = 'sync'
  if (!before.status?.initialized) action = 'init'
  else if (before.status?.index?.reindexRecommended) action = 'index'

  const args = action === 'init' || action === 'index' ? [action, repoRoot] : ['sync', repoRoot]
  const run = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.parseInt(process.env.OPC_CODEGRAPH_TIMEOUT_MS || '300000', 10),
  })

  const after = getCodegraphStatus(repoRoot, { command })
  const ok = run.status === 0 && Boolean(after.status?.initialized)
  return {
    ok,
    action,
    repoRoot,
    command: `codegraph ${args.join(' ')}`,
    stdout: String(run.stdout || '').trim(),
    stderr: String(run.stderr || '').trim(),
    status: after.status,
    strictFailed: strict && !ok,
  }
}
