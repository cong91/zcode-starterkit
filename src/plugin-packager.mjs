import fs from 'node:fs'
import path from 'node:path'
import {
  MARKETPLACE_NAME,
  CORE_PLUGIN_NAME,
  AGENTS_PLUGIN_NAME,
  MCP_TOOLS_PLUGIN_NAME,
  HOOKS_PLUGIN_NAME,
  PLUGIN_VERSION,
  INSTALLED_PLUGINS_FILENAME,
} from './constants.mjs'
import { copyDirRecursive, ensureDir, exists, writeText, backupIfExists } from './fs-utils.mjs'
import { readJson, writeJson } from './config-merge.mjs'
import { removeStarterkitCodegraphMcpConfig } from './codegraph.mjs'
import { removeStarterkitWebclawMcpConfig } from './webclaw.mjs'

// MCP server name for the starterkit-tools plugin (memory, codesearch, etc.).
// Declared in the plugin manifest's mcpServers and wired into v2/config.json's
// mcp section by install-global so ZCode actually spawns the server. Without
// this config entry the plugin's mcpServers declaration is inert and the
// memory tools (observation/memory-search) never register, so .zcode/memory.db
// is never bootstrapped.
export const STARTERKIT_TOOLS_MCP_NAME = 'zcode-starterkit-tools'

function pluginJson({ name, description, withSkills, withCommands }) {
  const obj = {
    name,
    version: PLUGIN_VERSION,
    description,
    author: { name: 'zcode-starterkit' },
    license: 'MIT',
  }
  if (withSkills) obj.skills = 'skills'
  if (withCommands) obj.commands = 'commands'
  return obj
}

function pluginPackageJson({ name }) {
  return {
    $schema: 'https://json.schemastore.org/package.json',
    name: `@zcode-starterkit/${name}-plugin`,
    version: PLUGIN_VERSION,
    private: true,
    license: 'MIT',
    description: `zcode-starterkit ${name} plugin`,
  }
}

function seedJson({ name }) {
  return {
    marketplace: MARKETPLACE_NAME,
    plugin: name,
    pluginVersion: PLUGIN_VERSION,
    source: 'filesystem',
    version: 1,
    hash: 'local',
  }
}

