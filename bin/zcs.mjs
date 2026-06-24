#!/usr/bin/env node
import { installProjectOverlay } from '../src/install-project.mjs'
import { printHelp, parseArgs } from '../src/cli.mjs'

async function main() {
  const cli = parseArgs(process.argv.slice(2))
  if (cli.help) { printHelp('zcs'); process.exit(0) }
  const command = cli.command || 'install'
  if (command === 'install') {
    await installProjectOverlay({ cwd: process.cwd(), args: cli.args, options: cli.options })
    process.exit(0)
  }
  printHelp('zcs')
  process.exit(1)
}

main().catch((error) => { console.error(error); process.exit(1) })
