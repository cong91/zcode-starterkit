// srcwalk — code intelligence tools, ported from opencode-starterkit
// baseline/plugin/srcwalk/*.ts (read, deps, map, callers, callees, flow, impact).
// Consolidated into one file. No OpenCode SDK dependency: context.directory is
// replaced by process.cwd(). Pure filesystem + grep operations — no event bus.
//
// Tools: srcwalk_read, srcwalk_deps, srcwalk_map, srcwalk_callers,
//        srcwalk_callees, srcwalk_flow, srcwalk_impact

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

// --- shared utils ---

const TIMEOUT_MS = 15_000
const MAX_BUFFER = 5 * 1024 * 1024

function run(cmd: string, args: string[], cwd?: string): { stdout: string; stderr: string; code: number } {
  try {
    const result = execFileSync(cmd, args, {
      encoding: 'utf-8',
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      cwd: cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as unknown as string
    return { stdout: result, stderr: '', code: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.status ?? 1 }
  }
}

function plural(n: number, word: string): string {
  if (n === 1) return `${n} ${word}`
  if (['ch', 's', 'sh', 'x', 'z'].some((s) => word.endsWith(s))) return `${n} ${word}es`
  if (word.endsWith('y') && word.length > 1 && !'aeiou'.includes(word[word.length - 2])) return `${n} ${word.slice(0, -1)}ies`
  return `${n} ${word}s`
}

function readFileRange(filePath: string, start: number, end: number, displayPath?: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const from = Math.max(0, start - 1)
    const to = Math.min(lines.length, end)
    const result: string[] = [`File: ${displayPath ?? filePath} (lines ${start}-${end}):\n`]
    for (let i = from; i < to; i++) result.push(`${i + 1}: ${lines[i]}`)
    return result.join('\n')
  } catch (err) {
    return `Error reading file: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function listDirRecursive(dir: string, prefix: string, maxDepth: number, output: string[]): Promise<void> {
  if (maxDepth <= 0) return
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const skipDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next'])
    const dirs = entries.filter((e) => e.isDirectory() && !skipDirs.has(e.name)).sort((a, b) => a.name.localeCompare(b.name))
    const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))
    for (const d of dirs) {
      output.push(`${prefix}${d.name}/`)
      await listDirRecursive(path.join(dir, d.name), prefix + '  ', maxDepth - 1, output)
    }
    for (const f of files) {
      const fp = path.join(dir, f.name)
      try {
        const size = statSync(fp).size
        output.push(`${prefix}${f.name}  (~${Math.ceil(size / 4).toLocaleString()} tokens)`)
      } catch {
        output.push(`${prefix}${f.name}`)
      }
    }
  } catch { /* permission denied, skip */ }
}

const TS_INCLUDES = ['--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.jsx', '--include=*.mjs']

// --- srcwalk_read ---

export const srcwalkReadTool = {
  name: 'srcwalk_read',
  description: `Read a file with optional section (line range, symbol, or path:line format). Small files return full content; large files support outlining. Use path:start-end for range reads (e.g. "src/app.ts:44-89").`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File path to read (supports path:line or path:start-end)' },
      section: { type: 'string', description: "Line range '44-89' or heading/symbol name" },
      full: { type: 'boolean', description: 'Force full content' },
    },
    required: ['path'],
  },
}

async function srcwalkReadExecute(args: { path: string; section?: string; full?: boolean }): Promise<string> {
  const fileArg = String(args.path)
  const cwd = process.cwd()
  const fullFilePath = path.resolve(cwd, fileArg)

  const rangeMatch = fileArg.match(/^(.+?):(\d+)(?:-(\d+))?$/)
  if (rangeMatch) {
    const relPath = rangeMatch[1]
    const resolved = path.resolve(cwd, relPath)
    const startLine = parseInt(rangeMatch[2], 10)
    const endLine = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : startLine
    return readFileRange(resolved, startLine, endLine, relPath)
  }

  if (!existsSync(fullFilePath)) return `File not found: ${fileArg}`
  const stats = statSync(fullFilePath)

  if (args.section) {
    const section = String(args.section)
    const lineMatch = section.match(/^(\d+)(?:-(\d+))?$/)
    if (lineMatch) {
      const start = parseInt(lineMatch[1], 10)
      const end = lineMatch[2] ? parseInt(lineMatch[2], 10) : start + 30
      return readFileRange(fullFilePath, start, end)
    }
    const grepArgs = ['-n', '--color=never', '-E', `^(function |const |let |class |interface |type |export |## |### )?.*${section}`, fullFilePath]
    const result = run('grep', grepArgs)
    if (result.stdout) {
      const firstMatch = result.stdout.split('\n')[0]
      const lineNum = parseInt(firstMatch.split(':')[0], 10)
      if (!isNaN(lineNum)) return readFileRange(fullFilePath, Math.max(1, lineNum - 3), lineNum + 40)
    }
    return `Section "${section}" not found in ${fileArg}`
  }

  if (stats.size < 50 * 1024 || args.full) {
    const content = readFileSync(fullFilePath, 'utf-8')
    const lines = content.split('\n')
    if (lines.length > 2000) return `[File too large: ${plural(lines.length, 'line')}. Showing first 2000 lines]\n\n${lines.slice(0, 2000).join('\n')}`
    return content
  }

  const content = readFileSync(fullFilePath, 'utf-8')
  const lines = content.split('\n')
  const headings: string[] = []
  for (let i = 0; i < Math.min(lines.length, 5000); i++) {
    const l = lines[i].trim()
    if (l.match(/^(export\s+)?(function|class|interface|type|const|enum|def|struct|impl|pub\s+fn)\s/) || l.match(/^(##|###)\s/) || l.match(/^\w+\s*[:=]/))
      headings.push(`  ${i + 1}: ${l.slice(0, 120)}`)
  }
  const header = `[File: ${fileArg} — ${plural(lines.length, 'line')}, ${(stats.size / 1024).toFixed(1)}KB]\n\n`
  const outline = headings.length > 0
    ? `Outline (${plural(headings.length, 'entry')}):\n${headings.slice(0, 50).join('\n')}\n\nUse path:line or section to read a specific range.`
    : `Use path:line to read a specific range (e.g., ${fileArg}:1-${Math.min(50, lines.length)}).`
  return header + outline
}

// --- srcwalk_deps ---

export const srcwalkDepsTool = {
  name: 'srcwalk_deps',
  description: `Show what imports a file (dependents) and what a file imports (dependencies). Blast-radius check before breaking changes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File path to analyze' },
      scope: { type: 'string', description: 'Search scope (default: project root)' },
    },
    required: ['path'],
  },
}

async function srcwalkDepsExecute(args: { path: string; scope?: string }): Promise<string> {
  const filePath = String(args.path)
  const cwd = process.cwd()
  const absPath = path.resolve(cwd, filePath)
  if (!existsSync(absPath)) return `File not found: ${filePath}`
  const scopeDir = path.resolve(cwd, args.scope ? String(args.scope) : '')
  const fileName = path.basename(filePath, path.extname(filePath))

  const content = readFileSync(absPath, 'utf-8')
  const importLines: string[] = []
  for (const line of content.split('\n')) {
    const m = line.match(/(?:import|require)\s+.*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/)
    if (m) importLines.push(`  ${line.trim()}`)
  }

  const grepResult = run('grep', ['-rn', '--color=never', '-E', `from ['"](\\./|\\.\\./|.*/)${fileName}['"]|require\\(['"](\\./|\\.\\./|.*/)${fileName}['"]`, scopeDir, ...TS_INCLUDES])
  const importers = grepResult.stdout.split('\n').filter(Boolean).slice(0, 30)

  const result: string[] = [`## Dependencies for ${filePath}\n`, `### Imports (${plural(importLines.length, 'module')})`]
  if (importLines.length === 0) result.push('  (none)'); else result.push(...importLines)
  result.push(`\n### Importers (${plural(importers.length, 'file')})`)
  if (importers.length === 0) result.push('  (no files import this module)')
  else result.push(...importers.map((l) => `  ${path.relative(cwd, l.split(':')[0])}:${l.split(':')[1]}`))
  return result.join('\n')
}

// --- srcwalk_map ---

export const srcwalkMapTool = {
  name: 'srcwalk_map',
  description: `Token-annotated directory skeleton. Shows repo structure with file sizes and token estimates. Good for understanding codebase shape.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      scope: { type: 'string', description: 'Directory to map (default: project root)' },
      depth: { type: 'number', description: 'Max directory depth (default: 3)' },
    },
  },
}

async function srcwalkMapExecute(args: { scope?: string; depth?: number }): Promise<string> {
  const cwd = process.cwd()
  const scopeDir = path.resolve(cwd, args.scope ? String(args.scope) : '')
  const maxDepth = args.depth ?? 3
  const treeResult = run('tree', ['-L', String(maxDepth), '--dirsfirst', '-I', '.git|node_modules|dist|build|coverage|.next', scopeDir])
  if (treeResult.code === 0) return treeResult.stdout.slice(0, 10_000)
  const result: string[] = [`## Directory: ${path.relative(cwd, scopeDir) || '.'}\n`]
  await listDirRecursive(scopeDir, '', maxDepth, result)
  return result.join('\n')
}

// --- srcwalk_callers ---

export const srcwalkCallersTool = {
  name: 'srcwalk_callers',
  description: `Reverse call graph — find what calls a function. Grep-based: searches for symbol usage across the codebase. Use depth for transitive callers (multi-hop).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      symbol: { type: 'string', description: 'Function/symbol name' },
      scope: { type: 'string', description: 'Search scope' },
      depth: { type: 'number', description: 'BFS hop depth (default: 1, max: 3)' },
      filter: { type: 'string', description: 'Optional filter (e.g. path:api)' },
    },
    required: ['symbol'],
  },
}

async function srcwalkCallersExecute(args: { symbol: string; scope?: string; depth?: number; filter?: string }): Promise<string> {
  const symbol = String(args.symbol ?? '').trim()
  if (!symbol) return 'symbol is required.'
  const cwd = process.cwd()
  const scopeDir = path.resolve(cwd, args.scope ? String(args.scope) : '')
  const depth = Math.min(args.depth ?? 1, 3)
  const grepArgs = ['-rn', '--color=never', '-E', `[.\\s]${symbol}\\s*\\(|[.]${symbol}\\b|\\b${symbol}\\.`, scopeDir, ...TS_INCLUDES]
  if (args.filter) {
    const filterStr = String(args.filter)
    if (filterStr.startsWith('path:')) grepArgs.push(path.join(scopeDir, filterStr.slice(5)))
  }
  const result = run('grep', grepArgs)
  const lines = result.stdout.split('\n').filter(Boolean).slice(0, 50)
  if (lines.length === 0) return `No callers found for "${symbol}".`
  const output = [`## Callers of \`${symbol}\` (${plural(lines.length, 'result')})${depth > 1 ? ` (depth: ${depth})` : ''}\n`]
  for (const line of lines) {
    const parts = line.split(':')
    if (parts.length >= 2) output.push(`  ${path.relative(cwd, parts[0])}:${parts[1]}: ${parts.slice(2).join(':').trim().slice(0, 150)}`)
    else output.push(`  ${line.slice(0, 200)}`)
  }
  if (depth > 1) output.push(`\n_Note: Multi-hop depth (${depth}) requires re-running on each caller._`)
  return output.join('\n')
}

// --- srcwalk_callees ---

export const srcwalkCalleesTool = {
  name: 'srcwalk_callees',
  description: `Forward call graph — what does this function call? Reads the function body and extracts call sites.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      symbol: { type: 'string', description: 'Function/symbol name' },
      scope: { type: 'string', description: 'Scope directory' },
      detailed: { type: 'boolean', description: 'Show ordered call sites with argument slots' },
    },
    required: ['symbol'],
  },
}

const KEYWORD_EXCLUDE = ['if', 'for', 'while', 'switch', 'catch', 'typeof', 'instanceof', 'return', 'throw', 'new', 'delete', 'await', 'yield']

async function srcwalkCalleesExecute(args: { symbol: string; scope?: string; detailed?: boolean }): Promise<string> {
  const symbol = String(args.symbol ?? '').trim()
  if (!symbol) return 'symbol is required.'
  const cwd = process.cwd()
  const scopeDir = path.resolve(cwd, args.scope ? String(args.scope) : '')
  const defResult = run('grep', ['-rn', '--color=never', '-E', `(export\\s+)?(function|const|let|async\\s+function)\\s+${symbol}\\b|${symbol}\\s*[:=]\\s*(async\\s+)?\\(`, scopeDir, ...TS_INCLUDES])
  const defLines = defResult.stdout.split('\n').filter(Boolean).slice(0, 5)
  if (defLines.length === 0) return `Definition not found for "${symbol}". Cannot trace callees without finding the function body.`
  const output = [`## Callees of \`${symbol}\`\n`]
  for (const def of defLines) {
    const parts = def.split(':')
    if (parts.length < 2) continue
    const relPath = path.relative(cwd, parts[0])
    const lineNum = parseInt(parts[1], 10)
    output.push(`**Definition:** ${relPath}:${lineNum}`)
    const filePath = path.resolve(cwd, parts[0])
    if (existsSync(filePath)) {
      const fileLines = readFileSync(filePath, 'utf-8').split('\n')
      let braceCount = 0, inFunc = false
      const calls: string[] = []
      for (let i = lineNum - 1; i < Math.min(lineNum + 80, fileLines.length); i++) {
        const line = fileLines[i]
        if (!inFunc) {
          if (line.includes('{')) { inFunc = true; braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length }
          continue
        }
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
        for (const m of line.matchAll(/(?<![.\w])(\w+)\s*\(/g)) {
          if (!KEYWORD_EXCLUDE.includes(m[1])) {
            const argStart = line.indexOf('(', m.index!)
            const argEnd = line.indexOf(')', argStart)
            const argStr = argEnd > argStart ? line.slice(argStart + 1, argEnd).trim().slice(0, 60) : ''
            calls.push(`  ${args.detailed ? `${m[1]}(${argStr})` : `${m[1]}()`}`)
          }
        }
        if (braceCount <= 0) break
      }
      if (calls.length > 0) output.push(...calls); else output.push('  (no internal calls found)')
      output.push('')
    }
  }
  return output.join('\n')
}

// --- srcwalk_flow ---

export const srcwalkFlowTool = {
  name: 'srcwalk_flow',
  description: `Compact function orientation — ordered callees + direct callers. Quick understanding of a function's role in the call graph.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      symbol: { type: 'string', description: 'Symbol name to analyze' },
      scope: { type: 'string', description: 'Search scope' },
    },
    required: ['symbol'],
  },
}

async function srcwalkFlowExecute(args: { symbol: string; scope?: string }): Promise<string> {
  const symbol = String(args.symbol ?? '').trim()
  if (!symbol) return 'symbol is required.'
  const cwd = process.cwd()
  const scopeDir = path.resolve(cwd, args.scope ? String(args.scope) : '')
  const callersResult = run('grep', ['-rn', '--color=never', '-E', `[.\\s]${symbol}\\s*\\(|[.]${symbol}\\b`, scopeDir, ...TS_INCLUDES])
  const callers = callersResult.stdout.split('\n').filter(Boolean).slice(0, 15)
  const defResult = run('grep', ['-rn', '--color=never', '-E', `(function|const|let)\\s+${symbol}\\b|${symbol}\\s*[:=]\\s*(async\\s+)?\\(`, scopeDir, ...TS_INCLUDES])
  const defLine = defResult.stdout.split('\n').filter(Boolean)[0]
  let callees: string[] = []
  if (defLine) {
    const parts = defLine.split(':')
    if (parts.length >= 2) {
      const fp = path.resolve(cwd, parts[0])
      const ln = parseInt(parts[1], 10)
      if (existsSync(fp)) {
        const fileLines = readFileSync(fp, 'utf-8').split('\n')
        let bc = 0, inF = false
        for (let i = ln - 1; i < Math.min(ln + 60, fileLines.length); i++) {
          const l = fileLines[i]
          if (!inF) { if (l.includes('{')) { inF = true; bc = (l.match(/{/g) || []).length - (l.match(/}/g) || []).length } continue }
          bc += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length
          for (const m of l.matchAll(/(\w+)\s*\(/g)) if (!KEYWORD_EXCLUDE.includes(m[1])) callees.push(m[1])
          if (bc <= 0) break
        }
      }
    }
  }
  const output = [`## Flow: \`${symbol}\``, `\n**Callers (${plural(callers.length, 'file')}):`]
  if (callers.length === 0) output.push('  (none)')
  else output.push(...callers.slice(0, 10).map((l) => `  ${path.relative(cwd, l.split(':')[0])}:${l.split(':')[1]}`))
  output.push(`\n**Callees (${plural(callees.length, 'call')}):`)
  if (callees.length === 0) output.push('  (none)'); else output.push(...[...new Set(callees)].slice(0, 20).map((c) => `  ${c}()`))
  return output.join('\n')
}

// --- srcwalk_impact ---

export const srcwalkImpactTool = {
  name: 'srcwalk_impact',
  description: `Heuristic blast-radius triage — broad 'what might be affected?' starting point. Name-matched, not proof. Use as starting point before verifying with srcwalk_callers or exact reads.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      symbol: { type: 'string', description: 'Symbol name to triage' },
      scope: { type: 'string', description: 'Search scope' },
    },
    required: ['symbol'],
  },
}

async function srcwalkImpactExecute(args: { symbol: string; scope?: string }): Promise<string> {
  const symbol = String(args.symbol ?? '').trim()
  if (!symbol) return 'symbol is required.'
  const cwd = process.cwd()
  const scopeDir = path.resolve(cwd, args.scope ? String(args.scope) : '')
  const grepResult = run('grep', ['-rn', '--color=never', '-E', `\\b${symbol}\\b`, scopeDir, ...TS_INCLUDES])
  const lines = grepResult.stdout.split('\n').filter(Boolean)
  const fileCounts: Record<string, number> = {}
  for (const line of lines) { const filePath = line.split(':')[0]; fileCounts[filePath] = (fileCounts[filePath] || 0) + 1 }
  const dirCounts: Record<string, { files: number; total: number }> = {}
  for (const [filePath, count] of Object.entries(fileCounts)) {
    const dir = path.dirname(filePath)
    if (!dirCounts[dir]) dirCounts[dir] = { files: 0, total: 0 }
    dirCounts[dir].files++; dirCounts[dir].total += count
  }
  const totalOccurrences = lines.length
  const totalFiles = Object.keys(fileCounts).length
  const output = [`## Impact: \`${symbol}\``, `Total: ${plural(totalOccurrences, 'occurrence')} across ${plural(totalFiles, 'file')}\n`, `### By directory`]
  const sortedDirs = Object.entries(dirCounts).sort((a, b) => b[1].total - a[1].total)
  for (const [dir, info] of sortedDirs.slice(0, 15)) output.push(`  ${path.relative(cwd, dir) || '.'}/ — ${plural(info.total, 'occurrence')} in ${plural(info.files, 'file')}`)
  const topFiles = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)
  output.push(`\n### Top files`)
  for (const [filePath, count] of topFiles) output.push(`  ${path.relative(cwd, filePath)} (${plural(count, 'occurrence')})`)
  output.push(`\n_Heuristic: name-matched, not proof. Follow up with srcwalk_callers for exact call sites._`)
  return output.join('\n')
}

// --- exports ---

export const srcwalkTools = [
  srcwalkReadTool, srcwalkDepsTool, srcwalkMapTool, srcwalkCallersTool,
  srcwalkCalleesTool, srcwalkFlowTool, srcwalkImpactTool,
]

export const srcwalkExecute: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  srcwalk_read: srcwalkReadExecute as (a: Record<string, unknown>) => Promise<unknown>,
  srcwalk_deps: srcwalkDepsExecute as (a: Record<string, unknown>) => Promise<unknown>,
  srcwalk_map: srcwalkMapExecute as (a: Record<string, unknown>) => Promise<unknown>,
  srcwalk_callers: srcwalkCallersExecute as (a: Record<string, unknown>) => Promise<unknown>,
  srcwalk_callees: srcwalkCalleesExecute as (a: Record<string, unknown>) => Promise<unknown>,
  srcwalk_flow: srcwalkFlowExecute as (a: Record<string, unknown>) => Promise<unknown>,
  srcwalk_impact: srcwalkImpactExecute as (a: Record<string, unknown>) => Promise<unknown>,
}
