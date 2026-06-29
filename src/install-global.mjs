import fs from 'node:fs'
import path from 'node:path'
import {
  ZCODE_STARTERKIT_BASELINE_ROOT,
  ZCODE_STARTERKIT_PACKAGE_ROOT,
  ZCODE_HOME,
  GLOBAL_BIN_DIR,
} from './constants.mjs'
import { backupIfExists, ensureDir, exists, writeText } from './fs-utils.mjs'
import { readJson, writeJson, writeMergeManifest, mergeZcodeConfigAdditive, normalizeZcodeConfig } from './config-merge.mjs'
import { packageBaselineAsPlugins, registerMarketplace, enablePlugins, registerInstalledPlugins, mergeStarterkitToolsMcpConfig } from './plugin-packager.mjs'
import { detectCodegraphCli, getCodegraphInstallCommand, installCodegraphCli, installCodegraphGitHooks, mergeCodegraphMcpConfig, removeStarterkitCodegraphMcpConfig, writeCodegraphIntegrationState } from './codegraph.mjs'
import { detectWebclawCli, getWebclawInstallCommand, installWebclawCli, mergeWebclawMcpConfig, removeStarterkitWebclawMcpConfig, writeWebclawIntegrationState } from './webclaw.mjs'

function buildWindowsCmdShim({ scriptPath }) {
  return `@echo off\r\nnode "${scriptPath}" %*\r\n`
}

function buildPosixShim({ scriptPath }) {
  return `#!/usr/bin/env bash\nnode "${scriptPath}" "$@"\n`
}

export function getCliShimSpecs({ platform = process.platform, packageRoot = ZCODE_STARTERKIT_PACKAGE_ROOT, binDir = GLOBAL_BIN_DIR } = {}) {
  const pathApi = platform === 'win32' ? path.win32 : path
  const isWindows = platform === 'win32'
  const specs = [
    { shimName: isWindows ? 'zcode-starterkit.cmd' : 'zcode-starterkit', scriptName: 'zcode-starterkit.mjs' },
  ]
  return specs.map(({ shimName, scriptName }) => {
    const scriptPath = pathApi.join(packageRoot, 'bin', scriptName)
    return {
      shimPath: pathApi.join(binDir, shimName),
      content: isWindows ? buildWindowsCmdShim({ scriptPath }) : buildPosixShim({ scriptPath }),
      executable: !isWindows,
    }
  })
}

function installCliShims({ platform = process.platform } = {}) {
  ensureDir(GLOBAL_BIN_DIR)
  const specs = getCliShimSpecs({ platform })
  for (const spec of specs) {
    writeText(spec.shimPath, spec.content)
    if (spec.executable) fs.chmodSync(spec.shimPath, 0o755)
  }
  return specs.map((spec) => spec.shimPath)
}

function mergeGlobalConfig({ zcodeHome, stateRoot, enableCodegraph = false, codegraphCommandPath = null, enableWebclaw = false, webclawCommandPath = null, mcpToolsPluginDir = null }) {
  const baselinePath = path.join(ZCODE_STARTERKIT_BASELINE_ROOT, 'config.json')
  const globalPath = path.join(zcodeHome, 'v2', 'config.json')
  if (!exists(baselinePath)) return { merged: false, reason: 'missing baseline/config.json' }
  const baseline = readJson(baselinePath)
  const current = exists(globalPath) ? readJson(globalPath) : {}
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  // Apply starterkit-managed MCP entries AFTER the additive merge so the
  // codegraph/webclaw servers are only present when their CLIs were actually
  // enabled by install-global. When disabled, any stale starterkit-shaped
  // entry is stripped so the agent never loads a missing MCP server.
  const withCodegraph = enableCodegraph ? mergeCodegraphMcpConfig(merged, { commandPath: codegraphCommandPath }) : removeStarterkitCodegraphMcpConfig(merged)
  const withOptionalMcp = enableWebclaw ? mergeWebclawMcpConfig(withCodegraph, { commandPath: webclawCommandPath }) : removeStarterkitWebclawMcpConfig(withCodegraph)
  // Wire the starterkit-tools MCP server (memory/codesearch) into config.json.
  // The plugin manifest declares mcpServers, but ZCode only spawns servers
  // listed in config.json mcp{} — without this the memory tools never load.
  const withStarterkitTools = mcpToolsPluginDir
    ? mergeStarterkitToolsMcpConfig(withOptionalMcp, { serverPath: path.join(mcpToolsPluginDir, 'dist', 'mcp', 'server.js') })
    : withOptionalMcp
  const normalized = normalizeZcodeConfig({ current, baseline, merged: withStarterkitTools })
  const backupDir = path.join(stateRoot, 'backups')
  backupIfExists(globalPath, { backupRoot: backupDir })
  ensureDir(path.dirname(globalPath)) // ensure ~/.zcode/v2 exists before writing config
  writeJson(globalPath, normalized.config)
  const manifestPath = writeMergeManifest({
    targetPath: globalPath,
    sourcePath: baselinePath,
    mergedKeys: normalized.mergedKeys,
    normalizedChanges: normalized.changes,
    providerNames: normalized.providerNames,
    note: 'Additive merge + normalization from zcode-starterkit baseline into ZCode v2/config.json',
    manifestDir: path.join(stateRoot, 'manifests'),
  })
  return { merged: true, globalPath, manifestPath, normalizedChanges: normalized.changes, providerNames: normalized.providerNames }
}