export function packageBaselineAsPlugins({ zcodeHome, baselineRoot }) {
  const cacheRoot = path.join(zcodeHome, 'cli', 'plugins', 'cache', MARKETPLACE_NAME)
  const coreDir = path.join(cacheRoot, CORE_PLUGIN_NAME, PLUGIN_VERSION)
  const agentsDir = path.join(cacheRoot, AGENTS_PLUGIN_NAME, PLUGIN_VERSION)

  ensureDir(coreDir)
  ensureDir(agentsDir)

  // core: skills + commands
  copyDirRecursive(path.join(baselineRoot, 'skills'), path.join(coreDir, 'skills'))
  copyDirRecursive(path.join(baselineRoot, 'commands'), path.join(coreDir, 'commands'))
  // Portable content dirs from the OpenCode baseline — bundled with the core
  // plugin so the ZCode agent can reach templates/workflows/plans/artifacts/
  // dcp-prompts/memory/context without a separate install. (Plugin.json only
  // declares skills + commands as loadable surfaces; these dirs are reference
  // assets the agent reads via the filesystem / srcwalk_read.) memory/ is
  // included so the /init runbook can copy _templates into the project overlay.
  // context/ carries git-context.md (auto-injected into every prompt via the
  // /init instructions[]) plus architecture.md / fallow.md (read on demand).
  // /init materializes templates/, workflows/, plans/, context/ into the
  // per-project .zcode/ overlay; artifacts/ + dcp-prompts/ stay reference-only.
  for (const dir of ['templates', 'workflows', 'plans', 'artifacts', 'dcp-prompts', 'memory', 'context']) {
    copyDirRecursive(path.join(baselineRoot, dir), path.join(coreDir, dir))
  }
  writeText(path.join(coreDir, '.zcode-plugin', 'plugin.json'),
    `${JSON.stringify(pluginJson({ name: CORE_PLUGIN_NAME, description: 'Shared skills and commands for ZCode Agent.', withSkills: true, withCommands: true }), null, 2)}\n`)
  writeText(path.join(coreDir, '.zcode-plugin-seed.json'), `${JSON.stringify(seedJson({ name: CORE_PLUGIN_NAME }), null, 2)}\n`)
  writeText(path.join(coreDir, 'package.json'), `${JSON.stringify(pluginPackageJson({ name: CORE_PLUGIN_NAME }), null, 2)}\n`)

  // agents-config: agents markdown (referenced via config merge, not a skills dir)
  copyDirRecursive(path.join(baselineRoot, 'agents'), path.join(agentsDir, 'agents'))
  writeText(path.join(agentsDir, '.zcode-plugin', 'plugin.json'),
    `${JSON.stringify(pluginJson({ name: AGENTS_PLUGIN_NAME, description: 'Shared agent definitions for ZCode Agent (merged into v2/config.json).', withSkills: false, withCommands: false }), null, 2)}\n`)
  writeText(path.join(agentsDir, '.zcode-plugin-seed.json'), `${JSON.stringify(seedJson({ name: AGENTS_PLUGIN_NAME }), null, 2)}\n`)
  writeText(path.join(agentsDir, 'package.json'), `${JSON.stringify(pluginPackageJson({ name: AGENTS_PLUGIN_NAME }), null, 2)}\n`)

  // mcp-tools: MCP server porting OpenCode baseline tools (context7, grepsearch,
  // csearch, memory, sessions). Reduced: manual tool calls, no auto-capture.
  const mcpDir = path.join(cacheRoot, MCP_TOOLS_PLUGIN_NAME, PLUGIN_VERSION)
  const mcpResult = packageMcpToolsPlugin({ mcpDir, baselineRoot })

  // hooks: ZCode shell hooks porting OpenCode event-hook plugins (guard, rtk,
  // prompt-leverage, session-summary) + memory auto-capture/inject via
  // PreToolUse / PostToolUse / UserPromptSubmit / Stop hook events.
  const hooksDir = path.join(cacheRoot, HOOKS_PLUGIN_NAME, PLUGIN_VERSION)
  packageHooksPlugin({ hooksDir, baselineRoot })

  return {
    corePluginDir: coreDir,
    agentsPluginDir: agentsDir,
    mcpToolsPluginDir: mcpDir,
    hooksPluginDir: hooksDir,
    coreName: CORE_PLUGIN_NAME,
    agentsName: AGENTS_PLUGIN_NAME,
    mcpToolsName: MCP_TOOLS_PLUGIN_NAME,
    hooksName: HOOKS_PLUGIN_NAME,
    mcpServerName: mcpResult.serverName,
    version: PLUGIN_VERSION,
  }
}

// Package the hooks plugin: copy the hook scripts + hooks.json + plugin.json.
// ZCode loads hooks.json from the plugin root and runs each command, passing
// JSON on stdin and reading a JSON decision/context payload on stdout.
function packageHooksPlugin({ hooksDir, baselineRoot }) {
  ensureDir(hooksDir)
  const srcHooksRoot = path.join(baselineRoot, 'hooks-plugin')
  if (!exists(srcHooksRoot)) {
    throw new Error(
      `[zcode-starterkit] hooks-plugin source missing: ${srcHooksRoot}`,
    )
  }
  // Copy hooks/ (scripts + hooks.json) and the plugin manifest.
  copyDirRecursive(path.join(srcHooksRoot, 'hooks'), path.join(hooksDir, 'hooks'))
  // Reuse the committed .zcode-plugin/plugin.json from source.
  const srcPluginJson = path.join(srcHooksRoot, '.zcode-plugin', 'plugin.json')
  if (exists(srcPluginJson)) {
    writeText(path.join(hooksDir, '.zcode-plugin', 'plugin.json'), fs.readFileSync(srcPluginJson, 'utf8'))
  } else {
    writeText(path.join(hooksDir, '.zcode-plugin', 'plugin.json'),
      `${JSON.stringify(pluginJson({ name: HOOKS_PLUGIN_NAME, description: 'ZCode shell hooks porting OpenCode event-hook plugins + memory auto-capture/inject.', withSkills: false, withCommands: false }), null, 2)}\n`)
  }
  writeText(path.join(hooksDir, '.zcode-plugin-seed.json'), `${JSON.stringify(seedJson({ name: HOOKS_PLUGIN_NAME }), null, 2)}\n`)
  writeText(path.join(hooksDir, 'package.json'), `${JSON.stringify(pluginPackageJson({ name: HOOKS_PLUGIN_NAME }), null, 2)}\n`)
}

