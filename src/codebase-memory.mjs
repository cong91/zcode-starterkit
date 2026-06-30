// codebase-memory-mcp integration — the starterkit's code-intelligence engine.
//
// Replaces codegraph: codebase-memory-mcp is a pure-C single static binary
// that indexes a codebase into a persistent knowledge graph (tree-sitter +
// Hybrid LSP type resolution across 158 languages). It exposes 14 MCP tools
// including Cypher queries, trace_path (call graphs), dead-code detection,
// architecture overview, and ADR management — capabilities codegraph lacked.
//
// Like webclaw.mjs, this module is the integration glue: detect the binary,
// auto-download it if missing, merge its MCP entry into the host config,
// and record enablement state. The binary itself is never vendored — it is
// fetched from upstream GitHub releases (SLSA-3 + sigstore + checksummed).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ensureDir, exists } from './fs-utils.mjs'
import { GLOBAL_STARTERKIT_STATE_PATH } from './constants.mjs'

export const CODEBASE_MEMORY_REPO = 'DeusData/codebase-memory-mcp'
export const CODEBASE_MEMORY_INSTALL_DIR = path.join(os.homedir(), '.local', 'bin')
export const CODEBASE_MEMORY_MCP_CONFIG = {
  command: ['codebase-memory-mcp'],
  enabled: true,
  timeout: 120000,
  type: 'local',
}

// --- starterkit-state read/write (mirrors webclaw.mjs) ---

function readJsonIfExists(filePath, fallback = {}) {
  try {
    if (!exists(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function writeStarterkitStatePatch(patch, statePath = GLOBAL_STARTERKIT_STATE_PATH) {
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

function readStarterkitState(statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return readJsonIfExists(statePath, {})
}

export function writeCodebaseMemoryIntegrationState(codebaseMemory, statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return writeStarterkitStatePatch({ codebaseMemory }, statePath)
}

export function getCodebaseMemoryIntegrationState(statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return readStarterkitState(statePath).codebaseMemory || { enabled: false, reason: 'starterkit state has no Codebase-Memory record' }
}

// --- binary detection ---

function pathEntries(env = process.env) {
  return String(env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
}

function candidateNames({ platform = process.platform } = {}) {
  return platform === 'win32' ? ['codebase-memory-mcp.exe', 'codebase-memory-mcp.cmd', 'codebase-memory-mcp'] : ['codebase-memory-mcp']
}

function defaultInstallDirs({ env = process.env, platform = process.platform } = {}) {
  const home = platform === 'win32'
    ? env.USERPROFILE || os.homedir()
    : env.HOME || os.homedir()
  if (!home) return []
  return [path.join(home, '.local', 'bin')]
}

export function getCodebaseMemoryCandidatePaths({ env = process.env, platform = process.platform } = {}) {
  const names = candidateNames({ platform })
  const candidates = []
  for (const dir of [...pathEntries(env), ...defaultInstallDirs({ env, platform })]) {
    for (const name of names) candidates.push(path.join(dir, name))
  }
  return [...new Set(candidates)]
}

function runProbe(command, options = {}) {
  return spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
    ...options,
  })
}

function foundExecutable(result) {
  return result.status === 0 || (result.status !== null && !result.error)
}

function extractCodebaseMemoryVersion(output) {
  const text = String(output || '')
  const match = /codebase-memory-mcp\s+v?(\d+\.\d+\.\d+)/i.exec(text) || /codebase-memory-mcp\s+(\d+\.\d+\.\d+)/i.exec(text)
  return match ? match[1] : null
}

export function detectCodebaseMemoryCli({ env = process.env, platform = process.platform, spawnOptions = {} } = {}) {
  const useShell = platform === 'win32'
  const direct = runProbe('codebase-memory-mcp', { env, shell: useShell, ...spawnOptions })
  if (foundExecutable(direct)) {
    return { ok: true, command: 'codebase-memory-mcp', path: 'codebase-memory-mcp', version: extractCodebaseMemoryVersion(direct.stdout || direct.stderr) }
  }

  for (const candidate of getCodebaseMemoryCandidatePaths({ env, platform })) {
    if (!exists(candidate)) continue
    const result = runProbe(candidate, { env, shell: useShell, ...spawnOptions })
    if (foundExecutable(result)) {
      return { ok: true, command: candidate, path: candidate, version: extractCodebaseMemoryVersion(result.stdout || result.stderr) }
    }
  }

  return { ok: false, reason: direct.error?.message || String(direct.stderr || '').trim() || 'codebase-memory-mcp not found' }
}

// --- auto-download from GitHub releases ---

function targetTriple({ platform = process.platform, arch = process.arch } = {}) {
  const cpu = arch === 'x64' ? 'x86_64' : arch === 'arm64' ? 'aarch64' : null
  if (!cpu) return null
  if (platform === 'darwin') return cpu === 'x86_64' ? 'darwin-amd64' : 'darwin-arm64'
  if (platform === 'linux') return cpu === 'x86_64' ? 'linux-amd64' : 'linux-arm64'
  if (platform === 'win32' && cpu === 'x86_64') return 'windows-amd64'
  return null
}

async function downloadBuffer(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'zcode-starterkit' } })
  if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function latestRelease() {
  const response = await fetch(`https://api.github.com/repos/${CODEBASE_MEMORY_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'zcode-starterkit' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} while checking ${CODEBASE_MEMORY_REPO} latest release`)
  return await response.json()
}

function extractArchive({ archivePath, extractDir, platform = process.platform }) {
  if (archivePath.endsWith('.tar.gz')) {
    const result = spawnSync('tar', ['-xzf', archivePath, '-C', extractDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr || result.stdout}`)
    return
  }

  if (archivePath.endsWith('.zip')) {
    const ps = platform === 'win32' ? 'powershell.exe' : 'pwsh'
    const result = spawnSync(ps, ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${archivePath.replaceAll("'", "''")}' -DestinationPath '${extractDir.replaceAll("'", "''")}'`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (result.status !== 0) throw new Error(`zip extraction failed: ${result.stderr || result.stdout}`)
    return
  }

  throw new Error(`unsupported Codebase-Memory archive: ${archivePath}`)
}

function findExtractedBinary(root, { platform = process.platform } = {}) {
  const wanted = platform === 'win32' ? 'codebase-memory-mcp.exe' : 'codebase-memory-mcp'
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name === wanted) return full
    }
  }
  return null
}