function buildInstallLog({ cwd, zcodeHome, packaged, registryResult, mergeResult, codegraphResult, webclawResult, hookResult }) {
  return [
    `[zcode-starterkit] install started: ${new Date().toISOString()}`,
    `[zcode-starterkit] cwd=${cwd}`,
    `[zcode-starterkit] zcodeHome=${zcodeHome}`,
    `[zcode-starterkit] baseline=${ZCODE_STARTERKIT_BASELINE_ROOT}`,
    `[zcode-starterkit] corePluginDir=${packaged.corePluginDir}`,
    `[zcode-starterkit] agentsPluginDir=${packaged.agentsPluginDir}`,
    `[zcode-starterkit] mcpToolsPluginDir=${packaged.mcpToolsPluginDir}`,
    `[zcode-starterkit] hooksPluginDir=${packaged.hooksPluginDir}`,
    registryResult ? `[zcode-starterkit] registered plugins=${registryResult.registered} preserved=${registryResult.preserved} at ${registryResult.registryPath}` : `[zcode-starterkit] registry=not-written`,
    mergeResult?.merged ? `[zcode-starterkit] merged config=${mergeResult.globalPath}` : `[zcode-starterkit] merge skipped=${mergeResult?.reason || 'unknown'}`,
    mergeResult?.manifestPath ? `[zcode-starterkit] merge manifest=${mergeResult.manifestPath}` : `[zcode-starterkit] merge manifest=none`,
    codegraphResult ? `[zcode-starterkit] codegraph=${JSON.stringify(codegraphResult)}` : `[zcode-starterkit] codegraph=not-checked`,
    webclawResult ? `[zcode-starterkit] webclaw=${JSON.stringify(webclawResult)}` : `[zcode-starterkit] webclaw=not-checked`,
    hookResult ? `[zcode-starterkit] codegraph-hooks=${JSON.stringify(hookResult)}` : `[zcode-starterkit] codegraph-hooks=not-checked`,
  ].join('\n') + '\n'
}

// --- CodeGraph integration (mirrors opencode-starterkit, auto-install by default) ---
export async function resolveCodegraphSetup(options = {}, deps = {}) {
  const detect = deps.detectCodegraphCli || detectCodegraphCli
  const install = deps.installCodegraphCli || installCodegraphCli
  if (options.skipCodegraph) {
    return { enabled: false, skipped: true, reason: 'skipped by --skip-codegraph' }
  }

  const current = detect()
  if (current.ok) {
    console.log(`[zcode-starterkit] CodeGraph found: ${current.path}`)
    console.log('[zcode-starterkit] CodeGraph integration enabled: MCP, project indexing, and auto-refresh hooks are available.')
    if (current.version) console.log(`[zcode-starterkit] CodeGraph version: ${current.version}`)
    return { enabled: true, installed: false, path: current.path, version: current.version, source: 'existing' }
  }

  console.warn('[zcode-starterkit] CodeGraph CLI was not found. Install will auto-install it unless you pass --skip-codegraph.')
  console.warn('[zcode-starterkit] Installing CodeGraph is part of the default starterkit experience because project intelligence, refresh hooks, and MCP rely on it.')
  console.warn(`[zcode-starterkit] Install command: ${getCodegraphInstallCommand()}`)

  console.log(`[zcode-starterkit] Installing CodeGraph via: ${getCodegraphInstallCommand()}`)
  const installResult = install()
  const after = detect()
  if (!after.ok) {
    const message = `CodeGraph install did not make codegraph executable on PATH. Try manually: ${getCodegraphInstallCommand()}`
    if (options.requireCodegraph) throw new Error(message)
    console.warn(`[zcode-starterkit] ${message}`)
    return { enabled: false, installed: false, skipped: true, reason: message, installStatus: installResult?.status }
  }

  console.log(`[zcode-starterkit] CodeGraph installed: ${after.path}`)
  console.log('[zcode-starterkit] CodeGraph integration enabled: MCP, project indexing, and auto-refresh hooks are available.')
  if (after.version) console.log(`[zcode-starterkit] CodeGraph version: ${after.version}`)
  return { enabled: true, installed: true, path: after.path, version: after.version, installStatus: installResult?.status, source: 'installed' }
}

