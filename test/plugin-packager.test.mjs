import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { packageBaselineAsPlugins, registerMarketplace, enablePlugins, readCliConfig } from '../src/plugin-packager.mjs'

function sandboxHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-pkg-'))
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
