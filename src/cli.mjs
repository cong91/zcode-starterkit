export function parseArgs(argv) {
  const args = [...argv]
  const help = args.includes('--help') || args.includes('-h')
  const sandbox = args.includes('--sandbox')
  const command = args.find((arg) => !arg.startsWith('-')) || null

  const getFlagValue = (name) => {
    const prefix = `${name}=`
    const inline = args.find((arg) => arg.startsWith(prefix))
    if (inline) return inline.slice(prefix.length)
    const index = args.indexOf(name)
    if (index >= 0 && index + 1 < args.length) return args[index + 1]
    return null
  }

  return {
    help,
    sandbox,
    command,
    args,
    options: {
      action: getFlagValue('--action'),
      preset: getFlagValue('--preset'),
      model: getFlagValue('--model'),
      yes: args.includes('--yes'),
      forceMemory: args.includes('--force-memory'),
    },
  }
}

export function printHelp(binName) {
  const isGlobal = binName === 'zcode-starterkit'
  console.log(`${binName} <command>\n`)
  console.log('Commands:')
  console.log(`  ${binName} install    ${isGlobal ? 'Install baseline as ZCode plugins into ZCODE_HOME (default ~/.zcode) and merge config into v2/config.json' : 'Install thin project overlay (.zcode/) in current repo'}`)
  console.log('  --help, -h      Show help')
  if (isGlobal) {
    console.log('\nGlobal install flags:')
    console.log('  --sandbox       Install into <repo>/.sandbox/.zcode instead of real ~/.zcode (safe test)')
  } else {
    console.log('\nProject install flags:')
    console.log('  --action <name>   Non-interactive action selection')
    console.log('  --preset <name>   free | recommended | custom | skip')
    console.log('  --model <id>      Custom model id when using scripted install')
    console.log('  --yes             Apply without confirmation prompt')
    console.log('  --force-memory    Regenerate existing .zcode/memory/project/*.md files')
  }
}
