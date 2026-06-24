// csearch — multi-keyword code search with BM25 ranking, ported from
// opencode-starterkit baseline/plugin/codesearch/*.ts. Consolidated into one
// file. No OpenCode SDK dependency: scope resolves from process.cwd(), no
// AbortSignal plumbing. Requires ripgrep (rg) on PATH.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// --- utils ---

interface RawMatch { file: string; line: number; text: string }

function run(cmd: string, args: string[], cwd?: string): { stdout: string; code: number } {
  try {
    const result = execFileSync(cmd, args, {
      encoding: 'utf-8' as const,
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
      cwd: cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout: result as string, code: 0 }
  } catch {
    return { stdout: '', code: 1 }
  }
}

function expandQuery(query: string): string[] {
  const keywords = new Set<string>()
  for (const part of query.trim().split(/\s+/)) {
    if (part.length === 0) continue
    keywords.add(part)
    for (const c of part.split(/(?<=[a-z])(?=[A-Z])/)) {
      const cleaned = c.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
      if (cleaned.length > 1 && cleaned !== part.toLowerCase()) keywords.add(cleaned)
    }
  }
  return Array.from(keywords)
}

function parseMatches(raw: string): RawMatch[] {
  const results: RawMatch[] = []
  for (const line of raw.split('\n').filter(Boolean)) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const file = line.slice(0, colonIdx)
    const rest = line.slice(colonIdx + 1)
    const lineBreak = rest.indexOf(':')
    const lineNum = lineBreak > 0 ? parseInt(rest.slice(0, lineBreak), 10) : NaN
    const text = lineBreak > 0 ? rest.slice(lineBreak + 1).trim().slice(0, 200) : rest.trim().slice(0, 200)
    if (!isNaN(lineNum)) results.push({ file, line: lineNum, text })
  }
  return results
}

function searchKeyword(keyword: string, scopeDir: string, limit: number, glob?: string): RawMatch[] {
  const rgArgs = ['--no-heading', '--line-number', '--color', 'never', '-F', '-i', '--max-count', String(limit)]
  if (glob) rgArgs.push('--glob', glob)
  rgArgs.push('--', keyword, scopeDir)
  return parseMatches(run('rg', rgArgs).stdout)
}

function ensureRgAvailable(): string | null {
  try {
    execFileSync('rg', ['--version'], { encoding: 'utf-8' as const, timeout: 2000, stdio: 'ignore' })
    return null
  } catch {
    return 'ripgrep (rg) is required but not found. Install ripgrep and ensure it is on PATH.'
  }
}

function resolveScope(baseDir: string, scopeArg: string): { dir: string; error: string | null } {
  const scopeDir = scopeArg ? path.resolve(baseDir, scopeArg) : baseDir
  if (!existsSync(scopeDir)) return { dir: scopeDir, error: `Scope directory not found: ${scopeArg || '.'}` }
  return { dir: scopeDir, error: null }
}

// --- extract ---

const DECLARATION_PATTERNS = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\*?(?:\s*\w+\s*)?[<(]/,
  /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+\w+/,
  /^\s*(?:export\s+)?interface\s+\w+/,
  /^\s*(?:export\s+)?type\s+\w+\s*=/,
  /^\s*(?:export\s+)?enum\s+\w+/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*(?::\s*\w+\s*)?=\s*(?:async\s+)?\(.*\)\s*(?::\s*\w+\s*)?=>\s*\{/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function\b/,
  /^\s*(?:get|set)\s+\w+\s*\(/,
]

interface CodeChunk {
  file: string
  relPath: string
  startLine: number
  endLine: number
  text: string
  matchedKeywords: string[]
  score: number
}

function isDeclarationLine(line: string): boolean { return DECLARATION_PATTERNS.some((p) => p.test(line)) }
function isMethodLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.endsWith('{')) return false
  if (!/^\w+\s*(?:<[^>]*>)?\s*\(/.test(trimmed)) return false
  if (/^(if|for|while|switch|catch|return|throw|import|export)\b/.test(trimmed)) return false
  return true
}

function countChar(s: string, ch: string): number {
  let count = 0
  for (let i = 0; i < s.length; i++) if (s[i] === ch) count++
  return count
}

function findBlockEnd(lines: string[], startIdx: number): number {
  let depth = 0, started = false, inBlockComment = false
  for (let i = startIdx; i < lines.length; i++) {
    let line = lines[i]
    if (inBlockComment) {
      const endIdx = line.indexOf('*/')
      if (endIdx !== -1) { inBlockComment = false; line = line.slice(endIdx + 2) } else continue
    }
    line = line.replace(/"(?:[^"\\]|\\.)*"/g, '').replace(/'(?:[^'\\]|\\.)*'/g, '').replace(/`(?:[^`\\]|\\.)*`/g, '')
    line = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    const blockStartIdx = line.indexOf('/*')
    if (blockStartIdx !== -1) { inBlockComment = true; line = line.slice(0, blockStartIdx) }
    const opens = countChar(line, '{')
    const closes = countChar(line, '}')
    if (opens > 0 || closes > 0) started = true
    depth += opens - closes
    if (started && depth === 0) return i
  }
  return lines.length - 1
}