// Package the mcp-tools plugin: copy the prebuilt bundle + write plugin.json
// with an mcpServers entry pointing at the cached server.js.
function packageMcpToolsPlugin({ mcpDir, baselineRoot }) {
  const serverName = STARTERKIT_TOOLS_MCP_NAME
  ensureDir(mcpDir)
  const srcServer = path.join(baselineRoot, 'mcp-tools', 'dist', 'mcp', 'server.js')
  if (!exists(srcServer)) {
    throw new Error(
      `[zcode-starterkit] mcp-tools bundle missing: ${srcServer}\n` +
      `Build it first: cd baseline/mcp-tools && npm install && npm run build`,
    )
  }
  ensureDir(path.join(mcpDir, 'dist', 'mcp'))
  fs.copyFileSync(srcServer, path.join(mcpDir, 'dist', 'mcp', 'server.js'))

  const pluginJsonObj = {
    name: MCP_TOOLS_PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: 'MCP server porting OpenCode baseline tools (context7, grepsearch, csearch, memory, sessions) for ZCode Agent. Reduced: manual tool calls, no auto-capture/inject.',
    author: { name: 'zcode-starterkit' },
    license: 'MIT',
    mcpServers: {
      [serverName]: {
        command: 'node',
        args: ['${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js'],
        cwd: '${CLAUDE_PROJECT_DIR}',
      },
    },
  }
  writeText(path.join(mcpDir, '.zcode-plugin', 'plugin.json'), `${JSON.stringify(pluginJsonObj, null, 2)}\n`)
  writeText(path.join(mcpDir, '.zcode-plugin-seed.json'), `${JSON.stringify(seedJson({ name: MCP_TOOLS_PLUGIN_NAME }), null, 2)}\n`)
  writeText(path.join(mcpDir, 'package.json'), `${JSON.stringify(pluginPackageJson({ name: MCP_TOOLS_PLUGIN_NAME }), null, 2)}\n`)
  // Claude-compatible .mcp.json at plugin root (some hosts read this too).
  writeText(path.join(mcpDir, '.mcp.json'), `${JSON.stringify({ mcpServers: pluginJsonObj.mcpServers }, null, 2)}\n`)
  return { serverName }
}

// Wire the starterkit-tools MCP server into v2/config.json's mcp section so
// ZCode spawns it. The plugin manifest declares mcpServers, but ZCode's runtime
// only spawns servers listed in config.json mcp{} — without this entry the
// memory tools never register and .zcode/memory.db is never created.
// serverPath must be absolute (path.join(mcpToolsPluginDir, 'dist/mcp/server.js')).
export function mergeStarterkitToolsMcpConfig(config, { serverPath } = {}) {
  const out = { ...(config || {}) }
  const currentMcp = out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp) ? out.mcp : {}
  const existing = currentMcp[STARTERKIT_TOOLS_MCP_NAME] && typeof currentMcp[STARTERKIT_TOOLS_MCP_NAME] === 'object' && !Array.isArray(currentMcp[STARTERKIT_TOOLS_MCP_NAME]) ? currentMcp[STARTERKIT_TOOLS_MCP_NAME] : {}
  out.mcp = {
    ...currentMcp,
    [STARTERKIT_TOOLS_MCP_NAME]: {
      ...existing,
      command: ['node', serverPath],
      enabled: true,
      type: 'local',
      timeout: 120000,
    },
  }
  return out
}

export function removeStarterkitToolsMcpConfig(config) {
  const out = { ...(config || {}) }
  if (out.mcp && typeof out.mcp === 'object' && !Array.isArray(out.mcp)) {
    delete out.mcp[STARTERKIT_TOOLS_MCP_NAME]
  }
  return out
}

export function registerMarketplace({ zcodeHome, packaged }) {
  const marketplaceDir = path.join(zcodeHome, 'cli', 'plugins', 'marketplaces', MARKETPLACE_NAME)
  ensureDir(marketplaceDir)
  const marketplacePath = path.join(marketplaceDir, 'marketplace.json')
  const body = {
    name: MARKETPLACE_NAME,
    version: 1,
    plugins: [
      { cachePath: packaged.corePluginDir, name: packaged.coreName, source: 'filesystem', version: packaged.version },
      { cachePath: packaged.agentsPluginDir, name: packaged.agentsName, source: 'filesystem', version: packaged.version },
      { cachePath: packaged.mcpToolsPluginDir, name: packaged.mcpToolsName, source: 'filesystem', version: packaged.version },
      { cachePath: packaged.hooksPluginDir, name: packaged.hooksName, source: 'filesystem', version: packaged.version },
    ],
  }
  writeText(marketplacePath, `${JSON.stringify(body, null, 2)}\n`)
  return { marketplacePath }
}