// --- WebClaw MCP integration (ZCode adaptation: auto-install by default, NOT optional) ---
// Unlike opencode-starterkit (where WebClaw is opt-in via prompt), zcode-starterkit
// installs WebClaw MCP by default to match CodeGraph's behavior. Only an explicit
// --skip-webclaw disables it; --require-webclaw makes a failed install fatal.
async function resolveWebclawSetup(options = {}) {
  if (options.skipWebclaw) {
    return { enabled: false, skipped: true, reason: 'skipped by --skip-webclaw' }
  }

  const current = detectWebclawCli()
  if (current.ok) {
    console.log(`[zcode-starterkit] WebClaw MCP found: ${current.path}`)
    console.log('[zcode-starterkit] WebClaw MCP integration enabled for URL extraction/browser-agent tools.')
    if (current.version) console.log(`[zcode-starterkit] WebClaw MCP version: ${current.version}`)
    return { enabled: true, installed: false, path: current.path, version: current.version, source: 'existing' }
  }

  console.warn('[zcode-starterkit] WebClaw MCP server was not found. Installing it by default (use --skip-webclaw to opt out).')
  console.warn('[zcode-starterkit] If left enabled without webclaw-mcp, ZCode reports an MCP connection error.')
  console.warn(`[zcode-starterkit] Install command: ${getWebclawInstallCommand()}`)

  console.log(`[zcode-starterkit] Installing WebClaw MCP via: ${getWebclawInstallCommand()}`)
  const install = await installWebclawCli()
  const after = detectWebclawCli()
  if (!after.ok) {
    const message = `WebClaw MCP install did not make webclaw-mcp executable on PATH. Try manually: ${getWebclawInstallCommand()}`
    if (options.requireWebclaw) throw new Error(message)
    console.warn(`[zcode-starterkit] ${message}`)
    return { enabled: false, installed: false, skipped: true, reason: message, installStatus: install.status }
  }

  console.log(`[zcode-starterkit] WebClaw MCP installed: ${after.path}`)
  console.log('[zcode-starterkit] WebClaw MCP integration enabled for URL extraction/browser-agent tools.')
  if (after.version) console.log(`[zcode-starterkit] WebClaw MCP version: ${after.version}`)
  return { enabled: true, installed: true, path: after.path, version: after.version, installStatus: install.status, source: 'installed' }
}

async function recordCodegraphState(result, options = {}, statePath) {
  writeCodegraphIntegrationState(result.enabled
    ? {
        enabled: true,
        installed: Boolean(result.installed),
        path: result.path || null,
        version: result.version || null,
        reason: result.reason || null,
        source: result.source || 'existing',
        allowCustomHooksPath: Boolean(options.allowCodegraphHooks),
      }
    : {
        enabled: false,
        reason: result.reason || 'disabled by user or unavailable',
        allowCustomHooksPath: Boolean(options.allowCodegraphHooks),
      }, statePath)
}

async function recordWebclawState(result, statePath) {
  writeWebclawIntegrationState(result.enabled
    ? {
        enabled: true,
        installed: Boolean(result.installed),
        path: result.path || null,
        version: result.version || null,
        reason: result.reason || null,
        source: result.source || 'existing',
      }
    : {
        enabled: false,
        reason: result.reason || 'disabled by user or unavailable',
      }, statePath)
}

