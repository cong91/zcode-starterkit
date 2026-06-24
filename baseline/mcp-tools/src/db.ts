// Shared SQLite helper using Node's built-in node:sqlite.
// Ported (reduced) from opencode-starterkit baseline/plugin/lib/db/schema.ts.
// ZCode has no OpenCode event bus, so the memory DB is driven by manual MCP
// tool calls rather than auto-capture hooks.

import { createRequire } from 'node:module'

type SqlParam = string | number | bigint | null | Uint8Array
type StatementResult = { changes: number | bigint; lastInsertRowid: number | bigint }
type StatementSyncLike = {
  get(...params: SqlParam[]): unknown
  all(...params: SqlParam[]): unknown[]
  run(...params: SqlParam[]): StatementResult
}
type DatabaseSyncLike = {
  prepare(sql: string): StatementSyncLike
  exec(sql: string): void
  close(): void
}
type DatabaseSyncConstructor = new (
  dbPath: string,
  options?: { readOnly?: boolean; timeout?: number },
) => DatabaseSyncLike

const require = createRequire(import.meta.url)
let DatabaseSyncCtor: DatabaseSyncConstructor | null = null

function getDatabaseSyncConstructor(): DatabaseSyncConstructor {
  if (!DatabaseSyncCtor) {
    const sqlite = require('node:sqlite') as { DatabaseSync: DatabaseSyncConstructor }
    DatabaseSyncCtor = sqlite.DatabaseSync
  }
  return DatabaseSyncCtor
}

function normalizeParams(params: SqlParam[] | [SqlParam[]]): SqlParam[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0]
  return params as SqlParam[]
}

export class Database {
  private readonly db: DatabaseSyncLike

  constructor(dbPath: string, options: { readonly?: boolean } = {}) {
    const DatabaseSync = getDatabaseSyncConstructor()
    this.db = new DatabaseSync(dbPath, { readOnly: options.readonly ?? false, timeout: 5000 })
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  run(sql: string, ...params: SqlParam[] | [SqlParam[]]): { changes: number; lastInsertRowid: number | bigint } {
    const result = this.db.prepare(sql).run(...normalizeParams(params))
    return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid }
  }

  query<Result = unknown, Params extends SqlParam[] = SqlParam[]>(sql: string) {
    const statement = this.db.prepare(sql)
    return {
      get: (...params: Params | [Params]) =>
        statement.get(...normalizeParams(params as SqlParam[] | [SqlParam[]])) as Result | undefined,
      all: (...params: Params | [Params]) =>
        statement.all(...normalizeParams(params as SqlParam[] | [SqlParam[]])) as Result[],
    }
  }

  close(): void {
    this.db.close()
  }
}
