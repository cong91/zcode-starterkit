#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installGlobal } from '../src/install-global.mjs'
import { uninstallStarterkit } from '../src/plugin-packager.mjs'
import { printHelp, parseArgs } from '../src/cli.mjs'
import { resolveZcodeHome } from '../src/constants.mjs'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const cli = parseArgs(process.argv.slice(2))
  if (cli.help) { printHelp('zcode-starterkit'); process.exit(0) }

  const command = cli.command || 'install'
  if (command !== 'install' && command !== 'uninstall') { printHelp('zcode-starterkit'); process.exit(1) }

  let zcodeHome = resolveZcodeHome()
  if (cli.sandbox) {
    zcodeHome = path.join(PACKAGE_ROOT, '.sandbox', '.zcode')
  }

  if (command === 'uninstall') {
    const result = uninstallStarterkit({ zcodeHome })
    console.log(`[zcode-starterkit] Uninstalled from ${zcodeHome}`)
    console.log(`[zcode-starterkit]   registry entries removed: ${result.removed.registryEntries}`)
    console.log(`[zcode-starterkit]   enabledPlugins keys removed: ${result.removed.enabledPluginKeys.length}`)
    if (result.removed.cacheDir) console.log(`[zcode-starterkit]   removed cache: ${result.removed.cacheDir}`)
    if (result.removed.marketplaceDir) console.log(`[zcode-starterkit]   removed marketplace: ${result.removed.marketplaceDir}`)
    if (result.removed.mcpEntries.length) console.log(`[zcode-starterkit]   removed starterkit-managed MCP entries: ${result.removed.mcpEntries.join(', ')}`)
    process.exit(0)
  }

  const skipShims = cli.sandbox
  await installGlobal({ cwd: process.cwd(), zcodeHome, skipShims, options: cli.options })
  process.exit(0)
}

main().catch((error) => { console.error(error); process.exit(1) })
