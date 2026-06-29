import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ensureDir, exists } from './fs-utils.mjs'
import { GLOBAL_STARTERKIT_STATE_PATH } from './constants.mjs'

export const WEBCLAW_REPO = '0xMassi/webclaw'
export const WEBCLAW_INSTALL_DIR = path.join(os.homedir(), '.webclaw')
export const WEBCLAW_MCP_CONFIG = {
  command: ['webclaw-mcp'],
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

function readStarterkitState(statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return readJsonIfExists(statePath, {})
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

export function writeWebclawIntegrationState(webclaw, statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return writeStarterkitStatePatch({ webclaw }, statePath)
}

export function getWebclawIntegrationState(statePath = GLOBAL_STARTERKIT_STATE_PATH) {
  return readStarterkitState(statePath).webclaw || { enabled: false, reason: 'starterkit state has no WebClaw record' }
}

function pathEntries(env = process.env) {
  return String(env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
}

function candidateNames({ platform = process.platform } = {}) {
  return platform === 'win32' ? ['webclaw-mcp.exe', 'webclaw-mcp.cmd', 'webclaw-mcp'] : ['webclaw-mcp']
}

function defaultWebclawDirs({ env = process.env, platform = process.platform } = {}) {
  const home = platform === 'win32'
    ? env.USERPROFILE || os.homedir()
    : env.HOME || os.homedir()
  if (!home) return []
  return [path.join(home, '.webclaw')]
}

export function getWebclawCandidatePaths({ env = process.env, platform = process.platform } = {}) {
  const names = candidateNames({ platform })
  const candidates = []
  for (const dir of [...pathEntries(env), ...defaultWebclawDirs({ env, platform })]) {
    for (const name of names) candidates.push(path.join(dir, name))
  }
  return [...new Set(candidates)]
}

function runProbe(command, options = {}) {
  return spawnSync(command, ['--help'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
    ...options,
  })
}

function foundExecutable(result) {
  return result.status === 0 || (result.status !== null && !result.error)
}

export function detectWebclawCli({ env = process.env, platform = process.platform, spawnOptions = {} } = {}) {
  const direct = runProbe('webclaw-mcp', { env, ...spawnOptions })
  if (foundExecutable(direct)) {
    return { ok: true, command: 'webclaw-mcp', path: 'webclaw-mcp', version: extractWebclawVersion(direct.stdout || direct.stderr) }
  }

  for (const candidate of getWebclawCandidatePaths({ env, platform })) {
    if (!exists(candidate)) continue
    const result = runProbe(candidate, { env, ...spawnOptions })
    if (foundExecutable(result)) {
      return { ok: true, command: candidate, path: candidate, version: extractWebclawVersion(result.stdout || result.stderr) }
    }
  }

  return { ok: false, reason: direct.error?.message || String(direct.stderr || '').trim() || 'webclaw-mcp not found' }
}

function extractWebclawVersion(output) {
  const text = String(output || '')
  const match = /webclaw(?:-mcp)?\s+v?(\d+\.\d+\.\d+)/i.exec(text)
  return match ? match[1] : null
}

function targetTriple({ platform = process.platform, arch = process.arch } = {}) {
  const cpu = arch === 'x64' ? 'x86_64' : arch === 'arm64' ? 'aarch64' : null
  if (!cpu) return null
  if (platform === 'darwin') return `${cpu}-apple-darwin`
  if (platform === 'linux') return `${cpu}-unknown-linux-gnu`
  if (platform === 'win32' && cpu === 'x86_64') return `${cpu}-pc-windows-msvc`
  return null
}

async function downloadBuffer(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'zcode-starterkit' } })
  if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function latestRelease() {
  const response = await fetch(`https://api.github.com/repos/${WEBCLAW_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'zcode-starterkit' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} while checking ${WEBCLAW_REPO} latest release`)
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

  throw new Error(`unsupported WebClaw archive: ${archivePath}`)
}

function findExtractedBinary(root, { platform = process.platform } = {}) {
  const wanted = platform === 'win32' ? 'webclaw-mcp.exe' : 'webclaw-mcp'
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name === wanted) return full
    }
  }
  return null
}

export async function installWebclawCli({ env = process.env, platform = process.platform, arch = process.arch } = {}) {
  const triple = targetTriple({ platform, arch })
  if (!triple) return { status: 1, error: new Error(`unsupported platform for WebClaw binary install: ${platform}-${arch}`) }

  const release = await latestRelease()
  const tag = release.tag_name || release.name
  const ext = platform === 'win32' ? 'zip' : 'tar.gz'
  const assetName = `webclaw-${tag}-${triple}.${ext}`
  const asset = release.assets?.find((item) => item.name === assetName)
  if (!asset) return { status: 1, error: new Error(`missing WebClaw release asset ${assetName}`) }

  const home = platform === 'win32' ? env.USERPROFILE || os.homedir() : env.HOME || os.homedir()
  const installDir = path.join(home, '.webclaw')
  const binaryName = platform === 'win32' ? 'webclaw-mcp.exe' : 'webclaw-mcp'
  const binaryPath = path.join(installDir, binaryName)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-webclaw-'))
  try {
    ensureDir(installDir)
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

export function getWebclawInstallCommand() {
  return 'download latest WebClaw release binary from https://github.com/0xMassi/webclaw/releases into ~/.webclaw'
}

export function mergeWebclawMcpConfig(config, { commandPath = null } = {}) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? out.mcp : {}
  out.mcp = {
    ...currentMcp,
    webclaw: {
      ...(currentMcp.webclaw && typeof currentMcp.webclaw === 'object' && !Array.isArray(currentMcp.webclaw) ? currentMcp.webclaw : {}),
      ...WEBCLAW_MCP_CONFIG,
      command: [commandPath || WEBCLAW_MCP_CONFIG.command[0]],
    },
  }
  return out
}

function isStarterkitWebclawCommand(command) {
  if (!Array.isArray(command) || command.length !== 1) return false
  const name = path.basename(String(command[0] || '')).toLowerCase()
  return name === 'webclaw-mcp' || name === 'webclaw-mcp.exe'
}

export function removeStarterkitWebclawMcpConfig(config) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? { ...out.mcp } : null
  if (!currentMcp?.webclaw) return out

  const webclaw = currentMcp.webclaw
  const isStarterkitShape = isStarterkitWebclawCommand(webclaw.command)
    && webclaw.type === WEBCLAW_MCP_CONFIG.type
  if (isStarterkitShape) {
    delete currentMcp.webclaw
    out.mcp = currentMcp
  }
  return out
}
