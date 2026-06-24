import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

export async function selectOption({ title, options, defaultIndex = 0 }) {
  const rl = readline.createInterface({ input, output })
  console.log(`\n${title}`)
  options.forEach((option, index) => {
    console.log(`${index + 1}. ${option}`)
  })
  const answer = await rl.question(`Choose [${defaultIndex + 1}]: `)
  rl.close()
  const selectedIndex = Number(answer || defaultIndex + 1) - 1
  return options[selectedIndex] || options[defaultIndex]
}

export async function askText({ title, placeholder = '' }) {
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`${title}${placeholder ? ` (${placeholder})` : ''}: `)
  rl.close()
  return answer.trim()
}

export async function confirm({ title, defaultYes = true }) {
  const rl = readline.createInterface({ input, output })
  const suffix = defaultYes ? '[Y/n]' : '[y/N]'
  const answer = await rl.question(`${title} ${suffix}: `)
  rl.close()
  const normalized = answer.trim().toLowerCase()
  if (!normalized) return defaultYes
  return normalized === 'y' || normalized === 'yes'
}
