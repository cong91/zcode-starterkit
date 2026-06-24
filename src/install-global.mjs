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
import { packageBaselineAsPlugins, registerMarketplace, enablePlugins } from './plugin-packager.mjs'

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
    { shimName: isWindows ? 'zcs.cmd' : 'zcs', scriptName: 'zcs.mjs' },
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

function mergeGlobalConfig({ zcodeHome, stateRoot }) {
  const baselinePath = path.join(ZCODE_STARTERKIT_BASELINE_ROOT, 'config.json')
  const globalPath = path.join(zcodeHome, 'v2', 'config.json')
  if (!exists(baselinePath)) return { merged: false, reason: 'missing baseline/config.json' }
  const baseline = readJson(baselinePath)
  const current = exists(globalPath) ? readJson(globalPath) : {}
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  const normalized = normalizeZcodeConfig({ current, baseline, merged })
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

function buildInstallLog({ cwd, zcodeHome, packaged, mergeResult }) {
  return [
    `[zcode-starterkit] install started: ${new Date().toISOString()}`,
    `[zcode-starterkit] cwd=${cwd}`,
    `[zcode-starterkit] zcodeHome=${zcodeHome}`,
    `[zcode-starterkit] baseline=${ZCODE_STARTERKIT_BASELINE_ROOT}`,
    `[zcode-starterkit] corePluginDir=${packaged.corePluginDir}`,
    `[zcode-starterkit] agentsPluginDir=${packaged.agentsPluginDir}`,
    `[zcode-starterkit] mcpToolsPluginDir=${packaged.mcpToolsPluginDir}`,
    `[zcode-starterkit] hooksPluginDir=${packaged.hooksPluginDir}`,
    mergeResult?.merged ? `[zcode-starterkit] merged config=${mergeResult.globalPath}` : `[zcode-starterkit] merge skipped=${mergeResult?.reason || 'unknown'}`,
    mergeResult?.manifestPath ? `[zcode-starterkit] merge manifest=${mergeResult.manifestPath}` : `[zcode-starterkit] merge manifest=none`,
  ].join('\n') + '\n'
}

export async function installGlobal({ cwd, zcodeHome = ZCODE_HOME, skipShims = false } = {}) {
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

  // Package the portable baseline (config + agents + commands + skills + memory)
  // into two ZCode plugins under the cache root. We intentionally do NOT vendor
  // the whole starterkit package source: the plugins already carry everything
  // ZCode loads, and vendoring the source would recurse when --sandbox places
  // the cache root inside the repo itself.
  const packaged = packageBaselineAsPlugins({ zcodeHome, baselineRoot: ZCODE_STARTERKIT_BASELINE_ROOT })
  registerMarketplace({ zcodeHome, packaged })
  enablePlugins({ zcodeHome })
  const mergeResult = mergeGlobalConfig({ zcodeHome, stateRoot })
  // Shims install into the real ~/.local/bin (GLOBAL_BIN_DIR uses the real HOME).
  // Skip them in sandbox mode so a test run never touches the live filesystem.
  const installedShimPaths = skipShims ? [] : installCliShims()

  const logDir = path.join(stateRoot, 'logs')
  const installLogPath = path.join(logDir, `install-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
  writeText(installLogPath, buildInstallLog({ cwd, zcodeHome, packaged, mergeResult }))

  console.log(`[zcode-starterkit] Packaged plugins under ${path.dirname(packaged.corePluginDir)}`)
  console.log(`[zcode-starterkit] Registered marketplace zcode-starterkit`)
  console.log(`[zcode-starterkit] Enabled plugins in ${path.join(zcodeHome, 'cli', 'config.json')}`)
  if (mergeResult.merged) {
    console.log(`[zcode-starterkit] Merged global config -> ${mergeResult.globalPath}`)
    if (mergeResult.manifestPath) console.log(`[zcode-starterkit] Wrote merge manifest -> ${mergeResult.manifestPath}`)
  } else {
    console.log(`[zcode-starterkit] Skipped global config merge: ${mergeResult.reason}`)
  }
  console.log(`[zcode-starterkit] Wrote install log -> ${installLogPath}`)
  for (const shimPath of installedShimPaths) console.log(`[zcode-starterkit] Installed CLI shim at ${shimPath}`)
}
