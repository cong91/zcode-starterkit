import fs from 'node:fs'
import path from 'node:path'
import {
  MARKETPLACE_NAME,
  CORE_PLUGIN_NAME,
  AGENTS_PLUGIN_NAME,
  MCP_TOOLS_PLUGIN_NAME,
  PLUGIN_VERSION,
} from './constants.mjs'
import { copyDirRecursive, ensureDir, exists, writeText } from './fs-utils.mjs'

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
  // dcp-prompts without a separate install. (Plugin.json only declares skills
  // + commands as loadable surfaces; these dirs are reference assets the agent
  // reads via the filesystem / srcwalk_read.)
  for (const dir of ['templates', 'workflows', 'plans', 'artifacts', 'dcp-prompts']) {
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

  return {
    corePluginDir: coreDir,
    agentsPluginDir: agentsDir,
    mcpToolsPluginDir: mcpDir,
    coreName: CORE_PLUGIN_NAME,
    agentsName: AGENTS_PLUGIN_NAME,
    mcpToolsName: MCP_TOOLS_PLUGIN_NAME,
    mcpServerName: mcpResult.serverName,
    version: PLUGIN_VERSION,
  }
}

// Package the mcp-tools plugin: copy the prebuilt bundle + write plugin.json
// with an mcpServers entry pointing at the cached server.js.
function packageMcpToolsPlugin({ mcpDir, baselineRoot }) {
  const serverName = 'zcode-starterkit-tools'
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
  ensureDir(path.dirname(cliConfigPath))
  writeText(cliConfigPath, `${JSON.stringify(cfg, null, 2)}\n`)
  return { cliConfigPath, enabled: cfg.plugins.enabledPlugins }
}
