import fs from 'node:fs'
import path from 'node:path'
import { ensureDir, writeText } from './fs-utils.mjs'
import { ZCODE_MANIFEST_DIR } from './constants.mjs'

// --- Windows path escape repair (kept from donor; JSON config may carry paths) ---
function detectLikelyWindowsPathEscapeIssue(raw) {
  if (typeof raw !== 'string' || !raw) return false
  return /"[A-Za-z_][A-Za-z0-9_]*"\s*:\s*"[A-Za-z]:\\(?![\\/"bfnrtu])/.test(raw)
}

function repairLikelyWindowsPathEscapes(raw) {
  if (typeof raw !== 'string' || !raw) return raw
  return raw.replace(/(:\s*")([A-Za-z]:\\(?:[^"\\]|\\.)*)(")/g, (full, prefix, value, suffix) => {
    let repaired = ''
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i]
      if (ch !== '\\') { repaired += ch; continue }
      const next = value[i + 1]
      if (next === '\\') { repaired += '\\\\'; i += 1; continue }
      if (next && /["\\/bfnrtu]/.test(next)) { repaired += `\\${next}`; i += 1; continue }
      repaired += '\\\\'
      if (next) repaired += next
      if (next) i += 1
    }
    return `${prefix}${repaired}${suffix}`
  })
}

function buildJsonParseDiagnostic(filePath, error, raw) {
  const lines = [
    `[zcode-starterkit] Invalid JSON in ${filePath}`,
    `[zcode-starterkit] Parser error: ${error?.message || String(error)}`,
  ]
  if (detectLikelyWindowsPathEscapeIssue(raw)) {
    lines.push('[zcode-starterkit] Likely cause: a Windows path was written into JSON with single backslashes.')
  }
  return new Error(lines.join('\n'))
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function mergeArraysAdditive(current = [], incoming = []) {
  const out = [...current]
  for (const item of incoming) {
    if (!out.some((existing) => JSON.stringify(existing) === JSON.stringify(item))) out.push(item)
  }
  return out
}

function mergeObjectsAdditive(current = {}, incoming = {}) {
  const out = { ...current }
  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in out)) { out[key] = value; continue }
    const existing = out[key]
    if (Array.isArray(existing) && Array.isArray(value)) out[key] = mergeArraysAdditive(existing, value)
    else if (isPlainObject(existing) && isPlainObject(value)) out[key] = mergeObjectsAdditive(existing, value)
  }
  return out
}

const ENV_PLACEHOLDER_EXACT_RE = /^\{env:([A-Z0-9_]+)\}$/
const ENV_PLACEHOLDER_INLINE_RE = /\{env:([A-Z0-9_]+)\}/g

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function resolveEnvPlaceholderString(value, env = process.env) {
  if (typeof value !== 'string' || !value.includes('{env:')) return value
  const exact = ENV_PLACEHOLDER_EXACT_RE.exec(value)
  if (exact) {
    const envValue = env?.[exact[1]]
    return typeof envValue === 'string' && envValue.length > 0 ? envValue : value
  }
  return value.replace(ENV_PLACEHOLDER_INLINE_RE, (full, envName) => {
    const envValue = env?.[envName]
    return typeof envValue === 'string' && envValue.length > 0 ? envValue : full
  })
}

function resolveEnvPlaceholdersDeep(value, env = process.env) {
  if (typeof value === 'string') return resolveEnvPlaceholderString(value, env)
  if (Array.isArray(value)) return value.map((item) => resolveEnvPlaceholdersDeep(item, env))
  if (isPlainObject(value)) {
    const out = {}
    for (const [key, entry] of Object.entries(value)) out[key] = resolveEnvPlaceholdersDeep(entry, env)
    return out
  }
  return value
}

function collectProviderNames(config) {
  return new Set(Object.keys(config?.provider || {}).filter(Boolean))
}

function isModelReferenceValid(modelId, providerNames) {
  if (!modelId || typeof modelId !== 'string') return false
  const [providerName, rest] = modelId.split('/', 2)
  if (!providerName || !rest) return false
  return providerNames.has(providerName)
}