function extractEnclosingChunk(fileLines: string[], targetLine: number): { startLine: number; endLine: number; text: string } | null {
  const targetIdx = targetLine - 1
  for (let i = targetIdx; i >= 0; i--) {
    const line = fileLines[i]
    const trimmedStart = line.trimStart()
    if (trimmedStart.startsWith('}') && i < targetIdx) break
    if (isDeclarationLine(line) || isMethodLine(line)) {
      let braceBalance = 0
      for (let j = i; j < fileLines.length; j++) {
        braceBalance += countChar(fileLines[j], '{') - countChar(fileLines[j], '}')
        if (braceBalance > 0) break
        if (j - i > 20) break
      }
      if (braceBalance > 0 || line.includes('=>')) {
        const endLine = findBlockEnd(fileLines, i)
        return { startLine: i + 1, endLine: endLine + 1, text: fileLines.slice(i, endLine + 1).join('\n') }
      }
    }
  }
  const line = fileLines[targetIdx]
  if (isDeclarationLine(line) || isMethodLine(line)) {
    let braceBalance = 0
    for (let j = targetIdx; j < fileLines.length; j++) {
      braceBalance += countChar(fileLines[j], '{') - countChar(fileLines[j], '}')
      if (braceBalance > 0) break
      if (j - targetIdx > 20) break
    }
    if (braceBalance > 0 || line.includes('=>')) {
      const endLine = findBlockEnd(fileLines, targetIdx)
      return { startLine: targetIdx + 1, endLine: endLine + 1, text: fileLines.slice(targetIdx, endLine + 1).join('\n') }
    }
  }
  return null
}

function extractChunksFromMatches(
  contextDir: string,
  fileMatches: Map<string, RawMatch[]>,
  matchKeywordMap: Map<string, string[]>,
): { chunks: CodeChunk[]; keywordDocCount: Map<string, number> } {
  const chunks: CodeChunk[] = []
  const keywordDocCount = new Map<string, number>()
  for (const [filePath, matches] of fileMatches) {
    const absPath = path.resolve(contextDir, filePath)
    let fileLines: string[]
    try { fileLines = readFileSync(absPath, 'utf-8').split('\n') } catch { continue }
    matches.sort((a, b) => a.line - b.line)
    const assignedLines = new Set<number>()
    for (const m of matches) {
      if (assignedLines.has(m.line)) continue
      const chunk = extractEnclosingChunk(fileLines, m.line)
      if (chunk) {
        if (chunks.some((c) => c.file === filePath && c.startLine === chunk.startLine)) { assignedLines.add(m.line); continue }
        const chunkKeywords = new Set(matchKeywordMap.get(`${filePath}:${m.line}`) ?? [])
        for (const other of matches) {
          if (other.line === m.line) continue
          if (other.line >= chunk.startLine && other.line <= chunk.endLine) {
            for (const kw of (matchKeywordMap.get(`${filePath}:${other.line}`) ?? [])) chunkKeywords.add(kw)
            assignedLines.add(other.line)
          }
        }
        const kwArr = Array.from(chunkKeywords)
        for (const kw of kwArr) keywordDocCount.set(kw, (keywordDocCount.get(kw) ?? 0) + 1)
        chunks.push({ file: filePath, relPath: path.relative(contextDir, filePath), startLine: chunk.startLine, endLine: chunk.endLine, text: chunk.text, matchedKeywords: kwArr, score: 0 })
        assignedLines.add(m.line)
      } else {
        const matchedKeywords = matchKeywordMap.get(`${filePath}:${m.line}`) ?? []
        const contextStart = Math.max(0, m.line - 4)
        const contextEnd = Math.min(fileLines.length, m.line + 3)
        for (const kw of matchedKeywords) keywordDocCount.set(kw, (keywordDocCount.get(kw) ?? 0) + 1)
        chunks.push({ file: filePath, relPath: path.relative(contextDir, filePath), startLine: contextStart + 1, endLine: contextEnd, text: fileLines.slice(contextStart, contextEnd).join('\n'), matchedKeywords, score: 0 })
        assignedLines.add(m.line)
      }
    }
  }
  return { chunks, keywordDocCount }
}

