export function parseArgs(argv) {
  const args = [...argv]
  const help = args.includes('--help') || args.includes('-h')
  const sandbox = args.includes('--sandbox')
  const command = args.find((arg) => !arg.startsWith('-')) || null

  return {
    help,
    sandbox,
    command,
    args,
    options: {
      withCodebaseMemory: args.includes('--with-codebase-memory'),
      skipCodebaseMemory: args.includes('--skip-codebase-memory') || args.includes('--no-codebase-memory'),
      requireCodebaseMemory: args.includes('--require-codebase-memory'),
      withWebclaw: args.includes('--with-webclaw'),
      skipWebclaw: args.includes('--skip-webclaw') || args.includes('--no-webclaw'),
      requireWebclaw: args.includes('--require-webclaw'),
    },
  }
}

export function printHelp(binName) {
  console.log(`${binName} <command>\n`)
  console.log('Commands:')
  console.log(`  ${binName} install    Install baseline as ZCode plugins into ZCODE_HOME (default ~/.zcode) and merge config into v2/config.json`)
  console.log(`  ${binName} uninstall  Remove all zcode-starterkit plugins, registry entries, cache, marketplace, enabledPlugins keys, and starterkit-managed MCP config (codebase-memory/webclaw)`)
  console.log('  --help, -h      Show help')
  console.log('\nGlobal install flags:')
  console.log('  --sandbox              Install into <repo>/.sandbox/.zcode instead of real ~/.zcode (safe test)')
  console.log('  --with-codebase-memory Enable Codebase-Memory integration; install it automatically if missing (default behavior)')
  console.log('  --skip-codebase-memory Disable Codebase-Memory integration; no MCP, indexing, refresh, or hooks')
  console.log('  --require-codebase-memory Fail install if Codebase-Memory cannot be enabled')
  console.log('  --with-webclaw         Enable WebClaw MCP; download/install it automatically if missing (default behavior)')
  console.log('  --skip-webclaw         Disable WebClaw MCP and remove starterkit-managed webclaw config')
  console.log('  --require-webclaw      Fail install if WebClaw MCP cannot be enabled')
}
