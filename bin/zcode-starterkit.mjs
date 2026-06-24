#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installGlobal } from '../src/install-global.mjs'
import { printHelp, parseArgs } from '../src/cli.mjs'
import { resolveZcodeHome } from '../src/constants.mjs'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const cli = parseArgs(process.argv.slice(2))
  if (cli.help) { printHelp('zcode-starterkit'); process.exit(0) }

  const command = cli.command || 'install'
  if (command !== 'install') { printHelp('zcode-starterkit'); process.exit(1) }

  let zcodeHome = resolveZcodeHome()
  if (cli.sandbox) {
    zcodeHome = path.join(PACKAGE_ROOT, '.sandbox', '.zcode')
  }

  await installGlobal({ cwd: process.cwd(), zcodeHome })
  process.exit(0)
}

main().catch((error) => { console.error(error); process.exit(1) })
