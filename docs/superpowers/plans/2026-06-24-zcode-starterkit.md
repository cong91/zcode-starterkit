# zcode-starterkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `zcode-starterkit`, an npm bootstrap package for the ZCode Agent that ports the portable parts of `opencode-starterkit` (config + 9 agents + 26 commands + 133 skills + memory templates + MCP config) into two ZCode plugins, merges config into `~/.zcode/v2/config.json`, and installs via `npx zcode-starterkit` with a sandboxed home-dir simulation for safe testing.

**Architecture:** Two-tier installer (global baseline as ZCode plugins + thin `.zcode/` project overlay). Baseline is vendored and packaged into two plugins (`core` = skills+commands, `agents-config` = agent md) registered through a `zcode-starterkit` marketplace and enabled via `cli/config.json`. Config is additively merged into `v2/config.json` (schema `https://opencode.ai/config.json`, shared with OpenCode). OpenCode TS plugins/tools are NOT ported (Phase 2). Sandboxing via `ZCODE_HOME` + `HOME`/`USERPROFILE` env overrides.

**Tech Stack:** Node.js >=20, ES modules (`.mjs`), `node --test`, no runtime deps. Source donor: `C:\Users\PC\Documents\Project\opencode-starterkit`. Target repo: `C:\Users\PC\Documents\Project\zcode-starterkit`.

**Source map (donor files, already read):**
- `opencode-starterkit/src/constants.mjs`, `fs-utils.mjs`, `config-merge.mjs`, `templates.mjs`, `prompt.mjs`, `install-global.mjs`, `install-project.mjs`, `cli.mjs`, `memory-bootstrap.mjs`, `br-cli.mjs`
- `opencode-starterkit/bin/*.mjs`
- `opencode-starterkit/baseline/{opencode.json,agent/,command/,skill/,memory/,AGENTS.md,context/,...}`
- `opencode-starterkit/test/*.mjs`

---

## File Structure

```
zcode-starterkit/
├── package.json                 # NEW — npm package, bin, scripts
├── README.md                    # NEW — usage (port+adapt from opencode README)
├── .gitignore                   # DONE
├── baseline/
│   ├── config.json              # NEW — port of opencode.json with plugin[] stripped
│   ├── agents/                  # 9 *.md — copied verbatim
│   ├── commands/                # 26 *.md — copied verbatim
│   ├── skills/                  # 133 dirs — copied verbatim
│   ├── memory/                  # templates — copied verbatim
│   ├── AGENTS.md                # copied verbatim
│   ├── context/                 # copied verbatim
│   └── (no plugin/, no tool/, no beads-related files)
├── src/
│   ├── constants.mjs            # PORT — ZCode paths + ZCODE_HOME override
│   ├── fs-utils.mjs             # COPY verbatim (generic fs helpers)
│   ├── config-merge.mjs         # PORT — rename opencode→zcode, strip plugin[] before merge
│   ├── plugin-packager.mjs      # NEW — package baseline into 2 plugins + marketplace + enablePlugins
│   ├── templates.mjs            # PORT — .opencode→.zcode, opencode.json→config.json, drop beads refs
│   ├── prompt.mjs               # COPY verbatim (readline prompts)
│   ├── install-global.mjs       # PORT — use plugin-packager, drop beads/memory/command-init
│   ├── install-project.mjs      # PORT — .zcode overlay, drop command-init/beads/memory-db
│   └── cli.mjs                  # PORT — zcode-starterkit/zcs help text + --sandbox flag
├── bin/
│   ├── zcode-starterkit.mjs     # NEW — global install entrypoint
│   └── zcs.mjs                  # NEW — project overlay entrypoint
└── test/
    ├── plugin-packager.test.mjs # NEW — TDD for plugin packaging
    ├── config-merge.test.mjs    # NEW — TDD for plugin[] strip + additive merge
    ├── sandbox.test.mjs         # NEW — full sandbox install, no escape into real ~/.zcode
    └── install-safety.test.mjs  # PORT — backup/denylist/path-escape guards
```

**Responsibilities:**
- `constants.mjs` — all path constants, `ZCODE_HOME` resolution, sandbox helpers.
- `fs-utils.mjs` — pure fs helpers (ensureDir, copyDir*, backup, writeText). No ZCode knowledge.
- `config-merge.mjs` — JSON additive merge + normalization (model/plugin/mcp), env placeholder resolution, Windows path repair. ZCode-aware only via symbol names.
- `plugin-packager.mjs` — the NEW ZCode-specific core: turns `baseline/` into two plugin dirs under cache, writes `marketplace.json`, enables plugins in `cli/config.json`.
- `templates.mjs` — renders project memory markdown + thin `.zcode/config.json`.
- `install-global.mjs` — orchestrates global install (steps 1–8 in design).
- `install-project.mjs` — orchestrates `.zcode/` overlay.
- `cli.mjs` — arg parsing + help printing.

---

### Task 1: package.json + README skeleton

