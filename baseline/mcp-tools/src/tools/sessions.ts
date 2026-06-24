// Sessions tools (REDUCED port, adapted to ZCode) for the ZCode MCP server.
//
// OpenCode's sessions.ts reads the OpenCode session DB (part/message/session
// tables) via `opencode db path` / XDG fallback. ZCode stores task/session
// metadata in ~/.zcode/v2/tasks-index.sqlite (tasks table: task_id, title,
// searchable_text, created_at, workspace_path). This port searches that table.
//
// Note: ZCode does not expose full message transcripts in this index the way
// OpenCode's part/message tables do, so `read_session` returns the task
// metadata + searchable_text rather than a per-message transcript. If an
// OpenCode DB is present (OPENCODE_DB_PATH / ZCODE_DB_PATH / legacy
// ~/.local/share/opencode/opencode.db), the richer transcript path is used.

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { Database } from '../db.js'

function resolveZcodeDbPath(): string {
  if (process.env.ZCODE_DB_PATH) return process.env.ZCODE_DB_PATH
  if (process.env.OPENCODE_DB_PATH) return process.env.OPENCODE_DB_PATH
  const home = process.env.HOME || process.env.USERPROFILE || ''
  return path.join(home, '.zcode', 'v2', 'tasks-index.sqlite')
}

function resolveOpencodeDbPath(): string | null {
  if (process.env.OPENCODE_DB_PATH) return process.env.OPENCODE_DB_PATH
  if (process.env.ZCODE_DB_PATH) return null // explicit ZCode only
  try {
    const result = spawnSync('opencode', ['db', 'path'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    if (result.status === 0) {
      const p = (result.stdout || '').trim()
      if (p) return p
    }
  } catch { /* fall through */ }
  const home = process.env.HOME || ''
  const legacy = path.join(home, '.local', 'share', 'opencode', 'opencode.db')
  return fs.existsSync(legacy) ? legacy : null
}

const escapeLike = (value: string): string => value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
const formatTime = (ms: number): string | null => (ms ? new Date(ms).toISOString() : null)

interface ZcodeTaskRow {
  task_id: string
  title: string
  workspace_path: string
  task_status: string
  model: string | null
  created_at: number
  updated_at: number
  searchable_text: string | null
}

// --- find_sessions ---

export const findSessionsTool = {
  name: 'find_sessions',
  description: `Search ZCode sessions (tasks) by keyword across titles and searchable_text. Returns ranked matches from ~/.zcode/v2/tasks-index.sqlite.

Example:
find_sessions({ query: "auth refactor", limit: 5 })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query (multi-word AND)' },
      limit: { type: 'number', description: 'Max results (default 6, max 20)' },
      workspace: { type: 'string', description: 'Optional workspace path filter' },
    },
    required: ['query'],
  },
}

async function findSessionsExecute(args: { query: string; limit?: number; workspace?: string }): Promise<string> {
  const trimmed = (args.query || '').trim()
  if (!trimmed) return 'Error: query is required'
  const limit = Math.min(args.limit ?? 6, 20)
  const dbPath = resolveZcodeDbPath()
  if (!fs.existsSync(dbPath)) return `ZCode tasks DB not found at ${dbPath}.`
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  const likeClauses = words.map(() => `lower(searchable_text) LIKE ? ESCAPE '\\'`).join(' AND ')
  const likeParams = words.map((w) => `%${escapeLike(w)}%`)
  const db = new Database(dbPath, { readonly: true })
  try {
    let sql = `SELECT task_id, title, workspace_path, task_status, model, created_at, updated_at, searchable_text
               FROM tasks
               WHERE deleted = 0 AND ${likeClauses}`
    const params: (string | number)[] = [...likeParams]
    if (args.workspace) {
      sql += ` AND workspace_path = ?`
      params.push(args.workspace)
    }
    sql += ` ORDER BY updated_at DESC LIMIT ?`
    params.push(limit)
    const rows = db.query<ZcodeTaskRow>(sql).all(...params)
    if (rows.length === 0) return `No sessions matched "${trimmed}".`
    const out = rows.map((r, i) => {
      const idx = (r.searchable_text || '').toLowerCase().indexOf(words[0])
      const snippet = r.searchable_text ? r.searchable_text.slice(Math.max(0, idx - 40), idx + 200) : ''
      return `## ${i + 1}. ${r.title || '(untitled)'}\n- id: ${r.task_id}\n- workspace: ${r.workspace_path}\n- status: ${r.task_status}${r.model ? `\n- model: ${r.model}` : ''}\n- updated: ${formatTime(r.updated_at)}\n\n\`\`\`\n${snippet.trim()}\n\`\`\``
    })
    return `Found ${rows.length} session(s) for "${trimmed}":\n\n` + out.join('\n\n')
  } finally {
    db.close()
  }
}

