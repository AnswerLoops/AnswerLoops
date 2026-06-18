import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { getDb } from './drizzle'

export async function runMigrations() {
  const db = getDb()
  await migrate(db, { migrationsFolder: './drizzle' })
}