**Files:**
- Create: `zcode-starterkit/package.json`
- Create: `zcode-starterkit/README.md`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "zcode-starterkit",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "description": "Global baseline (ZCode plugins) + thin project overlay installer for ZCode Agent.",
  "license": "MIT",
  "bin": {
    "zcode-starterkit": "./bin/zcode-starterkit.mjs",
    "zcs": "./bin/zcs.mjs"
  },
  "files": [
    "baseline",
    "bin",
    "src",
    "test",
    "README.md"
  ],
  "scripts": {
    "test": "node --test",
    "test:smoke": "node ./bin/zcode-starterkit.mjs --help && node ./bin/zcs.mjs --help"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Write README.md (minimal, expand later)**

```markdown
# zcode-starterkit

Bootstrap package for the **ZCode Agent**. Installs a shared baseline (skills, commands, agents, config) as ZCode plugins globally, then creates a thin per-project `.zcode/` overlay.

## Install (global baseline)

```bash
npx zcode-starterkit
```

## Sandbox test (does not touch real ~/.zcode)

```bash
zcode-starterkit --sandbox
```

## Project overlay

```bash
zcs install
```

See `docs/superpowers/specs/2026-06-24-zcode-starterkit-design.md` for the full design.
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/PC/Documents/Project/zcode-starterkit
git add package.json README.md
git commit -m "feat: add package.json and README"
```

---

### Task 2: Copy baseline assets verbatim from opencode-starterkit

**Files:**
- Create: `zcode-starterkit/baseline/{agents,commands,skills,memory,context}/` — copied verbatim
- Create: `zcode-starterkit/baseline/AGENTS.md` — copied verbatim

- [ ] **Step 1: Copy portable baseline folders (exclude plugin/, tool/, opencode.json, beads-related, package files)**

Run (bash):
```bash
DONOR=C:/Users/PC/Documents/Project/opencode-starterkit/baseline
DEST=C:/Users/PC/Documents/Project/zcode-starterkit/baseline
mkdir -p "$DEST"
cp -r "$DONOR/agent" "$DEST/agents"
cp -r "$DONOR/command" "$DEST/commands"
cp -r "$DONOR/skill" "$DEST/skills"
cp -r "$DONOR/memory" "$DEST/memory"
cp -r "$DONOR/context" "$DEST/context"
cp "$DONOR/AGENTS.md" "$DEST/AGENTS.md"
cp "$DONOR/AGENT_ALIGNMENT.md" "$DEST/AGENT_ALIGNMENT.md" 2>/dev/null || true
cp "$DONOR/README.md" "$DEST/README.md" 2>/dev/null || true
cp "$DONOR/QUALITY.md" "$DEST/QUALITY.md" 2>/dev/null || true
```

Note: donor uses `agent/` (singular); target uses `agents/` to match ZCode plugin `agents` convention and avoid confusion. `command/` → `commands/`, `skill/` → `skills/` likewise.

- [ ] **Step 2: Verify counts**

Run:
```bash
ls C:/Users/PC/Documents/Project/zcode-starterkit/baseline/agents | wc -l      # expect 9
ls C:/Users/PC/Documents/Project/zcode-starterkit/baseline/commands | wc -l   # expect 26
ls -d C:/Users/PC/Documents/Project/zcode-starterkit/baseline/skills/*/ | wc -l  # expect 133
```
Expected: 9, 26, 133 (or close; 133 is the donor count). If counts differ, re-check donor.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/PC/Documents/Project/zcode-starterkit
git add baseline
git commit -m "feat: vendor portable baseline (agents, commands, skills, memory, docs)"
```

---

### Task 3: baseline/config.json (port of opencode.json, strip plugin[])

**Files:**
- Create: `zcode-starterkit/baseline/config.json`

- [ ] **Step 1: Generate config.json from opencode.json with `plugin` key removed**

The `plugin:[]` array lists OpenCode TS plugins (`@tarquinen/opencode-dcp`, etc.) that don't run on ZCode. Strip it; keep everything else (`$schema`, `agent`, `autoupdate`, `compaction`, `formatter`, `instructions`, `keybinds`, `mcp`, `model`, `permission`, `provider`, `share`, `small_model`, `watcher`).

Run (node one-liner) — but since we want a deterministic committed file, write it via a small script then commit the result:

```bash
cd C:/Users/PC/Documents/Project/zcode-starterkit
node -e "
const fs=require('node:fs');
const src='C:/Users/PC/Documents/Project/opencode-starterkit/baseline/opencode.json';
const out='baseline/config.json';
const cfg=JSON.parse(fs.readFileSync(src,'utf8'));
delete cfg.plugin;
fs.writeFileSync(out, JSON.stringify(cfg,null,2)+'\n');
console.log('wrote', out, 'keys:', Object.keys(cfg).join(','));
"
```

- [ ] **Step 2: Verify plugin key absent, others present**

Run:
```bash
node -e "const c=require('./baseline/config.json'); console.log('plugin' in c ? 'FAIL: plugin present' : 'OK no plugin'); console.log('has mcp:', 'mcp' in c, 'has agent:', 'agent' in c, 'has provider:', 'provider' in c);"
```
Expected: `OK no plugin`, `has mcp: true`, `has agent: true`, `has provider: true`.

- [ ] **Step 3: Commit**

```bash
git add baseline/config.json
git commit -m "feat: add baseline/config.json (opencode.json ported, plugin[] stripped)"
```

---

### Task 4: src/fs-utils.mjs + src/prompt.mjs (verbatim copies)

**Files:**
- Create: `zcode-starterkit/src/fs-utils.mjs` — copy verbatim from donor
- Create: `zcode-starterkit/src/prompt.mjs` — copy verbatim from donor

These are generic helpers with no OpenCode-specific symbols.

- [ ] **Step 1: Copy fs-utils.mjs verbatim**

```bash
cp C:/Users/PC/Documents/Project/opencode-starterkit/src/fs-utils.mjs C:/Users/PC/Documents/Project/zcode-starterkit/src/fs-utils.mjs
```

- [ ] **Step 2: Copy prompt.mjs verbatim**

```bash
cp C:/Users/PC/Documents/Project/opencode-starterkit/src/prompt.mjs C:/Users/PC/Documents/Project/zcode-starterkit/src/prompt.mjs
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/PC/Documents/Project/zcode-starterkit
git add src/fs-utils.mjs src/prompt.mjs
git commit -m "feat: add generic fs-utils and prompt helpers"
```

---

### Task 5: src/constants.mjs (port to ZCode paths + ZCODE_HOME)

**Files:**
- Create: `zcode-starterkit/src/constants.mjs`

- [ ] **Step 1: Write constants.mjs**

```js
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const THIS_FILE = fileURLToPath(import.meta.url)
const SRC_DIR = path.dirname(THIS_FILE)
const PACKAGE_ROOT = path.resolve(SRC_DIR, '..')

export const HOME = os.homedir()
export const ZCODE_STARTERKIT_PACKAGE_ROOT = PACKAGE_ROOT
export const ZCODE_STARTERKIT_BASELINE_ROOT = path.join(PACKAGE_ROOT, 'baseline')

// ZCODE_HOME override enables sandboxed home-dir simulation.
// Default points at the real ZCode home (~/.zcode).
export function resolveZcodeHome(env = process.env) {
  if (env.ZCODE_HOME) return env.ZCODE_HOME
  return path.join(HOME, '.zcode')
}

export const ZCODE_HOME = resolveZcodeHome()

// Marketplace + plugin identity
export const MARKETPLACE_NAME = 'zcode-starterkit'
export const CORE_PLUGIN_NAME = 'core'
export const AGENTS_PLUGIN_NAME = 'agents-config'
export const PLUGIN_VERSION = '0.1.0'

// ZCode layout under ZCODE_HOME
export const ZCODE_CONFIG_ROOT = ZCODE_HOME                              // ~/.zcode
export const ZCODE_CLI_ROOT = path.join(ZCODE_HOME, 'cli')              // ~/.zcode/cli
export const ZCODE_PLUGINS_ROOT = path.join(ZCODE_CLI_ROOT, 'plugins')  // ~/.zcode/cli/plugins
export const ZCODE_CACHE_ROOT = path.join(ZCODE_PLUGINS_ROOT, 'cache', MARKETPLACE_NAME)
export const ZCODE_MARKETPLACE_DIR = path.join(ZCODE_PLUGINS_ROOT, 'marketplaces', MARKETPLACE_NAME)
export const ZCODE_CLI_CONFIG = path.join(ZCODE_CLI_ROOT, 'config.json')          // enabledPlugins
export const ZCODE_RUNTIME_CONFIG = path.join(ZCODE_HOME, 'v2', 'config.json')    // provider/agent/mcp

export const ZCODE_CORE_PLUGIN_DIR = path.join(ZCODE_CACHE_ROOT, CORE_PLUGIN_NAME, PLUGIN_VERSION)
export const ZCODE_AGENTS_PLUGIN_DIR = path.join(ZCODE_CACHE_ROOT, AGENTS_PLUGIN_NAME, PLUGIN_VERSION)

// Vendor copy of the whole starterkit package source (for shim resolution + docs)
export const ZCODE_VENDOR_ROOT = ZCODE_CACHE_ROOT

// State / backups / logs / manifests (kept inside ZCode home, under cli/)
export const ZCODE_STATE_ROOT = path.join(ZCODE_CLI_ROOT, 'starterkit-state')
export const ZCODE_BACKUP_DIR = path.join(ZCODE_STATE_ROOT, 'backups')
export const ZCODE_INSTALL_LOG_DIR = path.join(ZCODE_STATE_ROOT, 'logs')
export const ZCODE_MANIFEST_DIR = path.join(ZCODE_STATE_ROOT, 'manifests')

// CLI shims (kept under ~/.local/bin, OS-agnostic)
export const GLOBAL_BIN_DIR = path.join(HOME, '.local', 'bin')
export const GLOBAL_ZCS_SHIM = path.join(GLOBAL_BIN_DIR, 'zcs')
export const GLOBAL_STARTERKIT_SHIM = path.join(GLOBAL_BIN_DIR, 'zcode-starterkit')

export const PROJECT_MEMORY_FILES = ['project.md', 'state.md', 'roadmap.md', 'tech-stack.md', 'user.md', 'gotchas.md']

export const ACTION_OPTIONS = [
  'Initialize project',
  'Config',
  'Upgrade',
  'List agents',
  'Add agent',
  'List skills',
  'Add skill',
  'Status',
  'Doctor',
  'Exit',
]

export const MODEL_PRESETS = {
  free: { label: 'Free models', model: null },
  recommended: { label: 'Recommended models', model: null },
  custom: { label: 'Custom', model: null },
  skip: { label: 'Skip', model: null },
}
```

Note: `MODEL_PRESETS` models set to `null` — ZCode defaults to its own GLM provider; we don't hardcode OpenCode model ids. Presets kept for UI compatibility.

- [ ] **Step 2: Commit**

```bash
git add src/constants.mjs
git commit -m "feat: add constants with ZCode paths and ZCODE_HOME sandbox override"
```

---

### Task 6: src/config-merge.mjs (port + strip plugin[] before merge) — TDD

**Files:**
- Create: `zcode-starterkit/test/config-merge.test.mjs`
- Create: `zcode-starterkit/src/config-merge.mjs`

- [ ] **Step 1: Write the failing test**

`test/config-merge.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeZcodeConfigAdditive, normalizeZcodeConfig } from '../src/config-merge.mjs'