// --- read_session ---

export const readSessionTool = {
  name: 'read_session',
  description: `Read a ZCode session (task) by its task_id, returning metadata and searchable_text. If an OpenCode session DB is available, returns a richer per-message transcript instead.

Example:
read_session({ session_id: "sess_abc123" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      session_id: { type: 'string', description: 'Session / task id (sess_*)' },
      focus: { type: 'string', description: 'Optional keyword filter (OpenCode transcript path only)' },
    },
    required: ['session_id'],
  },
}

async function readSessionExecute(args: { session_id: string; focus?: string }): Promise<string> {
  const id = (args.session_id || '').trim()
  if (!id) return 'Error: session_id is required'

  // Prefer OpenCode DB if present (richer transcript).
  const opencodeDb = resolveOpencodeDbPath()
  if (opencodeDb && fs.existsSync(opencodeDb)) {
    return readOpencodeTranscript(opencodeDb, id, args.focus)
  }

  const dbPath = resolveZcodeDbPath()
  if (!fs.existsSync(dbPath)) return `ZCode tasks DB not found at ${dbPath}.`
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.query<ZcodeTaskRow>(
      `SELECT task_id, title, workspace_path, task_status, model, created_at, updated_at, searchable_text
       FROM tasks WHERE task_id = ? AND deleted = 0 LIMIT 1`,
    ).get(id)
    if (!row) return `Session ${id} not found.`
    return JSON.stringify({
      sessionId: row.task_id,
      title: row.title,
      workspace: row.workspace_path,
      status: row.task_status,
      model: row.model,
      created: formatTime(row.created_at),
      updated: formatTime(row.updated_at),
      searchableText: row.searchable_text,
    }, null, 2)
  } finally {
    db.close()
  }
}

function readOpencodeTranscript(dbPath: string, sessionId: string, focus?: string): string {
  const db = new Database(dbPath, { readonly: true })
  try {
    const session = db.query<{ id: string; title: string; directory: string; time_created: number; time_updated: number }>(
      `SELECT id, title, directory, time_created, time_updated FROM session WHERE id = ? LIMIT 1`,
    ).get(sessionId)
    if (!session) return `Session ${sessionId} not found in OpenCode DB.`
    const params: (string | number)[] = [sessionId]
    let focusClauses = ''
    if (focus) {
      const words = focus.toLowerCase().split(/\s+/).filter(Boolean)
      for (const word of words) {
        focusClauses += ` AND lower(json_extract(p.data, '$.text')) LIKE ? ESCAPE '\\'`
        params.push(`%${escapeLike(word)}%`)
      }
    }
    params.push(80)
    const entries = db.query<{ time_created: number; role: string; text: string }>(
      `SELECT p.time_created, json_extract(m.data, '$.role') AS role,
              substr(json_extract(p.data, '$.text'), 1, 600) AS text
       FROM part p JOIN message m ON m.id = p.message_id
       WHERE p.session_id = ? AND json_extract(p.data, '$.type') = 'text'
         AND json_extract(m.data, '$.role') IN ('user','assistant')
         AND json_extract(p.data, '$.text') IS NOT NULL
         ${focusClauses}
       ORDER BY p.time_created ASC LIMIT ?`,
    ).all(...params)
    return JSON.stringify({
      sessionId: session.id, title: session.title, directory: session.directory,
      created: formatTime(session.time_created), updated: formatTime(session.time_updated),
      entries: entries.map((e) => ({ time: formatTime(e.time_created), role: e.role, text: e.text })),
    }, null, 2)
  } finally {
    db.close()
  }
}

export const sessionsTools = [findSessionsTool, readSessionTool]

export const sessionsExecute: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  find_sessions: findSessionsExecute as (a: Record<string, unknown>) => Promise<unknown>,
  read_session: readSessionExecute as (a: Record<string, unknown>) => Promise<unknown>,
}