// --- ranking ---

const BM25_K1 = 1.5
const BM25_B = 0.75

function bm25Score(chunkText: string, keywords: string[], kwFreqInChunk: Map<string, number>, kwDocCount: Map<string, number>, totalChunks: number, avgChunkLen: number): number {
  const docLen = chunkText.split(/\s+/).length
  let score = 0
  for (const kw of keywords) {
    const tf = kwFreqInChunk.get(kw) ?? 0
    if (tf === 0) continue
    const df = kwDocCount.get(kw) ?? 1
    const idf = Math.log((totalChunks - df + 0.5) / (df + 0.5) + 1)
    score += idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgChunkLen))))
  }
  return score
}

function scoreChunks(chunks: CodeChunk[], keywords: string[], kwDocCount: Map<string, number>): void {
  const totalChunks = chunks.length
  if (totalChunks === 0) return
  const avgChunkLen = chunks.reduce((sum, c) => sum + c.text.split(/\s+/).length, 0) / totalChunks
  for (const chunk of chunks) {
    const kwFreq = new Map<string, number>()
    const lowerChunk = chunk.text.toLowerCase()
    for (const kw of chunk.matchedKeywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      kwFreq.set(kw, (lowerChunk.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length)
    }
    chunk.score = bm25Score(chunk.text, keywords, kwFreq, kwDocCount, totalChunks, avgChunkLen)
  }
}

// --- format ---

function plural(n: number, word: string): string {
  if (n === 1) return `${n} ${word}`
  if (['ch', 's', 'sh', 'x', 'z'].some((s) => word.endsWith(s))) return `${n} ${word}es`
  if (word.endsWith('y') && word.length > 1 && !'aeiou'.includes(word[word.length - 2])) return `${n} ${word.slice(0, -1)}ies`
  return `${n} ${word}s`
}

function guessChunkName(text: string, startLine: number): string {
  const firstLine = text.split('\n')[0]?.trim() ?? ''
  const fnMatch = firstLine.match(/(?:function|class|interface|type|enum)\s+(\w+)/)
  if (fnMatch) return fnMatch[1]
  const constMatch = firstLine.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)/)
  if (constMatch) return constMatch[1]
  const methodMatch = firstLine.match(/^\s*(get|set)\s+(\w+)/)
  if (methodMatch) return `${methodMatch[1]} ${methodMatch[2]}`
  const methodName = firstLine.match(/^\s*(\w+)\s*\(/)
  if (methodName) return methodName[1]
  return `chunk at L${startLine}`
}