export function readCliConfig({ zcodeHome }) {
  const cliConfigPath = path.join(zcodeHome, 'cli', 'config.json')
  if (!exists(cliConfigPath)) return {}
  try { return JSON.parse(fs.readFileSync(cliConfigPath, 'utf8')) } catch { return {} }
}

export function enablePlugins({ zcodeHome }) {
  const cliConfigPath = path.join(zcodeHome, 'cli', 'config.json')
  const cfg = readCliConfig({ zcodeHome })
  cfg.plugins = cfg.plugins || {}
  cfg.plugins.enabledPlugins = cfg.plugins.enabledPlugins || {}
  cfg.plugins.enabledPlugins[`${CORE_PLUGIN_NAME}@${MARKETPLACE_NAME}`] = true
  cfg.plugins.enabledPlugins[`${AGENTS_PLUGIN_NAME}@${MARKETPLACE_NAME}`] = true
  cfg.plugins.enabledPlugins[`${MCP_TOOLS_PLUGIN_NAME}@${MARKETPLACE_NAME}`] = true
  cfg.plugins.enabledPlugins[`${HOOKS_PLUGIN_NAME}@${MARKETPLACE_NAME}`] = true
  ensureDir(path.dirname(cliConfigPath))
  writeText(cliConfigPath, `${JSON.stringify(cfg, null, 2)}\n`)
  return { cliConfigPath, enabled: cfg.plugins.enabledPlugins }
}

// --- installed_plugins.json registry ---
// ZCode's plugin loader discovers plugin roots from three sources only:
//   1. config.plugins.dirs (inline)
//   2. a hardcoded scan of cache/zcode-plugins-official/*/*
//   3. installed_plugins.json  (this registry)
// Plugins the starterkit copies into cache/zcode-starterkit/*/* are NOT scanned,
// so without a registry entry per plugin, none of their skills/commands/
// mcpServers/hooks ever load. Each entry must carry an absolute installPath
// (the loader rejects relative paths via path.isAbsolute).
function registryPathFor(zcodeHome) {
  return path.join(zcodeHome, 'cli', 'plugins', INSTALLED_PLUGINS_FILENAME)
}

function readRegistry(registryPath) {
  if (!exists(registryPath)) return { plugins: [] }
  try {
    const parsed = readJson(registryPath)
    if (parsed && Array.isArray(parsed.plugins)) return { plugins: parsed.plugins }
    return { plugins: [] }
  } catch {
    // Corrupt or unreadable registry: start fresh (a backup was already taken).
    return { plugins: [] }
  }
}

export function registerInstalledPlugins({ zcodeHome, packaged, backupRoot = null }) {
  const registryPath = registryPathFor(zcodeHome)
  const current = readRegistry(registryPath)
  // Preserve entries from other marketplaces; replace any stale starterkit
  // entries (e.g. from a previous version) so re-install never duplicates.
  const preserved = current.plugins.filter((e) => e && e.marketplace !== MARKETPLACE_NAME)
  // Each entry MUST carry the full 7-field schema ZCode's CLI loader accepts
  // (isInstalledPluginRecord / c2o in zcode.cjs): id, name, marketplace,
  // version, installPath, installedAt, scope. Entries missing any field are
  // silently dropped, so the plugin's skills/commands/MCP-tools/hooks never
  // load even though installed_plugins.json lists it. The desktop app's host
  // loader (readInstalledPluginRoots) is lenient and only reads
  // id/marketplace/installPath, so the extra fields are harmless there.
  //
  // `id` MUST be the qualified `${name}@${marketplace}` form (not the bare
  // plugin name) because the agent loader (discoverPluginAgents / hte in
  // out/host/index.js) looks the plugin up in config.plugins.enabledPlugins
  // by `entry.id`, and those keys are qualified (e.g. "core@zcode-starterkit").
  // A bare id ("core") never matches, so every plugin agent is skipped and
  // no agents load. Command discovery (resolvePluginCommandRootDescriptors)
  // qualifies from manifest.name + marketplace itself, so it is unaffected.
  const installedAt = new Date().toISOString()
  const buildEntry = (name, pluginDir) => ({
    id: `${name}@${MARKETPLACE_NAME}`,
    name,
    marketplace: MARKETPLACE_NAME,
    version: PLUGIN_VERSION,
    installPath: path.resolve(pluginDir),
    installedAt,
    scope: 'user',
  })
  const entries = [
    buildEntry(packaged.coreName, packaged.corePluginDir),
    buildEntry(packaged.agentsName, packaged.agentsPluginDir),
    buildEntry(packaged.mcpToolsName, packaged.mcpToolsPluginDir),
    buildEntry(packaged.hooksName, packaged.hooksPluginDir),
  ]
  const next = { plugins: [...preserved, ...entries] }
  backupIfExists(registryPath, { backupRoot })
  ensureDir(path.dirname(registryPath))
  writeJson(registryPath, next)
  return { registryPath, registered: entries.length, preserved: preserved.length }
}

