import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Drizzle table definitions. The raw schema.sql still bootstraps the database
 * (and stays the source of truth during the migration); these typed tables are
 * adopted module-by-module as queries move onto Drizzle. New domain tables are
 * added here as each query module is converted.
 */

const now = sql`(datetime('now'))`

export const orgs = sqliteTable('orgs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  createdAt: text('created_at').notNull().default(now),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique(),
  name: text('name'),
  image: text('image'),
  provider: text('provider'),
  createdAt: text('created_at').notNull().default(now),
})

export const memberships = sqliteTable('memberships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  orgId: integer('org_id').notNull().references(() => orgs.id),
  role: text('role').notNull().default('owner'),
  createdAt: text('created_at').notNull().default(now),
})

/** The default workspace that owns all data until real auth assigns memberships. */
export const DEFAULT_ORG_ID = 1
