import fs from 'fs'
import path from 'path'
import { getDb } from '../lib/db/index'
import { signSession, SESSION_COOKIE, MAX_AGE_SECONDS } from '../lib/auth/token'

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

  // Seed one configured GitHub repo so the AI agent runs during ingest
  // (it no-ops when no repos are configured). The repo is never actually
  // queried — the agent is mocked.
  db.prepare(
    `INSERT OR IGNORE INTO github_repos (installation_id, owner, repo, is_private)
     VALUES (?, ?, ?, 0)`
  ).run(1, 'acme', 'demo')

  db.close()

  // Write a signed staff session into Playwright storage state so every spec
  // runs authenticated against the proxy gate (the app gates all non-bot routes).
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  fs.writeFileSync(
    path.join(dir, 'state.json'), // matches STORAGE_STATE in playwright.config.ts
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: signSession(exp),
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
