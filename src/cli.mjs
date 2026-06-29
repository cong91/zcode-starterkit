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
      withCodegraph: args.includes('--with-codegraph'),
      skipCodegraph: args.includes('--skip-codegraph') || args.includes('--no-codegraph'),
      requireCodegraph: args.includes('--require-codegraph'),
      allowCodegraphHooks: args.includes('--allow-codegraph-hooks'),
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
  console.log('  --help, -h      Show help')
  console.log('\nGlobal install flags:')
  console.log('  --sandbox           Install into <repo>/.sandbox/.zcode instead of real ~/.zcode (safe test)')
  console.log('  --with-codegraph     Enable CodeGraph integration; install it automatically if missing (default behavior)')
  console.log('  --skip-codegraph     Disable CodeGraph integration; no MCP, indexing, refresh, or hooks')
  console.log('  --require-codegraph  Fail install if CodeGraph cannot be enabled')
  console.log('  --allow-codegraph-hooks  Advanced opt-in: append CodeGraph refresh hooks even when core.hooksPath/Husky is configured')
  console.log('  --with-webclaw       Enable WebClaw MCP; download/install it automatically if missing (default behavior)')
  console.log('  --skip-webclaw       Disable WebClaw MCP and remove starterkit-managed webclaw config')
  console.log('  --require-webclaw    Fail install if WebClaw MCP cannot be enabled')
}
