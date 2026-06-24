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

test('registerMarketplace writes marketplace.json listing both plugins', () => {
  const home = sandboxHome()
  const baselineRoot = path.resolve('baseline')
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot })
  const mp = registerMarketplace({ zcodeHome: home, packaged })
  const mpJson = JSON.parse(fs.readFileSync(mp.marketplacePath, 'utf8'))
  assert.equal(mpJson.name, 'zcode-starterkit')
  assert.equal(mpJson.plugins.length, 2)
  assert.ok(mpJson.plugins.some((p) => p.name === 'core'))
  assert.ok(mpJson.plugins.some((p) => p.name === 'agents-config'))
})

test('enablePlugins sets both plugins true in cli/config.json without wiping existing', () => {
  const home = sandboxHome()
  const cliConfigPath = path.join(home, 'cli', 'config.json')
  fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true })
  fs.writeFileSync(cliConfigPath, JSON.stringify({ plugins: { enabledPlugins: { 'superpowers@zcode-plugins-official': true } } }))
  enablePlugins({ zcodeHome: home })
  const cfg = readCliConfig({ zcodeHome: home })
  assert.equal(cfg.plugins.enabledPlugins['superpowers@zcode-plugins-official'], true)
  assert.equal(cfg.plugins.enabledPlugins['core@zcode-starterkit'], true)
  assert.equal(cfg.plugins.enabledPlugins['agents-config@zcode-starterkit'], true)
})

test('no file is written outside the sandbox home', () => {
  const home = sandboxHome()
  packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  assert.ok(!fs.existsSync(path.join(os.homedir(), '.zcode', 'cli', 'plugins', 'cache', 'zcode-starterkit')))
})
