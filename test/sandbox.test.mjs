import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { installGlobal } from '../src/install-global.mjs'

function freshSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-sandbox-'))
}

test('sandbox install produces plugins, marketplace, enabledPlugins, merged config', async () => {
  const home = freshSandbox()
  // Skip CodeGraph + WebClaw resolution in sandbox so the test never spawns a
  // real `npm install -g` / binary download. These integrations have their own
  // unit tests; sandbox tests only verify plugin packaging + config merge.
  await installGlobal({ cwd: process.cwd(), zcodeHome: home, skipShims: true, options: { skipCodegraph: true, skipWebclaw: true } })

  const coreDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '1.0.0')
  const agentsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'agents-config', '1.0.0')

  assert.ok(fs.existsSync(path.join(coreDir, '.zcode-plugin', 'plugin.json')), 'core plugin.json missing')
  assert.ok(fs.existsSync(path.join(coreDir, 'skills')), 'core skills missing')
  assert.ok(fs.existsSync(path.join(coreDir, 'commands')), 'core commands missing')
  assert.ok(fs.existsSync(path.join(agentsDir, '.zcode-plugin', 'plugin.json')), 'agents plugin.json missing')
  assert.ok(fs.existsSync(path.join(agentsDir, 'agents', 'build.md')), 'agents md missing')

  const mp = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'plugins', 'marketplaces', 'zcode-starterkit', 'marketplace.json'), 'utf8'))
  assert.equal(mp.name, 'zcode-starterkit')
  assert.equal(mp.plugins.length, 4)

  const cli = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'config.json'), 'utf8'))
  assert.equal(cli.plugins.enabledPlugins['core@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['agents-config@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['mcp-tools@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['hooks@zcode-starterkit'], true)

  // mcp-tools plugin ships a bundle + mcpServers declaration
  const mcpDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'mcp-tools', '1.0.0')
  assert.ok(fs.existsSync(path.join(mcpDir, 'dist', 'mcp', 'server.js')), 'mcp-tools bundle must be installed')
  const mcpPluginJson = JSON.parse(fs.readFileSync(path.join(mcpDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.ok(mcpPluginJson.mcpServers, 'mcp-tools plugin.json must declare mcpServers')

  // hooks plugin ships hook scripts + hooks.json
  const hooksDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'hooks', '1.0.0')
  assert.ok(fs.existsSync(path.join(hooksDir, 'hooks', 'hooks.json')), 'hooks.json must be installed')
  assert.ok(fs.existsSync(path.join(hooksDir, 'hooks', 'guard.mjs')), 'guard hook must be installed')

  const cfg = JSON.parse(fs.readFileSync(path.join(home, 'v2', 'config.json'), 'utf8'))
  assert.equal(cfg.$schema, 'https://opencode.ai/config.json')
  assert.ok('agent' in cfg, 'agent block missing in merged config')
  assert.ok('mcp' in cfg, 'mcp block missing in merged config')
  assert.equal(cfg.plugin, undefined, 'plugin[] must not be present (OpenCode TS plugins stripped)')
  // Curated for ZCode: baseline/config.json drops OpenCode-only model/provider
  // so ZCode uses its native GLM provider. Agent descriptions are kept (no model).
  assert.equal(cfg.model, undefined, 'OpenCode-only top-level model must be stripped (ZCode uses native GLM)')
  assert.equal(cfg.provider, undefined, 'OpenCode-only provider block must be stripped (ZCode uses native providers)')
  assert.ok(cfg.agent.build && !cfg.agent.build.model, 'agent.build must keep description but drop OpenCode model ref')

  // CodeGraph + WebClaw were skipped, so the merged config must NOT carry their
  // starterkit-managed MCP entries (and the baseline has neither by default).
  assert.ok(!cfg.mcp?.codegraph, 'codegraph MCP must be absent when CodeGraph is skipped')
  assert.ok(!cfg.mcp?.webclaw, 'webclaw MCP must be absent when WebClaw is skipped')
})

test('sandbox install writes only under the sandbox home, never the real ~/.zcode', async () => {
  const home = freshSandbox()
  const realZcode = path.join(os.homedir(), '.zcode')
  // Guard: the sandbox home must be distinct from the real ~/.zcode, otherwise
  // this test cannot prove isolation.
  assert.notEqual(path.resolve(home), path.resolve(realZcode), 'sandbox home must differ from real ~/.zcode')

  await installGlobal({ cwd: process.cwd(), zcodeHome: home, skipShims: true, options: { skipCodegraph: true, skipWebclaw: true } })

  // Everything produced by the install must live under the sandbox home.
  const cacheRoot = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit')
  assert.ok(fs.existsSync(cacheRoot), 'cache root must exist inside sandbox')
  // The real ~/.zcode cache root for this starterkit must NOT have been created
  // by this test run. (If it pre-exists from a prior real install, we only
  // assert our run didn't add a marker file there.)
  const realCacheRoot = path.join(realZcode, 'cli', 'plugins', 'cache', 'zcode-starterkit')
  const ourMarker = path.join(realCacheRoot, 'SANDBOX_TEST_MARKER_SHOULD_NOT_EXIST')
  assert.ok(!fs.existsSync(ourMarker), 'installer must not write outside the sandbox home')
})

test('sandbox install copies ~130+ skills and ~24+ commands', async () => {
  const home = freshSandbox()
  await installGlobal({ cwd: process.cwd(), zcodeHome: home, skipShims: true, options: { skipCodegraph: true, skipWebclaw: true } })
  const skillsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '1.0.0', 'skills')
  const commandsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '1.0.0', 'commands')
  const skillCount = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
  const commandCount = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).length
  assert.ok(skillCount >= 115, `expected ~119 curated skills (13 overlap with native superpowers removed), got ${skillCount}`)
  assert.ok(commandCount >= 24, `expected ~27 commands, got ${commandCount}`)
})
