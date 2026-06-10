import fs from 'fs'
import path from 'path'
import { getDb } from '../lib/db/index'
import { DEFAULT_ORG_ID } from '../lib/db/schema'

// Auth.js uses this cookie name in non-secure (http) environments.
const SESSION_COOKIE = 'authjs.session-token'
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

/**
 * Reset the disposable e2e database to a known baseline before the suite runs.
 * Runs in the Playwright runner process, which already has DB_PATH/MOCK_EXTERNALS
 * set by playwright.config.ts.
 */
export default async function globalSetup() {
  const dbPath = process.env.DB_PATH!
  const dir = path.dirname(dbPath)

  // Start from a clean slate (drop any WAL/SHM siblings too).
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  // The db layer creates the file and applies schema.sql on first getDb().
  const db = getDb()

  // Seed one configured GitHub repo so the AI agent runs during ingest.
  db.prepare(
    `INSERT OR IGNORE INTO github_repos (installation_id, owner, repo, is_private, org_id)
     VALUES (?, ?, ?, 0, ?)`
  ).run(1, 'acme', 'demo', DEFAULT_ORG_ID)

  // Seed a test staff user + membership so the Auth.js session has a real userId.
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name, provider)
     VALUES (1, 'staff@example.com', 'Test Staff', 'test')`
  ).run()
  db.prepare(
    `INSERT OR IGNORE INTO memberships (user_id, org_id, role)
     VALUES (1, ?, 'owner')`
  ).run(DEFAULT_ORG_ID)

  db.close()

  // Mint a valid Auth.js JWT so every spec runs authenticated. The secret must
  // match AUTH_SECRET in TEST_ENV (both set to 'test-auth-secret').
  const authSecret = process.env.AUTH_SECRET!
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS

  // Dynamic import required — next-auth/jwt is ESM-only.
  const { encode } = await import('next-auth/jwt')
  const token = await encode({
    token: {
      sub: '1',
      name: 'Test Staff',
      email: 'staff@example.com',
      userId: '1',
      orgId: DEFAULT_ORG_ID,
      iat: Math.floor(Date.now() / 1000),
      exp,
    },
    secret: authSecret,
    salt: SESSION_COOKIE,
    maxAge: MAX_AGE_SECONDS,
  })

  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: token,
          domain: 'localhost',
          path: '/',
          expires: exp,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    })
  )
}
