import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { getDb } from './index'
import * as schema from './schema'

let instance: BetterSQLite3Database<typeof schema> | null = null

/**
 * Drizzle query layer over the one shared better-sqlite3 connection. Lazy so
 * importing this module has no side effects until a query actually runs.
 *
 * When prod moves to Postgres (Neon), only this file swaps to the async driver;
 * call sites already written with `await` work against both.
 */
export function getDrizzle(): BetterSQLite3Database<typeof schema> {
  if (!instance) instance = drizzle(getDb(), { schema })
  return instance
}
