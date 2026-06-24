// grep.app code search tool — ported verbatim from
// opencode-starterkit baseline/tool/grepsearch.ts (pure HTTP fetch, no OpenCode SDK).
// Exposed as an MCP tool so ZCode Agent can call it manually.

const GREP_APP_API = 'https://grep.app/api/search'

interface SearchResult {
  repo: string
  path: string
  content: { snippet: string }
  total_matches: string
}
interface GrepResponse { hits: { hits: SearchResult[] }; time: number }

export const grepsearchTool = {
  name: 'grepsearch',
  description: `Search real-world code examples from GitHub repositories via grep.app. Replaces asking "how do others use X?" — use this for finding production patterns and real-world API usage.

WHEN: Implementing unfamiliar APIs, looking for production patterns, understanding library integrations.
SKIP: Searching your own codebase (use grep), looking up docs (use context7).

IMPORTANT: Search for **literal code patterns**, not keywords:
✅ Good: "useState(", "import React from", "async function"
❌ Bad: "react tutorial", "best practices", "how to use"

Examples:
  grepsearch({ query: "getServerSession", language: "TypeScript" })
  grepsearch({ query: "CORS(", language: "Python", repo: "flask" })
  grepsearch({ query: "export async function POST", path: "route.ts" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Code pattern to search for (literal text)' },
      language: { type: 'string', description: 'Filter by language: TypeScript, TSX, Python, Go, Rust, etc.' },
      repo: { type: 'string', description: "Filter by repo: 'owner/repo' or partial match" },
      path: { type: 'string', description: "Filter by file path: 'src/', '.test.ts', etc." },
      limit: { type: 'number', description: 'Max results to return (default: 10, max: 20)' },
    },
    required: ['query'],
  },
}

export async function grepsearchExecute(args: {
  query: string
  language?: string
  repo?: string
  path?: string
  limit?: number
}): Promise<string> {
  const { query, language, repo, path, limit = 10 } = args
  if (!query || query.trim() === '') return 'Error: query is required'

  const url = new URL(GREP_APP_API)
  url.searchParams.set('q', query)
  if (language) url.searchParams.set('filter[lang][0]', language)
  if (repo) url.searchParams.set('filter[repo][0]', repo)
  if (path) url.searchParams.set('filter[path][0]', path)

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'ZCode-Starterkit/1.0' },
    })
    if (!response.ok) return `Error: grep.app API returned ${response.status}`
    const data = (await response.json()) as GrepResponse
    if (!data.hits?.hits?.length) return `No results found for: ${query}${language ? ` (${language})` : ''}`
    const maxResults = Math.min(limit, 20)
    const results = data.hits.hits.slice(0, maxResults)
    const formatted = results.map((hit, i) => {
      const repoName = hit.repo || 'unknown'
      const filePath = hit.path || 'unknown'
      const snippet = hit.content?.snippet || ''
      const cleanCode = snippet
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .split('\n')
        .slice(0, 8)
        .join('\n')
        .trim()
      return `## ${i + 1}. ${repoName}\n**File**: ${filePath}\n\`\`\`\n${cleanCode}\n\`\`\``
    })
    return `Found ${data.hits.hits.length} results (showing ${results.length}) in ${data.time}ms:\n\n${formatted.join('\n\n')}`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Error searching grep.app: ${message}`
  }
}
