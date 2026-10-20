import 'server-only'

import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import path from 'node:path'

export const DB_PATH = process.env.WIDLYIQ_DB ?? path.join(process.cwd(), 'data', 'widlyiq.db')

type Handle = Database.Database
const globalForDb = globalThis as unknown as { widlyiqDb?: Handle }

// [sqlite-query] one read-only handle per server process; the pipeline commits in WAL mode, so reads stay consistent mid-run
function handle(): Handle {
  if (!globalForDb.widlyiqDb) {
    globalForDb.widlyiqDb = new Database(DB_PATH, { readonly: true, fileMustExist: true })
  }
  return globalForDb.widlyiqDb
}

export function hasDatabase(): boolean {
  // The database is a runtime file the pipeline rewrites; it must never be traced into the build output.
  if (!existsSync(/*turbopackIgnore: true*/ DB_PATH)) return false
  const row = handle().prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'offers_clean'").get() as { n: number }
  return row.n > 0
}

export function all<T>(sql: string, params: Record<string, unknown> | unknown[] = []): T[] {
  return handle().prepare(sql).all(params) as T[]
}

export function get<T>(sql: string, params: Record<string, unknown> | unknown[] = []): T | undefined {
  return handle().prepare(sql).get(params) as T | undefined
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
