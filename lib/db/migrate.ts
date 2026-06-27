import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { sql } from 'drizzle-orm'
import { getDb } from './drizzle'

export async function runMigrations() {
  const db = getDb()
  await migrate(db, { migrationsFolder: './drizzle' })

  // Idempotent trigger: fires pg_notify('config_changed') whenever the
  // integrations table is written. The bot LISTEN-s on this channel and
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
