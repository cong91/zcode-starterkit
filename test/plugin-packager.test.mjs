import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { packageBaselineAsPlugins, registerMarketplace, enablePlugins, registerInstalledPlugins, uninstallStarterkit, readCliConfig } from '../src/plugin-packager.mjs'
import { MARKETPLACE_NAME, PLUGIN_VERSION } from '../src/constants.mjs'

function sandboxHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-pkg-'))
}

function readInstalledPlugins(home) {
  const p = path.join(home, 'cli', 'plugins', 'installed_plugins.json')
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function starterkitEntries(reg) {
  return (reg.plugins || []).filter((e) => e.marketplace === MARKETPLACE_NAME)
}

test('packageBaselineAsPlugins creates core + agents-config plugin dirs with plugin.json', () => {
  const home = sandboxHome()
  const baselineRoot = path.resolve('baseline')
  const cacheRoot = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit')
  const result = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot })
  assert.ok(result.corePluginDir.startsWith(cacheRoot))
  assert.ok(fs.existsSync(path.join(result.corePluginDir, '.zcode-plugin', 'plugin.json')))
  assert.ok(fs.existsSync(path.join(result.agentsPluginDir, '.zcode-plugin', 'plugin.json')))
  const corePluginJson = JSON.parse(fs.readFileSync(path.join(result.corePluginDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.equal(corePluginJson.name, 'core')
  assert.equal(corePluginJson.skills, 'skills')
  assert.equal(corePluginJson.commands, 'commands')
  const agentsPluginJson = JSON.parse(fs.readFileSync(path.join(result.agentsPluginDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.equal(agentsPluginJson.name, 'agents-config')
  assert.ok(fs.existsSync(path.join(result.agentsPluginDir, 'agents', 'build.md')))
})

test('registerMarketplace writes marketplace.json listing all plugins', () => {
  const home = sandboxHome()
  const baselineRoot = path.resolve('baseline')
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot })
  const mp = registerMarketplace({ zcodeHome: home, packaged })
  const mpJson = JSON.parse(fs.readFileSync(mp.marketplacePath, 'utf8'))
  assert.equal(mpJson.name, 'zcode-starterkit')
  assert.equal(mpJson.plugins.length, 4)
  assert.ok(mpJson.plugins.some((p) => p.name === 'core'))
  assert.ok(mpJson.plugins.some((p) => p.name === 'agents-config'))
  assert.ok(mpJson.plugins.some((p) => p.name === 'mcp-tools'))
  assert.ok(mpJson.plugins.some((p) => p.name === 'hooks'))
})

test('hooks plugin carries hook scripts and a hooks.json manifest', () => {
  const home = sandboxHome()
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  const hooksDir = packaged.hooksPluginDir
  assert.ok(fs.existsSync(path.join(hooksDir, 'hooks', 'hooks.json')), 'hooks.json must be packaged')
  assert.ok(fs.existsSync(path.join(hooksDir, 'hooks', 'guard.mjs')), 'guard.mjs must be packaged')
  assert.ok(fs.existsSync(path.join(hooksDir, 'hooks', 'memory-capture.mjs')), 'memory-capture.mjs must be packaged')
  assert.ok(fs.existsSync(path.join(hooksDir, '.zcode-plugin', 'plugin.json')), 'hooks plugin.json must exist')
  const hooksJson = JSON.parse(fs.readFileSync(path.join(hooksDir, 'hooks', 'hooks.json'), 'utf8'))
  assert.ok(hooksJson.hooks.PreToolUse, 'PreToolUse hook must be registered')
  assert.ok(hooksJson.hooks.PostToolUse, 'PostToolUse hook must be registered')
  assert.ok(hooksJson.hooks.UserPromptSubmit, 'UserPromptSubmit hook must be registered')
  assert.ok(hooksJson.hooks.Stop, 'Stop hook must be registered')
})

test('mcp-tools plugin carries a bundle and an mcpServers entry', () => {
  const home = sandboxHome()
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  const pluginJson = JSON.parse(fs.readFileSync(path.join(packaged.mcpToolsPluginDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.equal(pluginJson.name, 'mcp-tools')
  assert.ok(pluginJson.mcpServers, 'mcpServers must be declared')
  const serverName = Object.keys(pluginJson.mcpServers)[0]
  assert.ok(serverName, 'mcpServers must have at least one entry')
  assert.ok(fs.existsSync(path.join(packaged.mcpToolsPluginDir, 'dist', 'mcp', 'server.js')), 'bundle server.js must be copied')
  assert.ok(fs.existsSync(path.join(packaged.mcpToolsPluginDir, '.mcp.json')), '.mcp.json must exist')
})

test('enablePlugins sets all plugins true in cli/config.json without wiping existing', () => {
  const home = sandboxHome()
  const cliConfigPath = path.join(home, 'cli', 'config.json')
  fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true })
  fs.writeFileSync(cliConfigPath, JSON.stringify({ plugins: { enabledPlugins: { 'superpowers@zcode-plugins-official': true } } }))
  enablePlugins({ zcodeHome: home })
  const cfg = readCliConfig({ zcodeHome: home })
  assert.equal(cfg.plugins.enabledPlugins['superpowers@zcode-plugins-official'], true)
  assert.equal(cfg.plugins.enabledPlugins['core@zcode-starterkit'], true)
  assert.equal(cfg.plugins.enabledPlugins['agents-config@zcode-starterkit'], true)
  assert.equal(cfg.plugins.enabledPlugins['mcp-tools@zcode-starterkit'], true)
  assert.equal(cfg.plugins.enabledPlugins['hooks@zcode-starterkit'], true)
})

test('no file is written outside the sandbox home', () => {
  const home = sandboxHome()
  // Canary: a separate temp dir pointed at by ZCODE_HOME. If
  // packageBaselineAsPlugins ever falls back to resolveZcodeHome() (env-based)
  // instead of the zcodeHome param, it would write here and the assertion
  // catches the regression. Using a temp canary rather than os.homedir()/.zcode
  // so the assertion is not polluted by a real starterkit install on the dev or
  // CI machine (the previous sentinel false-positived once the package was
  // actually installed globally).
  const canary = sandboxHome()
  const prevZcodeHome = process.env.ZCODE_HOME
  process.env.ZCODE_HOME = canary
  try {
    packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  } finally {
    if (prevZcodeHome === undefined) delete process.env.ZCODE_HOME
    else process.env.ZCODE_HOME = prevZcodeHome
  }
  assert.ok(
    !fs.existsSync(path.join(canary, 'cli', 'plugins', 'cache', 'zcode-starterkit')),
    'packageBaselineAsPlugins must write only to the zcodeHome param, not to ZCODE_HOME',
  )
})

// --- installed_plugins.json registry ---
// ZCode's plugin loader (readInstalledPluginRoots in out/host/index.js) only
// discovers plugin roots from three sources: inline dirs, the hardcoded
// `cache/zcode-plugins-official/*/*` scan, and `installed_plugins.json`. The
// starterkit writes to `cache/zcode-starterkit/*/*` (not scanned) so it MUST
// also register an entry per plugin in installed_plugins.json or none of its
// skills/commands/MCP-tools/hooks load. installPath must be absolute (the
// loader rejects relative paths via path.isAbsolute).

test('registerInstalledPlugins writes 4 entries with absolute installPath + marketplace=zcode-starterkit', () => {
  const home = sandboxHome()
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  const result = registerInstalledPlugins({ zcodeHome: home, packaged })

  const reg = readInstalledPlugins(home)
  const entries = starterkitEntries(reg)
  assert.equal(entries.length, 4, 'must register exactly 4 starterkit plugins')
  const ids = entries.map((e) => e.id).sort()
  assert.deepEqual(ids, ['agents-config@zcode-starterkit', 'core@zcode-starterkit', 'hooks@zcode-starterkit', 'mcp-tools@zcode-starterkit'])
  for (const e of entries) {
    assert.equal(e.marketplace, MARKETPLACE_NAME)
    assert.ok(path.isAbsolute(e.installPath), `installPath must be absolute, got ${e.installPath}`)
    // installPath must point at a real plugin dir carrying a .zcode-plugin/plugin.json
    assert.ok(fs.existsSync(path.join(e.installPath, '.zcode-plugin', 'plugin.json')),
      `installPath ${e.installPath} must contain .zcode-plugin/plugin.json`)
    // ZCode's CLI loader (isInstalledPluginRecord / c2o in zcode.cjs) only
    // accepts entries carrying the full 7-field schema — entries missing any
    // of name/version/installedAt/scope are silently dropped, so the plugin's
    // skills/commands never load even though installed_plugins.json lists it.
    assert.equal(e.name, e.id.split('@')[0], `entry name must match id prefix for ${e.id}`)
    assert.equal(e.id, `${e.name}@${e.marketplace}`, `entry id must be qualified name@marketplace for ${e.id}`)
    assert.equal(e.version, PLUGIN_VERSION, `entry version must be PLUGIN_VERSION for ${e.id}`)
    assert.equal(typeof e.installedAt, 'string', `installedAt must be an ISO string for ${e.id}`)
    assert.ok(!Number.isNaN(Date.parse(e.installedAt)), `installedAt must parse for ${e.id}`)
    assert.equal(e.scope, 'user', `global install must set scope=user for ${e.id}`)
  }
  assert.equal(result.registered, 4)
  assert.equal(result.preserved, 0)
})

test('registerInstalledPlugins is idempotent (run twice -> 4 entries, not 8)', () => {
  const home = sandboxHome()
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  registerInstalledPlugins({ zcodeHome: home, packaged })
  registerInstalledPlugins({ zcodeHome: home, packaged })

  const entries = starterkitEntries(readInstalledPlugins(home))
  assert.equal(entries.length, 4, 'second register must replace, not duplicate')
})

test('registerInstalledPlugins preserves entries from other marketplaces', () => {
  const home = sandboxHome()
  const pluginsRoot = path.join(home, 'cli', 'plugins')
  fs.mkdirSync(pluginsRoot, { recursive: true })
  // Simulate an official/plugin entry that already lives in the registry.
  const otherPath = path.join(pluginsRoot, 'cache', 'zcode-plugins-official', 'superpowers', '5.1.0')
  fs.mkdirSync(otherPath, { recursive: true })
  fs.writeFileSync(path.join(pluginsRoot, 'installed_plugins.json'),
    JSON.stringify({ plugins: [{ id: 'superpowers', marketplace: 'zcode-plugins-official', installPath: otherPath }] }))

  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  const result = registerInstalledPlugins({ zcodeHome: home, packaged })

  const reg = readInstalledPlugins(home)
  assert.equal(starterkitEntries(reg).length, 4)
  const other = reg.plugins.find((e) => e.marketplace === 'zcode-plugins-official')
  assert.ok(other, 'non-starterkit entry must be preserved')
  assert.equal(other.id, 'superpowers')
  assert.equal(other.installPath, otherPath)
  assert.equal(result.preserved, 1)
})

test('registerInstalledPlugins removes stale starterkit entries on re-install', () => {
  const home = sandboxHome()
  const pluginsRoot = path.join(home, 'cli', 'plugins')
  fs.mkdirSync(pluginsRoot, { recursive: true })
  // Seed a stale starterkit entry pointing at a no-longer-valid path.
  fs.writeFileSync(path.join(pluginsRoot, 'installed_plugins.json'),
    JSON.stringify({ plugins: [
      { id: 'core', marketplace: MARKETPLACE_NAME, installPath: path.join(pluginsRoot, 'stale', 'core', '0.9.0') },
      { id: 'superpowers', marketplace: 'zcode-plugins-official', installPath: '/opt/superpowers' },
    ] }))

  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  registerInstalledPlugins({ zcodeHome: home, packaged })

  const reg = readInstalledPlugins(home)
  const sk = starterkitEntries(reg)
  assert.equal(sk.length, 4, 'stale starterkit entries must be replaced, not appended')
  assert.ok(!sk.some((e) => e.installPath.includes('0.9.0')), 'stale 0.9.0 path must be gone')
  // Other-marketplace entry preserved
  assert.ok(reg.plugins.find((e) => e.id === 'superpowers'))
})

test('uninstallStarterkit removes starterkit entries + cache + enabledPlugins, preserves other marketplaces', () => {
  const home = sandboxHome()
  const pluginsRoot = path.join(home, 'cli', 'plugins')
  // Seed an official entry alongside the starterkit install.
  const officialPath = path.join(pluginsRoot, 'cache', 'zcode-plugins-official', 'superpowers', '5.1.0')
  fs.mkdirSync(officialPath, { recursive: true })

  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  registerMarketplace({ zcodeHome: home, packaged })
  enablePlugins({ zcodeHome: home })
  registerInstalledPlugins({ zcodeHome: home, packaged })
  // Inject the official entry into the registry + enabledPlugins.
  const regPath = path.join(pluginsRoot, 'installed_plugins.json')
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'))
  reg.plugins.push({ id: 'superpowers', marketplace: 'zcode-plugins-official', installPath: officialPath })
  fs.writeFileSync(regPath, JSON.stringify(reg))
  const cliPath = path.join(home, 'cli', 'config.json')
  const cli = JSON.parse(fs.readFileSync(cliPath, 'utf8'))
  cli.plugins.enabledPlugins['superpowers@zcode-plugins-official'] = true
  fs.writeFileSync(cliPath, JSON.stringify(cli))

  uninstallStarterkit({ zcodeHome: home })

  // Registry: starterkit entries gone, official preserved
  const regAfter = JSON.parse(fs.readFileSync(regPath, 'utf8'))
  assert.equal(starterkitEntries(regAfter).length, 0)
  assert.ok(regAfter.plugins.find((e) => e.id === 'superpowers'), 'official registry entry preserved')
  // Cache + marketplace dirs removed
  assert.ok(!fs.existsSync(path.join(pluginsRoot, 'cache', 'zcode-starterkit')), 'starterkit cache dir removed')
  assert.ok(!fs.existsSync(path.join(pluginsRoot, 'marketplaces', 'zcode-starterkit')), 'starterkit marketplace dir removed')
  // enabledPlugins: starterkit keys gone, official preserved
  const cliAfter = JSON.parse(fs.readFileSync(cliPath, 'utf8'))
  for (const key of ['core', 'agents-config', 'mcp-tools', 'hooks']) {
    assert.equal(cliAfter.plugins.enabledPlugins[`${key}@${MARKETPLACE_NAME}`], undefined)
  }
  assert.equal(cliAfter.plugins.enabledPlugins['superpowers@zcode-plugins-official'], true, 'official enabledPlugins preserved')
})

test('uninstallStarterkit is safe when nothing is installed', () => {
  const home = sandboxHome()
  // No registry, no cache, no config — must not throw.
  assert.doesNotThrow(() => uninstallStarterkit({ zcodeHome: home }))
})
