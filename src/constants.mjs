import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const THIS_FILE = fileURLToPath(import.meta.url)
const SRC_DIR = path.dirname(THIS_FILE)
const PACKAGE_ROOT = path.resolve(SRC_DIR, '..')

export const HOME = os.homedir()
export const ZCODE_STARTERKIT_PACKAGE_ROOT = PACKAGE_ROOT
export const ZCODE_STARTERKIT_BASELINE_ROOT = path.join(PACKAGE_ROOT, 'baseline')

// ZCODE_HOME override enables sandboxed home-dir simulation.
// Default points at the real ZCode home (~/.zcode).
export function resolveZcodeHome(env = process.env) {
  if (env.ZCODE_HOME) return env.ZCODE_HOME
  return path.join(HOME, '.zcode')
}

export const ZCODE_HOME = resolveZcodeHome()

// Marketplace + plugin identity
export const MARKETPLACE_NAME = 'zcode-starterkit'
export const CORE_PLUGIN_NAME = 'core'
export const AGENTS_PLUGIN_NAME = 'agents-config'
export const MCP_TOOLS_PLUGIN_NAME = 'mcp-tools'
export const HOOKS_PLUGIN_NAME = 'hooks'
export const PLUGIN_VERSION = '1.1.2'

// ZCode layout under ZCODE_HOME
export const ZCODE_CLI_ROOT = path.join(ZCODE_HOME, 'cli')
export const ZCODE_PLUGINS_ROOT = path.join(ZCODE_CLI_ROOT, 'plugins')
export const ZCODE_CACHE_ROOT = path.join(ZCODE_PLUGINS_ROOT, 'cache', MARKETPLACE_NAME)
export const ZCODE_MARKETPLACE_DIR = path.join(ZCODE_PLUGINS_ROOT, 'marketplaces', MARKETPLACE_NAME)
export const ZCODE_RUNTIME_CONFIG = path.join(ZCODE_HOME, 'v2', 'config.json')

// installed_plugins.json is the registry ZCode's plugin loader reads to discover
// plugin roots (out/host/index.js: readInstalledPluginRoots). Plugins placed in
// cache/<marketplace>/ are NOT auto-scanned for arbitrary marketplaces — only
// `zcode-plugins-official` is hardcoded-scanned. Every other marketplace must
// register an entry here with an absolute installPath, or its skills/commands/
// mcpServers/hooks never load. Keys must match the loader schema:
//   { plugins: [{ id, marketplace, installPath }] }
export const INSTALLED_PLUGINS_FILENAME = 'installed_plugins.json'
export const ZCODE_INSTALLED_PLUGINS_PATH = path.join(ZCODE_PLUGINS_ROOT, INSTALLED_PLUGINS_FILENAME)

export const ZCODE_CORE_PLUGIN_DIR = path.join(ZCODE_CACHE_ROOT, CORE_PLUGIN_NAME, PLUGIN_VERSION)
export const ZCODE_AGENTS_PLUGIN_DIR = path.join(ZCODE_CACHE_ROOT, AGENTS_PLUGIN_NAME, PLUGIN_VERSION)
export const ZCODE_MCP_TOOLS_PLUGIN_DIR = path.join(ZCODE_CACHE_ROOT, MCP_TOOLS_PLUGIN_NAME, PLUGIN_VERSION)

// Vendor copy of the whole starterkit package source (for shim resolution + docs)
export const ZCODE_VENDOR_ROOT = ZCODE_CACHE_ROOT

// State / backups / logs / manifests (kept inside ZCode home, under cli/)
export const ZCODE_STATE_ROOT = path.join(ZCODE_CLI_ROOT, 'starterkit-state')
export const ZCODE_BACKUP_DIR = path.join(ZCODE_STATE_ROOT, 'backups')
export const ZCODE_INSTALL_LOG_DIR = path.join(ZCODE_STATE_ROOT, 'logs')
export const ZCODE_MANIFEST_DIR = path.join(ZCODE_STATE_ROOT, 'manifests')

// Shared starterkit integration state (CodeGraph / WebClaw enablement records).
// Mirrors opencode-starterkit's GLOBAL_STARTERKIT_STATE_PATH so codegraph.mjs
// and webclaw.mjs can read/write the same single JSON record.
export const GLOBAL_STARTERKIT_STATE_PATH = path.join(ZCODE_STATE_ROOT, 'starterkit-state.json')

// CLI shims (kept under ~/.local/bin, OS-agnostic)
export const GLOBAL_BIN_DIR = path.join(HOME, '.local', 'bin')
export const GLOBAL_STARTERKIT_SHIM = path.join(GLOBAL_BIN_DIR, 'zcode-starterkit')
