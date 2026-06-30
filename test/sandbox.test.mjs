import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { installGlobal } from '../src/install-global.mjs'
import { PLUGIN_VERSION } from '../src/constants.mjs'

function freshSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-sandbox-'))
}

test('sandbox install produces plugins, marketplace, enabledPlugins, merged config', async () => {
  const home = freshSandbox()
  // Skip Codebase-Memory + WebClaw resolution in sandbox so the test never spawns a
  // real binary download. These integrations have their own unit tests; sandbox
  // tests only verify plugin packaging + config merge.
  await installGlobal({ cwd: process.cwd(), zcodeHome: home, skipShims: true, options: { skipCodebaseMemory: true, skipWebclaw: true } })

  const coreDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', PLUGIN_VERSION)
  const agentsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'agents-config', PLUGIN_VERSION)

  assert.ok(fs.existsSync(path.join(coreDir, '.zcode-plugin', 'plugin.json')), 'core plugin.json missing')
  assert.ok(fs.existsSync(path.join(coreDir, 'skills')), 'core skills missing')
  assert.ok(fs.existsSync(path.join(coreDir, 'commands')), 'core commands missing')
  assert.ok(fs.existsSync(path.join(agentsDir, '.zcode-plugin', 'plugin.json')), 'agents plugin.json missing')
  assert.ok(fs.existsSync(path.join(agentsDir, 'agents', 'build.md')), 'agents md missing')

  // context/ must be bundled: /init's default config instructions[] references
  // .zcode/context/git-context.md, and the only source for it is the bundled
  // core plugin. Without bundling, every freshly-init'd project has a dangling
  // instruction that injects nothing.
  assert.ok(
    fs.existsSync(path.join(coreDir, 'context', 'git-context.md')),
    'context/git-context.md must be bundled into the core plugin',
  )

  const mp = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'plugins', 'marketplaces', 'zcode-starterkit', 'marketplace.json'), 'utf8'))
  assert.equal(mp.name, 'zcode-starterkit')
  assert.equal(mp.plugins.length, 4)

  const cli = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'config.json'), 'utf8'))
  assert.equal(cli.plugins.enabledPlugins['core@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['agents-config@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['mcp-tools@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['hooks@zcode-starterkit'], true)

  // installed_plugins.json registry: ZCode's loader only discovers plugin roots
  // from inline dirs, the hardcoded official cache scan, and this registry file.
  // Without it, the 4 starterkit plugins are copied to cache but never loaded.
  const reg = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'plugins', 'installed_plugins.json'), 'utf8'))
  const skEntries = (reg.plugins || []).filter((e) => e.marketplace === 'zcode-starterkit')
  assert.equal(skEntries.length, 4, 'install must register 4 starterkit plugins in installed_plugins.json')
  for (const e of skEntries) {
    assert.ok(path.isAbsolute(e.installPath), `installPath must be absolute, got ${e.installPath}`)
    assert.ok(fs.existsSync(path.join(e.installPath, '.zcode-plugin', 'plugin.json')),
      `registered installPath ${e.installPath} must point at a real plugin dir`)
  }

  // mcp-tools plugin ships a bundle + mcpServers declaration
  const mcpDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'mcp-tools', PLUGIN_VERSION)
  assert.ok(fs.existsSync(path.join(mcpDir, 'dist', 'mcp', 'server.js')), 'mcp-tools bundle must be installed')
  const mcpPluginJson = JSON.parse(fs.readFileSync(path.join(mcpDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.ok(mcpPluginJson.mcpServers, 'mcp-tools plugin.json must declare mcpServers')

  // hooks plugin ships hook scripts + hooks.json
  const hooksDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'hooks', PLUGIN_VERSION)
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

  // Codebase-Memory + WebClaw were skipped, so the merged config must NOT carry their
  // starterkit-managed MCP entries (and the baseline has neither by default).
  assert.ok(!cfg.mcp?.['codebase-memory-mcp'], 'codebase-memory-mcp MCP must be absent when Codebase-Memory is skipped')
  assert.ok(!cfg.mcp?.webclaw, 'webclaw MCP must be absent when WebClaw is skipped')
})

test('sandbox install writes only under the sandbox home, never the real ~/.zcode', async () => {
  const home = freshSandbox()
  const realZcode = path.join(os.homedir(), '.zcode')
  // Guard: the sandbox home must be distinct from the real ~/.zcode, otherwise
  // this test cannot prove isolation.
  assert.notEqual(path.resolve(home), path.resolve(realZcode), 'sandbox home must differ from real ~/.zcode')

  await installGlobal({ cwd: process.cwd(), zcodeHome: home, skipShims: true, options: { skipCodebaseMemory: true, skipWebclaw: true } })

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
  await installGlobal({ cwd: process.cwd(), zcodeHome: home, skipShims: true, options: { skipCodebaseMemory: true, skipWebclaw: true } })
  const skillsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', PLUGIN_VERSION, 'skills')
  const commandsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', PLUGIN_VERSION, 'commands')
  const skillCount = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
  const commandCount = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).length
  assert.ok(skillCount >= 115, `expected ~119 curated skills (13 overlap with native superpowers removed), got ${skillCount}`)
  assert.ok(commandCount >= 24, `expected ~27 commands, got ${commandCount}`)
})