test('additive merge adds missing keys without overwriting existing', () => {
  const current = { provider: { 'builtin:zai': { name: 'Z.ai' } }, model: 'glm-5.2' }
  const baseline = { provider: { 'github-copilot': { name: 'Copilot' } }, mcp: { tilth: { command: ['npx'] } } }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  assert.equal(merged.model, 'glm-5.2')
  assert.equal(merged.provider['builtin:zai'].name, 'Z.ai')
  assert.equal(merged.provider['github-copilot'].name, 'Copilot')
  assert.equal(merged.mcp.tilth.command[0], 'npx')
})

test('normalize removes invalid model refs when provider missing', () => {
  const current = { provider: { 'builtin:zai': {} } }
  const baseline = { model: 'github-copilot/gpt-5.5', small_model: 'opencode/gpt-5-nano', agent: { build: { model: 'github-copilot/gpt-5.5', description: 'dev' } } }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  const norm = normalizeZcodeConfig({ current, baseline, merged })
  assert.equal(norm.config.model, undefined)
  assert.equal(norm.config.small_model, undefined)
  assert.equal(norm.config.agent.build.model, undefined)
  assert.equal(norm.config.agent.build.description, 'dev')
  const removed = norm.changes.filter((c) => c.type === 'model_removed' || c.type === 'agent_model_removed')
  assert.ok(removed.length >= 2)
})

test('normalize keeps valid model refs when provider present', () => {
  const current = { provider: { 'builtin:zai': {} } }
  const baseline = { model: 'builtin:zai/glm-5.2' }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  const norm = normalizeZcodeConfig({ current, baseline, merged })
  assert.equal(norm.config.model, 'builtin:zai/glm-5.2')
})

