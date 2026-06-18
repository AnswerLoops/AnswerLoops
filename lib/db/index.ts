import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'community.db')

// Cache the connection on globalThis, not a module-level variable: Next bundles
// each route/page/server-action separately, so a module-scoped singleton would
// open a *separate* connection per bundle. Under WAL those connections don't see
// each other's freshly committed writes, so a write in a server action wouldn't
// be visible to the page that re-renders after it. One shared connection per
// process fixes that.
const globalForDb = globalThis as unknown as { __communityDb?: Database.Database }

export function getDb(): Database.Database {
  if (!globalForDb.__communityDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    const db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    const schema = fs.readFileSync(path.join(process.cwd(), 'lib/db/schema.sql'), 'utf8')
    db.exec(schema)
    // Idempotent migrations for columns added after initial schema rollout.
    try { db.exec('ALTER TABLE orgs ADD COLUMN onboarded_at TEXT') } catch (_) {}
    try { db.exec('ALTER TABLE orgs ADD COLUMN widget_token TEXT') } catch (_) {}
    try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orgs_widget_token ON orgs(widget_token)') } catch (_) {}
    try { db.exec('ALTER TABLE orgs ADD COLUMN widget_token_expires_at TEXT') } catch (_) {}
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS ai_configs (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id             INTEGER NOT NULL UNIQUE REFERENCES orgs(id),
        chat_provider      TEXT NOT NULL DEFAULT 'openai',
        chat_model         TEXT NOT NULL DEFAULT 'gpt-4o',
        chat_api_key       TEXT,
        chat_base_url      TEXT,
        embedding_provider TEXT NOT NULL DEFAULT 'openai',
        embedding_model    TEXT NOT NULL DEFAULT 'text-embedding-3-small',
        embedding_api_key  TEXT,
        embedding_base_url TEXT,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
      )`)
    } catch (_) {}
    globalForDb.__communityDb = db
  }
  return globalForDb.__communityDb
}
