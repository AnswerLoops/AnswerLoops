import { defineConfig, devices } from '@playwright/test'
import path from 'path'

process.env.MOCK_EXTERNALS = '1'
process.env.AUTH_SECRET = 'test-auth-secret'
process.env.BOT_SECRET = 'test-bot-secret'

const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

export const STORAGE_STATE = path.join(__dirname, 'e2e', '.tmp', 'state.json')

export const TEST_ENV = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgres://community:community@localhost:5432/community_test',
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

// Make DATABASE_URL available to globalSetup (same process as config)
process.env.DATABASE_URL = TEST_ENV.DATABASE_URL

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
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
    command: 'node_modules/.bin/next build && node_modules/.bin/next start -p 3100',
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: TEST_ENV,
  },
})
