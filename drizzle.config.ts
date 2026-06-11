import { defineConfig } from 'drizzle-kit'

// Local/dev + e2e run SQLite; prod will point at Neon Postgres (Phase 2).
export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/community.db',
  },
})