// Remove every trace of the starterkit from a ZCode home: registry entries,
// enabledPlugins keys, the cached plugin dirs, the marketplace dir, and the
// starterkit-managed MCP entries (codegraph/webclaw) in v2/config.json. Other
// marketplaces' entries and config are preserved. Safe to run when nothing is
// installed.
function rmBestEffort(targetPath) {
  if (!exists(targetPath)) return false
  try { fs.rmSync(targetPath, { recursive: true, force: true }); return true }
  catch { return false }
}

export function uninstallStarterkit({ zcodeHome, backupRoot = null }) {
  const pluginsRoot = path.join(zcodeHome, 'cli', 'plugins')
  const registryPath = registryPathFor(zcodeHome)
  const removed = { registryEntries: 0, cacheDir: null, marketplaceDir: null, enabledPluginKeys: [], mcpEntries: [] }

  // 1. Registry: drop starterkit entries, preserve the rest.
  if (exists(registryPath)) {
    const reg = readRegistry(registryPath)
    const before = reg.plugins.length
    reg.plugins = reg.plugins.filter((e) => e && e.marketplace !== MARKETPLACE_NAME)
    removed.registryEntries = before - reg.plugins.length
    backupIfExists(registryPath, { backupRoot })
    writeJson(registryPath, reg)
  }

  // 2. enabledPlugins: drop *@zcode-starterkit keys, preserve others.
  const cliConfigPath = path.join(zcodeHome, 'cli', 'config.json')
  if (exists(cliConfigPath)) {
    const cfg = readCliConfig({ zcodeHome })
    if (cfg.plugins?.enabledPlugins) {
      for (const key of Object.keys(cfg.plugins.enabledPlugins)) {
        if (key.endsWith(`@${MARKETPLACE_NAME}`)) {
          delete cfg.plugins.enabledPlugins[key]
          removed.enabledPluginKeys.push(key)
        }
      }
      backupIfExists(cliConfigPath, { backupRoot })
      writeText(cliConfigPath, `${JSON.stringify(cfg, null, 2)}\n`)
    }
  }

  // 3. Cache + marketplace dirs (best-effort; never throw if missing).
  const cacheDir = path.join(pluginsRoot, 'cache', MARKETPLACE_NAME)
  if (rmBestEffort(cacheDir)) removed.cacheDir = cacheDir
  const marketplaceDir = path.join(pluginsRoot, 'marketplaces', MARKETPLACE_NAME)
  if (rmBestEffort(marketplaceDir)) removed.marketplaceDir = marketplaceDir

  // 4. v2/config.json: strip starterkit-managed MCP entries (codegraph/webclaw).
  const runtimeConfigPath = path.join(zcodeHome, 'v2', 'config.json')
  if (exists(runtimeConfigPath)) {
    try {
      const cfg = readJson(runtimeConfigPath)
      const withoutCodegraph = removeStarterkitCodegraphMcpConfig(cfg)
      const withoutWebclaw = removeStarterkitWebclawMcpConfig(withoutCodegraph)
      const cleaned = removeStarterkitToolsMcpConfig(withoutWebclaw)
      if (cleaned.mcp) {
        for (const name of ['codegraph', 'webclaw', STARTERKIT_TOOLS_MCP_NAME]) {
          if (cfg.mcp?.[name] && !cleaned.mcp[name]) removed.mcpEntries.push(name)
        }
      }
      backupIfExists(runtimeConfigPath, { backupRoot })
      writeJson(runtimeConfigPath, cleaned)
    } catch {
      // Leave an unreadable runtime config untouched rather than guessing.
    }
  }

  return { zcodeHome, removed }
}