function normalizeModelField({ field, out, current, providerNames, changes }) {
  const value = out[field]
  if (value == null) return
  if (isModelReferenceValid(value, providerNames)) return
  const fallbackCurrent = current?.[field]
  if (isModelReferenceValid(fallbackCurrent, providerNames)) {
    out[field] = fallbackCurrent
    changes.push({ type: 'model_fallback', field, from: value, to: fallbackCurrent, reason: 'invalid provider/model reference after merge' })
    return
  }
  delete out[field]
  changes.push({ type: 'model_removed', field, from: value, reason: 'invalid provider/model reference and no valid fallback available' })
}

function normalizeAgentModels({ out, current, providerNames, changes }) {
  if (!isPlainObject(out.agent)) return
  for (const [agentName, agentConfig] of Object.entries(out.agent)) {
    if (!isPlainObject(agentConfig) || !agentConfig.model) continue
    if (isModelReferenceValid(agentConfig.model, providerNames)) continue
    const currentFallback = current?.agent?.[agentName]?.model
    if (isModelReferenceValid(currentFallback, providerNames)) {
      agentConfig.model = currentFallback
      changes.push({ type: 'agent_model_fallback', agent: agentName, from: out.agent[agentName].model, to: currentFallback, reason: 'invalid provider/model reference after merge' })
      continue
    }
    delete agentConfig.model
    changes.push({ type: 'agent_model_removed', agent: agentName, from: out.agent[agentName].model, reason: 'invalid provider/model reference and no valid fallback available' })
  }
}

// OpenCode TS plugin entries (plugin:[]) never run on ZCode; never merge them.
function stripPluginArray(obj) {
  if (isPlainObject(obj)) delete obj.plugin
}

export function mergeZcodeConfigAdditive({ current, baseline }) {
  const safeBaseline = clone(baseline)
  stripPluginArray(safeBaseline)
  const out = { ...current }
  stripPluginArray(out) // never carry an OpenCode plugin[] into ZCode config
  for (const [key, value] of Object.entries(safeBaseline)) {
    if (!(key in out)) { out[key] = value; continue }
    const existing = out[key]
    if (Array.isArray(existing) && Array.isArray(value)) out[key] = mergeArraysAdditive(existing, value)
    else if (isPlainObject(existing) && isPlainObject(value)) out[key] = mergeObjectsAdditive(existing, value)
  }
  stripPluginArray(out)
  return out
}

export function normalizeZcodeConfig({ current = {}, baseline = {}, merged, env = process.env }) {
  const out = resolveEnvPlaceholdersDeep(clone(merged), env)
  stripPluginArray(out)
  const changes = []
  const providerNames = collectProviderNames(out)
  normalizeModelField({ field: 'model', out, current, providerNames, changes })
  normalizeModelField({ field: 'small_model', out, current, providerNames, changes })
  normalizeAgentModels({ out, current, providerNames, changes })
  return {
    config: out,
    changes,
    providerNames: [...providerNames].sort(),
    mergedKeys: Object.keys(baseline),
  }
}

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    if (detectLikelyWindowsPathEscapeIssue(raw)) {
      const repaired = repairLikelyWindowsPathEscapes(raw)
      if (repaired !== raw) {
        try { return JSON.parse(repaired) } catch { /* fall through */ }
      }
    }
    throw buildJsonParseDiagnostic(filePath, error, raw)
  }
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function writeMergeManifest({ targetPath, sourcePath, mergedKeys, normalizedChanges = [], providerNames = [], note, manifestDir = ZCODE_MANIFEST_DIR }) {
  ensureDir(manifestDir)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const manifestPath = path.join(manifestDir, `config-merge-${stamp}.json`)
  writeText(manifestPath, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    targetPath, sourcePath, mergedKeys, normalizedChanges, providerNames,
    note: note || null,
  }, null, 2)}\n`)
  return manifestPath
}