export async function installGlobal({ cwd, zcodeHome = ZCODE_HOME, skipShims = false, options = {} } = {}) {
  console.log('[zcode-starterkit] Global install starting')
  console.log(`cwd=${cwd}`)
  console.log(`zcodeHome=${zcodeHome}`)
  console.log(`baseline=${ZCODE_STARTERKIT_BASELINE_ROOT}`)
  ensureDir(path.join(zcodeHome, 'cli'))
  const stateRoot = path.join(zcodeHome, 'cli', 'starterkit-state')
  ensureDir(stateRoot)
  ensureDir(path.join(stateRoot, 'backups'))
  ensureDir(path.join(stateRoot, 'logs'))
  ensureDir(path.join(stateRoot, 'manifests'))
  // Integration state lives under the (sandbox-aware) state root so a sandbox
  // install never reads or writes the real ~/.zcode starterkit-state.json.
  const starterkitStatePath = path.join(stateRoot, 'starterkit-state.json')

  // Package the portable baseline (config + agents + commands + skills + memory)
  // into two ZCode plugins under the cache root. We intentionally do NOT vendor
  // the whole starterkit package source: the plugins already carry everything
  // ZCode loads, and vendoring the source would recurse when --sandbox places
  // the cache root inside the repo itself.
  const packaged = packageBaselineAsPlugins({ zcodeHome, baselineRoot: ZCODE_STARTERKIT_BASELINE_ROOT })
  registerMarketplace({ zcodeHome, packaged })
  enablePlugins({ zcodeHome })
  // Register the 4 plugins in installed_plugins.json. ZCode's loader only
  // discovers plugin roots from inline dirs, the hardcoded official cache scan,
  // and this registry — without it, the cached plugins never load.
  const registryResult = registerInstalledPlugins({ zcodeHome, packaged, backupRoot: path.join(stateRoot, 'backups') })

  // Resolve CodeGraph + WebClaw integrations BEFORE the config merge so their
  // MCP entries can be added (or stripped) conditionally. Both auto-install by
  // default; --skip-codegraph / --skip-webclaw opt out.
  const codegraphResult = await resolveCodegraphSetup(options)
  await recordCodegraphState(codegraphResult, options, starterkitStatePath)
  const webclawResult = await resolveWebclawSetup(options)
  await recordWebclawState(webclawResult, starterkitStatePath)
  const hookResult = codegraphResult.enabled
    ? installCodegraphGitHooks(cwd, { allowCustomHooksPath: Boolean(options.allowCodegraphHooks) })
    : { ok: true, skipped: true, reason: codegraphResult.reason || 'CodeGraph disabled or unavailable', repoRoot: cwd }

  const mergeResult = mergeGlobalConfig({
    zcodeHome,
    stateRoot,
    enableCodegraph: codegraphResult.enabled,
    codegraphCommandPath: codegraphResult.path || null,
    enableWebclaw: webclawResult.enabled,
    webclawCommandPath: webclawResult.path || null,
    mcpToolsPluginDir: packaged.mcpToolsPluginDir,
  })

  // Shims install into the real ~/.local/bin (GLOBAL_BIN_DIR uses the real HOME).
  // Skip them in sandbox mode so a test run never touches the live filesystem.
  const installedShimPaths = skipShims ? [] : installCliShims()

  const logDir = path.join(stateRoot, 'logs')
  const installLogPath = path.join(logDir, `install-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
  writeText(installLogPath, buildInstallLog({ cwd, zcodeHome, packaged, registryResult, mergeResult, codegraphResult, webclawResult, hookResult }))

  console.log(`[zcode-starterkit] Packaged plugins under ${path.dirname(packaged.corePluginDir)}`)
  console.log(`[zcode-starterkit] Registered marketplace zcode-starterkit`)
  console.log(`[zcode-starterkit] Enabled plugins in ${path.join(zcodeHome, 'cli', 'config.json')}`)
  console.log(`[zcode-starterkit] Registered ${registryResult.registered} plugins in ${registryResult.registryPath} (preserved ${registryResult.preserved} other-marketplace entries)`)
  if (mergeResult.merged) {
    console.log(`[zcode-starterkit] Merged global config -> ${mergeResult.globalPath}`)
    if (mergeResult.manifestPath) console.log(`[zcode-starterkit] Wrote merge manifest -> ${mergeResult.manifestPath}`)
  } else {
    console.log(`[zcode-starterkit] Skipped global config merge: ${mergeResult.reason}`)
  }
  if (codegraphResult.enabled) {
    console.log('[zcode-starterkit] CodeGraph MCP and project intelligence integration enabled')
  } else {
    console.log(`[zcode-starterkit] CodeGraph integration disabled: ${codegraphResult.reason || 'not available'}`)
  }
  if (webclawResult.enabled) {
    console.log('[zcode-starterkit] WebClaw MCP integration enabled')
  } else {
    console.log(`[zcode-starterkit] WebClaw MCP integration disabled: ${webclawResult.reason || 'not available'}`)
  }
  console.log(`[zcode-starterkit] Wrote install log -> ${installLogPath}`)
  for (const shimPath of installedShimPaths) console.log(`[zcode-starterkit] Installed CLI shim at ${shimPath}`)
}
