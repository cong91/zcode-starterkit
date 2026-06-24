import path from 'node:path'
import { ACTION_OPTIONS, MODEL_PRESETS, PROJECT_MEMORY_FILES, ZCODE_STARTERKIT_BASELINE_ROOT } from './constants.mjs'
import { confirm, askText, selectOption } from './prompt.mjs'
import { copyDirMissing, ensureDir, writeText, exists } from './fs-utils.mjs'
import { renderProjectMemoryFiles, renderProjectZcodeJson } from './templates.mjs'

function printSummary({ cwd, action, model }) {
  console.log('\n[zcs] Summary')
  console.log(`repo=${cwd}`)
  console.log(`action=${action}`)
  console.log(`model=${model || 'inherit/global-default'}`)
  console.log('apply=.zcode/config.json + full missing .zcode/memory tree')
}

function materializeThinOverlay({ cwd, action, model, forceMemory = false }) {
  const root = path.join(cwd, '.zcode')
  const memoryRoot = path.join(root, 'memory')
  const memoryDir = path.join(memoryRoot, 'project')
  ensureDir(memoryDir)

  writeText(path.join(root, 'config.json'), renderProjectZcodeJson({ model }))

  const baselineMemoryRoot = path.join(ZCODE_STARTERKIT_BASELINE_ROOT, 'memory')
  const support = copyDirMissing(baselineMemoryRoot, memoryRoot, {
    filter: (srcPath) => {
      const relative = path.relative(baselineMemoryRoot, srcPath)
      if (!relative) return true
      const parts = relative.split(path.sep).filter(Boolean)
      return parts[0] !== 'project'
    },
  })

  const files = renderProjectMemoryFiles({ cwd, action, model })
  const written = []
  const preserved = []
  for (const name of PROJECT_MEMORY_FILES) {
    const targetPath = path.join(memoryDir, name)
    if (!forceMemory && exists(targetPath)) { preserved.push(targetPath); continue }
    writeText(targetPath, files[name])
    written.push(targetPath)
  }
  return { written, preserved, supportCopied: support.copied, supportPreserved: support.preserved }
}

function resolvePresetModel(presetKey, explicitModel) {
  if (presetKey === 'custom') return explicitModel || null
  return MODEL_PRESETS[presetKey]?.model || null
}

export async function installProjectOverlay({ cwd, args, options = {} }) {
  console.log('[zcs] Project overlay install')
  console.log(`cwd=${cwd}`)

  const optionBag = options || {}
  let action = optionBag.action || null
  if (!action && optionBag.yes) action = 'Initialize project'
  if (!action) action = await selectOption({ title: 'Step 1/3 — Select action', options: ACTION_OPTIONS, defaultIndex: 0 })
  if (action === 'Exit') { console.log('[zcs] Exit without changes'); return }
  if (action !== 'Initialize project') {
    console.log(`[zcs] Action "${action}" is not implemented yet in this scaffold. Use Initialize project first.`)
    return
  }

  let presetKey = optionBag.preset || null
  if (!presetKey) {
    const preset = await selectOption({
      title: 'Step 2/3 — Choose model preset',
      options: Object.entries(MODEL_PRESETS).map(([key, item]) => `${key}: ${item.label}`),
      defaultIndex: 1,
    })
    presetKey = preset.split(':')[0]
  }

  let model = resolvePresetModel(presetKey, optionBag.model)
  if (presetKey === 'custom' && !model) model = await askText({ title: 'Enter custom model id', placeholder: 'provider/model' })

  printSummary({ cwd, action, model })
  const approved = optionBag.yes ? true : await confirm({ title: 'Step 3/3 — Apply workspace init now?', defaultYes: true })
  if (!approved) { console.log('[zcs] Cancelled before writing files'); return }

  const overlay = materializeThinOverlay({ cwd, action, model, forceMemory: optionBag.forceMemory })
  console.log(`[zcs] Thin overlay installed`)
  console.log(`[zcs] Project memory files written=${overlay.written.length} preserved=${overlay.preserved.length}`)
  console.log(`[zcs] Memory support files copied=${overlay.supportCopied.length} preserved=${overlay.supportPreserved.length}`)
  console.log('[zcs] Ready to code')
}
