import { sql } from 'drizzle-orm'
import { getDb } from './drizzle'
import fs from 'node:fs'
import path from 'node:path'

// Drizzle's journal-based migrate() only applies migrations registered in
// drizzle/meta/_journal.json. Our hand-written SQL files (0002+) were never
// added to the journal, so migrate() silently skips them.
//
// This custom runner reads every *.sql file in ./drizzle/ (sorted by name),
// tracks applied migrations in a __custom_migrations table, and runs any
// that haven't been applied yet — no journal required.
export async function runMigrations() {
  const db = getDb()

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS __custom_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const migrationsDir = path.resolve(process.cwd(), 'drizzle')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const applied = await db.execute(
    sql`SELECT filename FROM __custom_migrations`
  ) as unknown as { filename: string }[]
  const appliedSet = new Set(applied.map((r) => r.filename))

  for (const file of files) {
    if (appliedSet.has(file)) continue
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`[migrate] applying ${file}`)
    await db.execute(sql.raw(content))
    await db.execute(
      sql`INSERT INTO __custom_migrations (filename) VALUES (${file})`
    )
  }

  // Idempotent trigger: fires pg_notify('config_changed') whenever the
  // integrations table is written. The bot LISTENs on this channel and
  // hot-swaps its config without polling.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION notify_config_changed()
    RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('config_changed', '{}');
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_config_changed ON integrations;
    CREATE TRIGGER trg_config_changed
      AFTER INSERT OR UPDATE OR DELETE ON integrations
      FOR EACH ROW EXECUTE FUNCTION notify_config_changed();
  `)
}