test('merge never introduces a plugin[] array from baseline', () => {
  const current = {}
  const baseline = { plugin: ['@x/opencode-dcp'] }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  assert.equal(merged.plugin, undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/PC/Documents/Project/zcode-starterkit && node --test test/config-merge.test.mjs`
Expected: FAIL — module not found / `mergeZcodeConfigAdditive` is not a function.

- [ ] **Step 3: Write config-merge.mjs (port of donor, renamed, with plugin[] strip)**

`src/config-merge.mjs`:
```js
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

export function writeMergeManifest({ targetPath, sourcePath, mergedKeys, normalizedChanges = [], providerNames = [], note }) {
  ensureDir(ZCODE_MANIFEST_DIR)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const manifestPath = path.join(ZCODE_MANIFEST_DIR, `config-merge-${stamp}.json`)
  writeText(manifestPath, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    targetPath, sourcePath, mergedKeys, normalizedChanges, providerNames,
    note: note || null,
  }, null, 2)}\n`)
  return manifestPath
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/config-merge.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config-merge.mjs test/config-merge.test.mjs
git commit -m "feat: port config-merge with plugin[] strip and model normalization"
```

---

### Task 7: src/plugin-packager.mjs (NEW ZCode core) — TDD

**Files:**
- Create: `zcode-starterkit/test/plugin-packager.test.mjs`
- Create: `zcode-starterkit/src/plugin-packager.mjs`

This is the ZCode-specific heart: package `baseline/` into two plugin dirs, write `marketplace.json`, enable plugins in `cli/config.json`.

- [ ] **Step 1: Write the failing test**

`test/plugin-packager.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { packageBaselineAsPlugins, registerMarketplace, enablePlugins, readCliConfig } from '../src/plugin-packager.mjs'

function sandboxHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-pkg-'))
  return dir
}

test('packageBaselineAsPlugins creates core + agents-config plugin dirs with plugin.json', () => {
  const home = sandboxHome()
  const baselineRoot = path.resolve('baseline')
  const cacheRoot = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit')
  const result = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot })
  assert.ok(result.corePluginDir.startsWith(cacheRoot))
  assert.ok(fs.existsSync(path.join(result.corePluginDir, '.zcode-plugin', 'plugin.json')))
  assert.ok(fs.existsSync(path.join(result.agentsPluginDir, '.zcode-plugin', 'plugin.json')))
  // core carries skills + commands
  const corePluginJson = JSON.parse(fs.readFileSync(path.join(result.corePluginDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.equal(corePluginJson.name, 'core')
  assert.equal(corePluginJson.skills, 'skills')
  assert.equal(corePluginJson.commands, 'commands')
  // agents-config carries agents dir
  const agentsPluginJson = JSON.parse(fs.readFileSync(path.join(result.agentsPluginDir, '.zcode-plugin', 'plugin.json'), 'utf8'))
  assert.equal(agentsPluginJson.name, 'agents-config')
  assert.ok(fs.existsSync(path.join(result.agentsPluginDir, 'agents', 'build.md')))
})

test('registerMarketplace writes marketplace.json listing both plugins', () => {
  const home = sandboxHome()
  const baselineRoot = path.resolve('baseline')
  const packaged = packageBaselineAsPlugins({ zcodeHome: home, baselineRoot })
  const mp = registerMarketplace({ zcodeHome: home, packaged })
  const mpJson = JSON.parse(fs.readFileSync(mp.marketplacePath, 'utf8'))
  assert.equal(mpJson.name, 'zcode-starterkit')
  assert.equal(mpJson.plugins.length, 2)
  assert.ok(mpJson.plugins.some((p) => p.name === 'core'))
  assert.ok(mpJson.plugins.some((p) => p.name === 'agents-config'))
})

test('enablePlugins sets both plugins true in cli/config.json without wiping existing', () => {
  const home = sandboxHome()
  const cliConfigPath = path.join(home, 'cli', 'config.json')
  fs.mkdirSync(path.dirname(cliConfigPath), { recursive: true })
  fs.writeFileSync(cliConfigPath, JSON.stringify({ plugins: { enabledPlugins: { 'superpowers@zcode-plugins-official': true } } }))
  const after = enablePlugins({ zcodeHome: home })
  const cfg = readCliConfig({ zcodeHome: home })
  assert.equal(cfg.plugins.enabledPlugins['superpowers@zcode-plugins-official'], true)
  assert.equal(cfg.plugins.enabledPlugins['core@zcode-starterkit'], true)
  assert.equal(cfg.plugins.enabledPlugins['agents-config@zcode-starterkit'], true)
})

test('no file is written outside the sandbox home', () => {
  const home = sandboxHome()
  packageBaselineAsPlugins({ zcodeHome: home, baselineRoot: path.resolve('baseline') })
  assert.ok(!fs.existsSync(path.join(os.homedir(), '.zcode', 'cli', 'plugins', 'cache', 'zcode-starterkit')))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/plugin-packager.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write plugin-packager.mjs**

`src/plugin-packager.mjs`:
```js
import fs from 'node:fs'
import path from 'node:path'
import {
  MARKETPLACE_NAME,
  CORE_PLUGIN_NAME,
  AGENTS_PLUGIN_NAME,
  PLUGIN_VERSION,
  ZCODE_CACHE_ROOT,
  ZCODE_MARKETPLACE_DIR,
  ZCODE_CLI_CONFIG,
  ZCODE_CORE_PLUGIN_DIR,
  ZCODE_AGENTS_PLUGIN_DIR,
} from './constants.mjs'
import { copyDirRecursive, ensureDir, exists, writeText } from './fs-utils.mjs'

function pluginJson({ name, description, withSkills, withCommands }) {
  const obj = {
    name,
    version: PLUGIN_VERSION,
    description,
    author: { name: 'zcode-starterkit' },
    license: 'MIT',
  }
  if (withSkills) obj.skills = 'skills'
  if (withCommands) obj.commands = 'commands'
  return obj
}

function pluginPackageJson({ name }) {
  return {
    $schema: 'https://json.schemastore.org/package.json',
    name: `@zcode-starterkit/${name}-plugin`,
    version: PLUGIN_VERSION,
    private: true,
    license: 'MIT',
    description: `zcode-starterkit ${name} plugin`,
  }
}

function seedJson({ name }) {
  return {
    marketplace: MARKETPLACE_NAME,
    plugin: name,
    pluginVersion: PLUGIN_VERSION,
    source: 'filesystem',
    version: 1,
    hash: 'local',
  }
}

export function packageBaselineAsPlugins({ zcodeHome, baselineRoot }) {
  const cacheRoot = path.join(zcodeHome, 'cli', 'plugins', 'cache', MARKETPLACE_NAME)
  const coreDir = path.join(cacheRoot, CORE_PLUGIN_NAME, PLUGIN_VERSION)
  const agentsDir = path.join(cacheRoot, AGENTS_PLUGIN_NAME, PLUGIN_VERSION)

  ensureDir(coreDir)
  ensureDir(agentsDir)

  // core: skills + commands
  copyDirRecursive(path.join(baselineRoot, 'skills'), path.join(coreDir, 'skills'))
  copyDirRecursive(path.join(baselineRoot, 'commands'), path.join(coreDir, 'commands'))
  writeText(path.join(coreDir, '.zcode-plugin', 'plugin.json'),
    `${JSON.stringify(pluginJson({ name: CORE_PLUGIN_NAME, description: 'Shared skills and commands for ZCode Agent.', withSkills: true, withCommands: true }), null, 2)}\n`)
  writeText(path.join(coreDir, '.zcode-plugin-seed.json'), `${JSON.stringify(seedJson({ name: CORE_PLUGIN_NAME }), null, 2)}\n`)
  writeText(path.join(coreDir, 'package.json'), `${JSON.stringify(pluginPackageJson({ name: CORE_PLUGIN_NAME }), null, 2)}\n`)

  // agents-config: agents markdown (referenced via config merge, not a skills dir)
  copyDirRecursive(path.join(baselineRoot, 'agents'), path.join(agentsDir, 'agents'))
  writeText(path.join(agentsDir, '.zcode-plugin', 'plugin.json'),
    `${JSON.stringify(pluginJson({ name: AGENTS_PLUGIN_NAME, description: 'Shared agent definitions for ZCode Agent (merged into v2/config.json).', withSkills: false, withCommands: false }), null, 2)}\n`)
  writeText(path.join(agentsDir, '.zcode-plugin-seed.json'), `${JSON.stringify(seedJson({ name: AGENTS_PLUGIN_NAME }), null, 2)}\n`)
  writeText(path.join(agentsDir, 'package.json'), `${JSON.stringify(pluginPackageJson({ name: AGENTS_PLUGIN_NAME }), null, 2)}\n`)

  return {
    corePluginDir: coreDir,
    agentsPluginDir: agentsDir,
    coreName: CORE_PLUGIN_NAME,
    agentsName: AGENTS_PLUGIN_NAME,
    version: PLUGIN_VERSION,
  }
}

export function registerMarketplace({ zcodeHome, packaged }) {
  ensureDir(ZCODE_MARKETPLACE_DIR.replace(path.join(HOME_PLACEHOLDER(), 'cli'), path.join(zcodeHome, 'cli')))
  const marketplaceDir = path.join(zcodeHome, 'cli', 'plugins', 'marketplaces', MARKETPLACE_NAME)
  ensureDir(marketplaceDir)
  const marketplacePath = path.join(marketplaceDir, 'marketplace.json')
  const body = {
    name: MARKETPLACE_NAME,
    version: 1,
    plugins: [
      {
        cachePath: packaged.corePluginDir,
        name: packaged.coreName,
        source: 'filesystem',
        version: packaged.version,
      },
      {
        cachePath: packaged.agentsPluginDir,
        name: packaged.agentsName,
        source: 'filesystem',
        version: packaged.version,
      },
    ],
  }
  writeText(marketplacePath, `${JSON.stringify(body, null, 2)}\n`)
  return { marketplacePath }
}

// tiny helper so we don't import HOME unnecessarily in registerMarketplace
function HOME_PLACEHOLDER() { return '' }

export function readCliConfig({ zcodeHome }) {
  const cliConfigPath = path.join(zcodeHome, 'cli', 'config.json')
  if (!exists(cliConfigPath)) return {}
  try { return JSON.parse(fs.readFileSync(cliConfigPath, 'utf8')) } catch { return {} }
}

export function enablePlugins({ zcodeHome }) {
  const cliConfigPath = path.join(zcodeHome, 'cli', 'config.json')
  const cfg = readCliConfig({ zcodeHome })
  cfg.plugins = cfg.plugins || {}
  cfg.plugins.enabledPlugins = cfg.plugins.enabledPlugins || {}
  cfg.plugins.enabledPlugins[`${CORE_PLUGIN_NAME}@${MARKETPLACE_NAME}`] = true
  cfg.plugins.enabledPlugins[`${AGENTS_PLUGIN_NAME}@${MARKETPLACE_NAME}`] = true
  ensureDir(path.dirname(cliConfigPath))
  writeText(cliConfigPath, `${JSON.stringify(cfg, null, 2)}\n`)
  return { cliConfigPath, enabled: cfg.plugins.enabledPlugins }
}
```

Note: `registerMarketplace` simplifies to take `zcodeHome` directly (the first `ensureDir` line referencing `HOME_PLACEHOLDER` is a no-op safety; the real dir creation uses `zcodeHome`). In the cleanup pass, remove that first `ensureDir` line entirely.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/plugin-packager.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/plugin-packager.mjs test/plugin-packager.test.mjs
git commit -m "feat: add plugin-packager to package baseline into ZCode plugins"
```

---

### Task 8: src/templates.mjs + src/install-global.mjs + src/install-project.mjs + src/cli.mjs

**Files:**
- Create: `zcode-starterkit/src/templates.mjs` (port)
- Create: `zcode-starterkit/src/install-global.mjs` (port)
- Create: `zcode-starterkit/src/install-project.mjs` (port)
- Create: `zcode-starterkit/src/cli.mjs` (port)

- [ ] **Step 1: Write templates.mjs (port — .opencode→.zcode, opencode.json→config.json, drop beads refs)**

`src/templates.mjs`:
```js
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { PROJECT_MEMORY_FILES } from './constants.mjs'

function toTitleCase(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase())
}

function detectPackageManager(cwd) {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm'
  return null
}

function detectGitRemote(cwd) {
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf8' })
  if (result.status !== 0) return null
  return String(result.stdout || '').trim() || null
}

function detectCurrentBranch(cwd) {
  const result = spawnSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' })
  if (result.status !== 0) return null
  return String(result.stdout || '').trim() || null
}

function readPackageJson(cwd) {
  const filePath = path.join(cwd, 'package.json')
  if (!fs.existsSync(filePath)) return null
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return null }
}

function detectProjectType({ packageJson }) {
  if (!packageJson) return 'generic repository'
  if (packageJson.bin) return 'CLI / tool project'
  if (packageJson.dependencies?.next) return 'Next.js application'
  if (packageJson.dependencies?.react || packageJson.devDependencies?.react) return 'React application'
  if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) return 'Vite application'
  return 'Node.js / JavaScript project'
}

function detectPrimaryLanguage(cwd) {
  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) return 'TypeScript'
  if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'requirements.txt'))) return 'Python'
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) return 'Rust'
  if (fs.existsSync(path.join(cwd, 'go.mod'))) return 'Go'
  if (fs.existsSync(path.join(cwd, 'package.json'))) return 'JavaScript / TypeScript'
  return 'Mixed / unknown'
}

function collectProjectContext({ cwd, action, model }) {
  const packageJson = readPackageJson(cwd)
  const repoName = packageJson?.name || path.basename(cwd)
  return {
    cwd,
    repoName,
    displayName: toTitleCase(repoName),
    packageJson,
    packageManager: detectPackageManager(cwd),
    remote: detectGitRemote(cwd),
    branch: detectCurrentBranch(cwd),
    projectType: detectProjectType({ packageJson }),
    primaryLanguage: detectPrimaryLanguage(cwd),
    action: action || 'Initialize project',
    selectedModel: model || null,
  }
}

function renderProjectMarkdown(context) {
  const remoteLine = context.remote ? `- Remote: ${context.remote}` : '- Remote: (none detected yet)'
  return `---
purpose: Project identity and goals for repo-local ZCode context
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# ${context.displayName}

## Repository Identity

- Repo name: ${context.repoName}
- Working directory: ${context.cwd}
${remoteLine}
- Branch: ${context.branch || '(not detected)'}
- Project type: ${context.projectType}
- Primary language: ${context.primaryLanguage}

## Why this file exists

This project memory was generated from the current repository during 'zcs install' / 'zcode-starterkit install'.
It should describe **this repo**, not the starterkit baseline donor project.

## Initial Objective

- Action selected during install: ${context.action}
- Selected model override: ${context.selectedModel || 'inherit / global default'}
- Immediate goal: bootstrap a thin ZCode overlay with project-local memory.
`
}

function renderStateMarkdown(context) {
  return `---
purpose: Current repo-local working state for ZCode prompt injection
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# State

## Current Position

- Status: Newly initialized ZCode project overlay
- Install action: ${context.action}
- Selected model override: ${context.selectedModel || 'inherit / global default'}
- Branch at install time: ${context.branch || '(not detected)'}

## What has been created

- .zcode/config.json
- .zcode/memory/project/*.md
- .zcode/memory/_templates/*.md
- .zcode/memory/research/*.md

## Next Actions

1. Replace generated placeholder context with real project intent.
2. Confirm runtime model/provider choices for this repo.
3. Capture repo-specific gotchas once actual work starts.
`
}

function renderRoadmapMarkdown(context) {
  return `---
purpose: Initial roadmap scaffold for repo-local ZCode context
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# Roadmap

## Bootstrap Phase

- [x] Install thin ZCode overlay into this repository
- [x] Generate repo-local memory files from detected repo context
- [ ] Replace placeholder roadmap with project-specific milestones

## Suggested Next Milestones

1. Confirm product / engineering objective for ${context.repoName}
2. Define verification commands and constraints
3. Capture first meaningful state update after real implementation work
`
}

function renderTechStackMarkdown(context) {
  const packageManagerLine = context.packageManager ? `- Package manager: ${context.packageManager}` : '- Package manager: (not detected)'
  const scripts = Object.keys(context.packageJson?.scripts || {})
  const scriptLines = scripts.length > 0 ? scripts.map((name) => `- ${name}`).join('\n') : '- (no scripts detected)'
  return `---
purpose: Detected stack and constraints for repo-local ZCode context
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# Tech Stack

## Detected Shape

- Project type: ${context.projectType}
- Primary language: ${context.primaryLanguage}
${packageManagerLine}
- package.json name: ${context.packageJson?.name || '(none)'}
- package.json version: ${context.packageJson?.version || '(none)'}

## Detected Scripts

${scriptLines}
`
}

function renderUserMarkdown(context) {
  return `---
purpose: Repo-local workflow preferences scaffold
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# User / Workflow Notes

## Install Context

- Generated for repo: ${context.repoName}
- Generated by action: ${context.action}
- Selected model override: ${context.selectedModel || 'inherit / global default'}

## Safe Defaults

- Ask before commit / push unless explicitly requested
- Keep repo-specific context here, not in the global baseline
`
}

function renderGotchasMarkdown(context) {
  return `---
purpose: Repo-local gotchas scaffold
updated: ${new Date().toISOString().slice(0, 10)}
source: generated-by-zcode-starterkit
---

# Gotchas

## Bootstrap Gotcha

- If this file mentions another project, the install flow is wrong.
- Repo-local memory must always describe the current repo: ${context.repoName}

## To Fill In Later

- runtime footguns
- environment traps
- project-specific conventions
`
}

export function renderProjectMemoryFiles({ cwd, action, model }) {
  const context = collectProjectContext({ cwd, action, model })
  const rendered = {
    'project.md': renderProjectMarkdown(context),
    'state.md': renderStateMarkdown(context),
    'roadmap.md': renderRoadmapMarkdown(context),
    'tech-stack.md': renderTechStackMarkdown(context),
    'user.md': renderUserMarkdown(context),
    'gotchas.md': renderGotchasMarkdown(context),
  }
  for (const name of PROJECT_MEMORY_FILES) if (!rendered[name]) rendered[name] = `# ${name}\n`
  return rendered
}

export function renderProjectZcodeJson({ model }) {
  const base = {
    $schema: 'https://opencode.ai/config.json',
    instructions: [
      '.zcode/memory/project/user.md',
      '.zcode/memory/project/tech-stack.md',
      '.zcode/memory/project/project.md',
      '.zcode/memory/project/roadmap.md',
      '.zcode/memory/project/state.md',
    ],
  }
  if (model) base.model = model
  return `${JSON.stringify(base, null, '\t')}\n`
}
```

- [ ] **Step 2: Write cli.mjs (port — zcode-starterkit/zcs help + --sandbox flag)**

`src/cli.mjs`:
```js
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
```

- [ ] **Step 3: Write install-global.mjs (port — use plugin-packager, drop beads/memory/command-init)**

`src/install-global.mjs`:
```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ZCODE_STARTERKIT_BASELINE_ROOT,
  ZCODE_STARTERKIT_PACKAGE_ROOT,
  ZCODE_HOME,
  ZCODE_STATE_ROOT,
  ZCODE_BACKUP_DIR,
  ZCODE_INSTALL_LOG_DIR,
  ZCODE_RUNTIME_CONFIG,
  ZCODE_VENDOR_ROOT,
  GLOBAL_BIN_DIR,
} from './constants.mjs'
import { backupIfExists, ensureDir, exists, writeText, shouldCopyStarterkitPath } from './fs-utils.mjs'
import { readJson, writeJson, writeMergeManifest, mergeZcodeConfigAdditive, normalizeZcodeConfig } from './config-merge.mjs'
import { packageBaselineAsPlugins, registerMarketplace, enablePlugins } from './plugin-packager.mjs'

function buildWindowsCmdShim({ scriptPath }) {
  return `@echo off\r\nnode "${scriptPath}" %*\r\n`
}

function buildPosixShim({ scriptPath }) {
  return `#!/usr/bin/env bash\nnode "${scriptPath}" "$@"\n`
}

export function getCliShimSpecs({ platform = process.platform, packageRoot = ZCODE_STARTERKIT_PACKAGE_ROOT, binDir = GLOBAL_BIN_DIR } = {}) {
  const pathApi = platform === 'win32' ? path.win32 : path
  const isWindows = platform === 'win32'
  const specs = [
    { shimName: isWindows ? 'zcs.cmd' : 'zcs', scriptName: 'zcs.mjs' },
    { shimName: isWindows ? 'zcode-starterkit.cmd' : 'zcode-starterkit', scriptName: 'zcode-starterkit.mjs' },
  ]
  return specs.map(({ shimName, scriptName }) => {
    const scriptPath = pathApi.join(packageRoot, 'bin', scriptName)
    return {
      shimPath: pathApi.join(binDir, shimName),
      content: isWindows ? buildWindowsCmdShim({ scriptPath }) : buildPosixShim({ scriptPath }),
      executable: !isWindows,
    }
  })
}

function installCliShims({ platform = process.platform } = {}) {
  ensureDir(GLOBAL_BIN_DIR)
  const specs = getCliShimSpecs({ platform })
  for (const spec of specs) {
    writeText(spec.shimPath, spec.content)
    if (spec.executable) fs.chmodSync(spec.shimPath, 0o755)
  }
  return specs.map((spec) => spec.shimPath)
}

function mergeGlobalConfig({ zcodeHome = ZCODE_HOME }) {
  const baselinePath = path.join(ZCODE_STARTERKIT_BASELINE_ROOT, 'config.json')
  const globalPath = path.join(zcodeHome, 'v2', 'config.json')
  if (!exists(baselinePath)) return { merged: false, reason: 'missing baseline/config.json' }
  const baseline = readJson(baselinePath)
  const current = exists(globalPath) ? readJson(globalPath) : {}
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  const normalized = normalizeZcodeConfig({ current, baseline, merged })
  backupIfExists(globalPath, { backupRoot: ZCODE_BACKUP_DIR })
  writeJson(globalPath, normalized.config)
  const manifestPath = writeMergeManifest({
    targetPath: globalPath,
    sourcePath: baselinePath,
    mergedKeys: normalized.mergedKeys,
    normalizedChanges: normalized.changes,
    providerNames: normalized.providerNames,
    note: 'Additive merge + normalization from zcode-starterkit baseline into ZCode v2/config.json',
  })
  return { merged: true, globalPath, manifestPath, normalizedChanges: normalized.changes, providerNames: normalized.providerNames }
}

function vendorPackageSource({ zcodeHome = ZCODE_HOME }) {
  // Copy the whole starterkit package source into the cache root for shim/doc resolution.
  backupIfExists(ZCODE_VENDOR_ROOT, { backupRoot: ZCODE_BACKUP_DIR })
  ensureDir(path.join(zcodeHome, 'cli', 'plugins', 'cache', 'zcode-starterkit'))
  fs.cpSync(ZCODE_STARTERKIT_PACKAGE_ROOT, ZCODE_VENDOR_ROOT, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(ZCODE_STARTERKIT_PACKAGE_ROOT, src)
      if (!rel) return true
      if (rel.split(path.sep).includes('.git')) return false
      if (rel.split(path.sep).includes('node_modules')) return false
      if (rel.split(path.sep).includes('.sandbox')) return false
      return shouldCopyStarterkitPath(src, ZCODE_STARTERKIT_PACKAGE_ROOT)
    },
  })
}

function buildInstallLog({ cwd, zcodeHome, packaged, mergeResult }) {
  return [
    `[zcode-starterkit] install started: ${new Date().toISOString()}`,
    `[zcode-starterkit] cwd=${cwd}`,
    `[zcode-starterkit] zcodeHome=${zcodeHome}`,
    `[zcode-starterkit] baseline=${ZCODE_STARTERKIT_BASELINE_ROOT}`,
    `[zcode-starterkit] corePluginDir=${packaged.corePluginDir}`,
    `[zcode-starterkit] agentsPluginDir=${packaged.agentsPluginDir}`,
    mergeResult?.merged ? `[zcode-starterkit] merged config=${mergeResult.globalPath}` : `[zcode-starterkit] merge skipped=${mergeResult?.reason || 'unknown'}`,
    mergeResult?.manifestPath ? `[zcode-starterkit] merge manifest=${mergeResult.manifestPath}` : `[zcode-starterkit] merge manifest=none`,
  ].join('\n') + '\n'
}

export async function installGlobal({ cwd, zcodeHome = ZCODE_HOME } = {}) {
  console.log('[zcode-starterkit] Global install starting')
  console.log(`cwd=${cwd}`)
  console.log(`zcodeHome=${zcodeHome}`)
  console.log(`baseline=${ZCODE_STARTERKIT_BASELINE_ROOT}`)
  ensureDir(path.join(zcodeHome, 'cli'))
  ensureDir(ZCODE_STATE_ROOT.replace(ZCODE_HOME, zcodeHome))
  ensureDir(ZCODE_BACKUP_DIR.replace(ZCODE_HOME, zcodeHome))
  ensureDir(ZCODE_INSTALL_LOG_DIR.replace(ZCODE_HOME, zcodeHome))

  vendorPackageSource({ zcodeHome })
  const packaged = packageBaselineAsPlugins({ zcodeHome, baselineRoot: ZCODE_STARTERKIT_BASELINE_ROOT })
  registerMarketplace({ zcodeHome, packaged })
  enablePlugins({ zcodeHome })
  const mergeResult = mergeGlobalConfig({ zcodeHome })
  const installedShimPaths = installCliShims()

  const logDir = path.join(zcodeHome, 'cli', 'starterkit-state', 'logs')
  ensureDir(logDir)
  const installLogPath = path.join(logDir, `install-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
  writeText(installLogPath, buildInstallLog({ cwd, zcodeHome, packaged, mergeResult }))

  console.log(`[zcode-starterkit] Packaged plugins under ${path.dirname(packaged.corePluginDir)}`)
  console.log(`[zcode-starterkit] Registered marketplace zcode-starterkit`)
  console.log(`[zcode-starterkit] Enabled plugins in ${path.join(zcodeHome, 'cli', 'config.json')}`)
  if (mergeResult.merged) {
    console.log(`[zcode-starterkit] Merged global config -> ${mergeResult.globalPath}`)
    if (mergeResult.manifestPath) console.log(`[zcode-starterkit] Wrote merge manifest -> ${mergeResult.manifestPath}`)
  } else {
    console.log(`[zcode-starterkit] Skipped global config merge: ${mergeResult.reason}`)
  }
  console.log(`[zcode-starterkit] Wrote install log -> ${installLogPath}`)
  for (const shimPath of installedShimPaths) console.log(`[zcode-starterkit] Installed CLI shim at ${shimPath}`)
}
```

- [ ] **Step 4: Write install-project.mjs (port — .zcode overlay, drop command-init/beads/memory-db)**

`src/install-project.mjs`:
```js
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
```

- [ ] **Step 5: Commit**

```bash
git add src/templates.mjs src/cli.mjs src/install-global.mjs src/install-project.mjs
git commit -m "feat: port templates, cli, install-global, install-project to ZCode"
```

---

### Task 9: bin/ entrypoints

**Files:**
- Create: `zcode-starterkit/bin/zcode-starterkit.mjs`
- Create: `zcode-starterkit/bin/zcs.mjs`

- [ ] **Step 1: Write zcode-starterkit.mjs (global, with --sandbox handling)**

`bin/zcode-starterkit.mjs`:
```js
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
```

- [ ] **Step 2: Write zcs.mjs (project overlay)**

`bin/zcs.mjs`:
```js
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
```

- [ ] **Step 3: Smoke test --help**

Run:
```bash
cd C:/Users/PC/Documents/Project/zcode-starterkit
node ./bin/zcode-starterkit.mjs --help && node ./bin/zcs.mjs --help
```
Expected: both print help, exit 0.

- [ ] **Step 4: Commit**

```bash
git add bin/zcode-starterkit.mjs bin/zcs.mjs
git commit -m "feat: add zcode-starterkit and zcs CLI entrypoints"
```

---

### Task 10: test/sandbox.test.mjs (full sandbox install + no-escape guard)

**Files:**
- Create: `zcode-starterkit/test/sandbox.test.mjs`

- [ ] **Step 1: Write the sandbox integration test**

`test/sandbox.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { installGlobal } from '../src/install-global.mjs'

const BASELINE = path.resolve(path.join(process.cwd(), 'baseline'))

function freshSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-sandbox-'))
  return dir
}

test('sandbox install produces plugins, marketplace, enabledPlugins, merged config', async () => {
  const home = freshSandbox()
  await installGlobal({ cwd: process.cwd(), zcodeHome: home })

  const coreDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '0.1.0')
  const agentsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'agents-config', '0.1.0')

  assert.ok(fs.existsSync(path.join(coreDir, '.zcode-plugin', 'plugin.json')), 'core plugin.json missing')
  assert.ok(fs.existsSync(path.join(coreDir, 'skills')), 'core skills missing')
  assert.ok(fs.existsSync(path.join(coreDir, 'commands')), 'core commands missing')
  assert.ok(fs.existsSync(path.join(agentsDir, '.zcode-plugin', 'plugin.json')), 'agents plugin.json missing')
  assert.ok(fs.existsSync(path.join(agentsDir, 'agents', 'build.md')), 'agents md missing')

  const mp = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'plugins', 'marketplaces', 'zcode-starterkit', 'marketplace.json'), 'utf8'))
  assert.equal(mp.name, 'zcode-starterkit')
  assert.equal(mp.plugins.length, 2)

  const cli = JSON.parse(fs.readFileSync(path.join(home, 'cli', 'config.json'), 'utf8'))
  assert.equal(cli.plugins.enabledPlugins['core@zcode-starterkit'], true)
  assert.equal(cli.plugins.enabledPlugins['agents-config@zcode-starterkit'], true)

  const cfg = JSON.parse(fs.readFileSync(path.join(home, 'v2', 'config.json'), 'utf8'))
  assert.equal(cfg.$schema, 'https://opencode.ai/config.json')
  assert.ok('agent' in cfg, 'agent block missing in merged config')
  assert.ok('mcp' in cfg, 'mcp block missing in merged config')
  assert.equal(cfg.plugin, undefined, 'plugin[] must not be present')
  assert.equal(cfg.model, undefined, 'invalid default model must be normalized away')
})

test('sandbox install writes nothing into the real ~/.zcode', async () => {
  const home = freshSandbox()
  const realZcode = path.join(os.homedir(), '.zcode')
  const marker = path.join(realZcode, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'SANDBOX_TEST_MARKER')
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(marker, 'before')
  try {
    await installGlobal({ cwd: process.cwd(), zcodeHome: home })
    assert.ok(fs.existsSync(marker), 'pre-existing real ~/.zcode marker should be untouched')
    assert.equal(fs.readFileSync(marker, 'utf8'), 'before')
  } finally {
    fs.rmSync(marker, { force: true })
  }
})

test('sandbox install copies ~133 skills and 26 commands', async () => {
  const home = freshSandbox()
  await installGlobal({ cwd: process.cwd(), zcodeHome: home })
  const skillsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '0.1.0', 'skills')
  const commandsDir = path.join(home, 'cli', 'plugins', 'cache', 'zcode-starterkit', 'core', '0.1.0', 'commands')
  const skillCount = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
  const commandCount = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).length
  assert.ok(skillCount >= 130, `expected ~133 skills, got ${skillCount}`)
  assert.ok(commandCount >= 24, `expected ~26 commands, got ${commandCount}`)
})
```

Note on test 2: it only proves the installer doesn't *overwrite* a pre-existing marker; the strongest no-escape guarantee is that `installGlobal` only ever writes under `zcodeHome` (verified by reading `install-global.mjs`). The marker test is a sanity check, not the sole guard.

- [ ] **Step 2: Run the sandbox test**

Run: `node --test test/sandbox.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add test/sandbox.test.mjs
git commit -m "test: add sandbox integration test for full global install"
```

---

### Task 11: test/install-safety.test.mjs (port guards)

**Files:**
- Create: `zcode-starterkit/test/install-safety.test.mjs`

- [ ] **Step 1: Write safety tests (fs-utils guards + config-merge invariants)**

`test/install-safety.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { backupIfExists, copyDirMissing, shouldCopyStarterkitPath } from '../src/fs-utils.mjs'
import { mergeZcodeConfigAdditive } from '../src/config-merge.mjs'

test('shouldCopyStarterkitPath denies runtime artifacts', () => {
  assert.equal(shouldCopyStarterkitPath('node_modules', null), false)
  assert.equal(shouldCopyStarterkitPath('memory.db', null), false)
  assert.equal(shouldCopyStarterkitPath('src/skill.md', null), true)
})

test('backupIfExists creates a timestamped backup and leaves original', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-safe-'))
  const src = path.join(dir, 'file.json')
  const backupRoot = path.join(dir, 'backups')
  fs.writeFileSync(src, '{}')
  const backup = backupIfExists(src, { backupRoot })
  assert.ok(backup)
  assert.ok(fs.existsSync(backup))
  assert.ok(fs.existsSync(src), 'original must remain after backup')
})

test('copyDirMissing preserves existing targets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcode-copy-'))
  const from = path.join(dir, 'from')
  const to = path.join(dir, 'to')
  fs.mkdirSync(path.join(from, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(from, 'sub', 'a.txt'), 'A')
  fs.mkdirSync(path.join(to, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(to, 'sub', 'a.txt'), 'EXISTING')
  const result = copyDirMissing(from, to)
  assert.ok(result.preserved.some((p) => p.endsWith('a.txt')))
  assert.equal(fs.readFileSync(path.join(to, 'sub', 'a.txt'), 'utf8'), 'EXISTING')
})

test('merge never overwrites a scalar current value with a baseline scalar', () => {
  const current = { share: 'manual', model: 'glm-5.2' }
  const baseline = { share: 'auto', model: 'github-copilot/gpt-5.5' }
  const merged = mergeZcodeConfigAdditive({ current, baseline })
  assert.equal(merged.share, 'manual', 'current scalar preserved')
  assert.equal(merged.model, 'glm-5.2', 'current scalar preserved')
})
```

- [ ] **Step 2: Run safety tests**

Run: `node --test test/install-safety.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add test/install-safety.test.mjs
git commit -m "test: add install safety guards (denylist, backup, preserve, merge invariants)"
```

---

### Task 12: Full suite + smoke + npm link verify

- [ ] **Step 1: Run the full test suite**

Run:
```bash
cd C:/Users/PC/Documents/Project/zcode-starterkit
node --test
```
Expected: all tests PASS.

- [ ] **Step 2: Run smoke test**

Run: `npm run test:smoke`
Expected: both `--help` exit 0.

- [ ] **Step 3: Run a real --sandbox install end-to-end**

Run:
```bash
node ./bin/zcode-starterkit.mjs --sandbox
```
Expected: install logs printed, `.sandbox/.zcode/` populated with plugins + marketplace + merged config, no error.

- [ ] **Step 4: Verify sandbox contents**

Run:
```bash
ls .sandbox/.zcode/cli/plugins/cache/zcode-starterkit/
cat .sandbox/.zcode/cli/config.json
node -e "console.log(Object.keys(require('./.sandbox/.zcode/v2/config.json')))"
```
Expected: `core` and `agents-config` dirs; `enabledPlugins` with both true; config keys include `agent`, `mcp`, `provider` and NOT `plugin`.

- [ ] **Step 5: (Optional) npm link to confirm npx path works**

Run:
```bash
npm link
npx zcode-starterkit --help
npm unlink -g zcode-starterkit
```
Expected: `--help` prints via the linked bin.

- [ ] **Step 6: Final commit + status**

```bash
git add -A
git commit -m "chore: verify full suite, smoke, and sandbox install"
git log --oneline
```

---

## Self-Review

**Spec coverage:**
- Config port + merge into v2/config.json (strip plugin[], normalize models) → Task 3 + 6 + 8.
- Two plugins (core + agents-config) + marketplace + enabledPlugins → Task 7 + 8.
- 9 agents / 26 commands / 133 skills / memory verbatim → Task 2.
- MCP config carried via merge → Task 6 (mcp not stripped) + Task 10 assertion.
- Path mapping to ZCODE_HOME → Task 5 + 8.
- Sandbox home-dir simulation (no touch real ~/.zcode) → Task 5 (ZCODE_HOME) + Task 9 (--sandbox) + Task 10.
- CLI bins + npm runnable → Task 1 + 9 + 12.
- Dropped: plugin/tool TS, beads, memory-bootstrap, command-init → explicitly excluded in Tasks 2/8/9.
- Tests: plugin-packager, config-merge, sandbox, safety → Tasks 6/7/10/11.

**Placeholder scan:** No TBD/TODO; every code step contains full code. (The `HOME_PLACEHOLDER` no-op line in Task 7 Step 3 is flagged for removal in the same task's note.)

**Type consistency:** `packageBaselineAsPlugins` returns `{ corePluginDir, agentsPluginDir, coreName, agentsName, version }` — consumed identically by `registerMarketplace` (Task 7) and `install-global.mjs` (Task 8). `installGlobal({ cwd, zcodeHome })` signature consistent across bin (Task 9) and tests (Task 10). `resolveZcodeHome()` exported from constants (Task 5), imported in bin (Task 9).