export async function installCodebaseMemoryCli({ env = process.env, platform = process.platform, arch = process.arch } = {}) {
  const triple = targetTriple({ platform, arch })
  if (!triple) return { status: 1, error: new Error(`unsupported platform for Codebase-Memory binary install: ${platform}-${arch}`) }

  const release = await latestRelease()
  const tag = release.tag_name || release.name
  const ext = platform === 'win32' ? 'zip' : 'tar.gz'
  const assetName = `codebase-memory-mcp-${triple}.${ext}`
  const asset = release.assets?.find((item) => item.name === assetName)
  if (!asset) return { status: 1, error: new Error(`missing Codebase-Memory release asset ${assetName} for tag ${tag}`) }

  const binaryName = platform === 'win32' ? 'codebase-memory-mcp.exe' : 'codebase-memory-mcp'
  const binaryPath = path.join(CODEBASE_MEMORY_INSTALL_DIR, binaryName)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-cbm-'))
  try {
    ensureDir(CODEBASE_MEMORY_INSTALL_DIR)
    const archivePath = path.join(tmpDir, assetName)
    fs.writeFileSync(archivePath, await downloadBuffer(asset.browser_download_url))
    extractArchive({ archivePath, extractDir: tmpDir, platform })
    const extracted = findExtractedBinary(tmpDir, { platform })
    if (!extracted) return { status: 1, error: new Error(`archive did not contain ${binaryName}`) }
    fs.copyFileSync(extracted, binaryPath)
    if (platform !== 'win32') fs.chmodSync(binaryPath, 0o755)
    return { status: 0, path: binaryPath, version: tag }
  } catch (error) {
    return { status: 1, error }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

export function getCodebaseMemoryInstallCommand() {
  return 'download latest codebase-memory-mcp release binary from https://github.com/DeusData/codebase-memory-mcp/releases into ~/.local/bin'
}

// --- MCP config merge/remove (mirrors webclaw.mjs) ---

export function mergeCodebaseMemoryMcpConfig(config, { commandPath = null } = {}) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? out.mcp : {}
  out.mcp = {
    ...currentMcp,
    'codebase-memory-mcp': {
      ...(currentMcp['codebase-memory-mcp'] && typeof currentMcp['codebase-memory-mcp'] === 'object' && !Array.isArray(currentMcp['codebase-memory-mcp']) ? currentMcp['codebase-memory-mcp'] : {}),
      ...CODEBASE_MEMORY_MCP_CONFIG,
      command: [commandPath || CODEBASE_MEMORY_MCP_CONFIG.command[0]],
    },
  }
  return out
}

function isStarterkitCodebaseMemoryCommand(command) {
  if (!Array.isArray(command) || command.length !== 1) return false
  const name = path.basename(String(command[0] || '')).toLowerCase()
  return name === 'codebase-memory-mcp' || name === 'codebase-memory-mcp.exe'
}

export function removeStarterkitCodebaseMemoryMcpConfig(config) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? { ...out.mcp } : null
  if (!currentMcp?.['codebase-memory-mcp']) return out

  const entry = currentMcp['codebase-memory-mcp']
  const isStarterkitShape = isStarterkitCodebaseMemoryCommand(entry.command)
    && entry.type === CODEBASE_MEMORY_MCP_CONFIG.type
  if (isStarterkitShape) {
    delete currentMcp['codebase-memory-mcp']
    out.mcp = currentMcp
  }
  return out
}