function formatResults(query: string, keywords: string[], topChunks: CodeChunk[], totalChunks: number, fileCount: number, abortedEarly: boolean, scopeArg: string): string {
  const fileGroups = new Map<string, CodeChunk[]>()
  for (const chunk of topChunks) {
    const existing = fileGroups.get(chunk.relPath)
    if (existing) existing.push(chunk)
    else fileGroups.set(chunk.relPath, [chunk])
  }
  const output: string[] = [
    `# Csearch: ${query}`,
    `Keywords: ${keywords.join(', ')}`,
    `Found ${plural(totalChunks, 'chunk')} across ${plural(fileCount, 'file')}`,
    `Showing top ${topChunks.length}${abortedEarly ? ' (partial — search cancelled)' : ''}`,
    '',
  ]
  for (const [filePath, fileChunks] of fileGroups) {
    output.push(`## ${filePath} — ${plural(fileChunks.length, 'chunk')}`, '')
    for (const chunk of fileChunks) {
      const name = guessChunkName(chunk.text, chunk.startLine)
      output.push(`### ${name} (L${chunk.startLine}-L${chunk.endLine}) — score: ${chunk.score.toFixed(1)}, keywords: [${chunk.matchedKeywords.join(', ')}]`)
      output.push('```typescript', chunk.text, '```', '')
    }
  }
  output.push(`> Next: search exact symbol names with grep (built-in)`)
  return output.join('\n')
}

// --- tool export ---

export const csearchTool = {
  name: 'csearch',
  description: `Search codebase by multiple keywords and return ranked function-level code chunks (ripgrep + BM25). Respects .gitignore.

Best practices:
  - Instead of "how is auth handled", provide: "auth token login session middleware"
  - Include synonyms: "user authentication" → "user auth login token session"

Returns chunks with file paths, line ranges, and complete source code.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: "Space-separated search keywords. Be specific: 'auth token login jwt' not 'security stuff'." },
      scope: { type: 'string', description: "Subdirectory to search within (e.g., 'src/') — defaults to project root" },
      glob: { type: 'string', description: "Optional glob pattern to filter file types, e.g. '*.ts' or '**/*.test.ts'." },
      max_results: { type: 'number', description: 'Maximum chunks to return (default: 15, max: 30)' },
    },
    required: ['query'],
  },
}

export async function csearchExecute(args: {
  query: string
  scope?: string
  glob?: string
  max_results?: number
}): Promise<string> {
  const query = String(args.query ?? '').trim()
  if (!query) return 'query is required.'
  const scopeArg = args.scope ? String(args.scope).trim() : ''
  const { dir: scopeDir, error: scopeErr } = resolveScope(process.cwd(), scopeArg)
  if (scopeErr) return scopeErr
  const maxResults = Math.min(args.max_results ?? 15, 30)
  const glob = args.glob ? String(args.glob).trim() : undefined

  const rgErr = ensureRgAvailable()
  if (rgErr) return rgErr

  const keywords = expandQuery(query)
  if (keywords.length === 0) return `No search keywords extracted from: "${query}"`

  const perKeywordLimit = Math.ceil(maxResults * 3)
  const rawMatches: RawMatch[] = []
  const matchKeywordMap = new Map<string, string[]>()
  for (const keyword of keywords) {
    const matches = searchKeyword(keyword, scopeDir, perKeywordLimit, glob)
    for (const m of matches) {
      const key = `${m.file}:${m.line}`
      const existing = matchKeywordMap.get(key)
      if (existing) { if (!existing.includes(keyword)) existing.push(keyword) }
      else { matchKeywordMap.set(key, [keyword]); rawMatches.push(m) }
    }
  }
  if (rawMatches.length === 0)
    return `No results found for keywords: ${keywords.join(', ')}\n\nTips:\n  - Use broader terms\n  - Use grep with exact symbol names if you know them\n  - Check if the scope is correct (current: ${scopeArg || 'project root'})`

  const fileMatches = new Map<string, RawMatch[]>()
  for (const m of rawMatches) {
    const existing = fileMatches.get(m.file)
    if (existing) existing.push(m)
    else fileMatches.set(m.file, [m])
  }

  const { chunks, keywordDocCount } = extractChunksFromMatches(process.cwd(), fileMatches, matchKeywordMap)
  if (chunks.length === 0) return 'No code chunks could be extracted from the matched files.'

  scoreChunks(chunks, keywords, keywordDocCount)
  chunks.sort((a, b) => b.score - a.score)
  const topChunks = chunks.slice(0, maxResults)
  return formatResults(query, keywords, topChunks, chunks.length, fileMatches.size, false, scopeArg)
}
