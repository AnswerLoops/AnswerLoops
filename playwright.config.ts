import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// A dedicated, disposable SQLite file for the e2e run — never the real data/ db.
// Set on the runner process so globalSetup (same process) and the spawned
// webServer (via env below) agree on the same file.
const TEST_DB = path.join(__dirname, 'e2e', '.tmp', 'test.db')
process.env.DB_PATH = TEST_DB
process.env.MOCK_EXTERNALS = '1'
// globalSetup mints an Auth.js JWT with this secret; the server verifies with
// the same one. Must match AUTH_SECRET in TEST_ENV below.
process.env.AUTH_SECRET = 'test-auth-secret'

const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

// Authenticated browser/request state — globalSetup writes a signed Auth.js
// session cookie here so specs run as a logged-in staff member.
export const STORAGE_STATE = path.join(__dirname, 'e2e', '.tmp', 'state.json')

// Shared by the app under test and the e2e helpers.
export const TEST_ENV = {
  DB_PATH: TEST_DB,
  MOCK_EXTERNALS: '1',
  BOT_SECRET: 'test-bot-secret',
  AUTH_SECRET: 'test-auth-secret',
  AUTH_URL: BASE_URL,
  OPENAI_API_KEY: 'test-openai-key',
  VAPID_PUBLIC_KEY: 'BL_test_vapid_public_key',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BL_test_vapid_public_key',
  VAPID_PRIVATE_KEY: 'test_vapid_private_key',
  VAPID_SUBJECT: 'mailto:test@example.com',
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Serial: every spec shares one app + one SQLite file, so a single worker
  // keeps DB state predictable and avoids cross-spec interference.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec next build && pnpm exec next start -p 3100',
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: TEST_ENV,
  },
})
