import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// The KB-sync queue: enqueue points insert into kb_sync_jobs and return; the
// bot sweep claims queued rows and drives each via POST /api/kb/sync-jobs/run.
// These are structural assertions on the load-bearing SQL — the behaviour that
// makes the queue safe (dedupe, single-claim, stuck-recovery) lives in raw SQL
// that a unit test can't exercise without a live Postgres.

const ROOT = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8')

describe('lib/db/queries/kb-sync-jobs.ts', () => {
  const src = read('lib/db/queries/kb-sync-jobs.ts')

  it('enqueue is a no-op when a job for the same source is already active', () => {
    // relies on the partial unique index kb_sync_jobs_one_active
    expect(src).toContain('INSERT INTO kb_sync_jobs')
    expect(src).toContain('ON CONFLICT DO NOTHING')
    // and falls back to returning the existing active job
    expect(src).toMatch(/status IN \('queued', 'running'\)/)
  })

  it('claim is atomic — one queued job, flipped to running, with SKIP LOCKED', () => {
    expect(src).toContain("status = 'running'")
    expect(src).toContain('attempts = attempts + 1')
    expect(src).toContain('FOR UPDATE SKIP LOCKED')
    expect(src).toMatch(/ORDER BY created_at\s+LIMIT 1/)
  })

  it('reclaim requeues a stuck job, or fails it once attempts are exhausted', () => {
    expect(src).toMatch(/WHEN attempts >= \$\{maxAttempts\} THEN 'failed' ELSE 'queued'/)
    expect(src).toContain("status = 'running' AND started_at <")
  })

  it('finish stamps a terminal status and finished_at', () => {
    expect(src).toMatch(/status = \$\{input\.status\}/)
    expect(src).toContain('finished_at = now()')
  })
})

describe('migration + schema', () => {
  it('0039 creates kb_sync_jobs with the one-active partial unique index', () => {
    const sql = read('drizzle/0039_kb_sync_jobs.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS kb_sync_jobs')
    expect(sql).toContain('kb_sync_jobs_one_active')
    expect(sql).toMatch(/WHERE status IN \('queued', 'running'\)/)
    expect(sql).toContain('COALESCE(repo_id, 0)')
  })

  it('the table is registered in the drizzle schema and in hardPurgeOrg', () => {
    expect(read('lib/db/schema.ts')).toContain("'kb_sync_jobs'")
    expect(read('lib/db/schema.ts')).toContain('export const kbSyncJobs')
    expect(read('lib/db/queries/orgs.ts')).toContain('tx.delete(kbSyncJobs)')
  })
})

describe('bot worker wiring', () => {
  const src = read('bot/index.ts')

  it('starts the KB sync sweep alongside the other sweeps', () => {
    expect(src).toContain('function startKbSyncSweep()')
    expect(src).toContain('startKbSyncSweep()')
    expect(src).toContain('claimNextKbSyncJob')
    expect(src).toContain('reclaimStuckKbSyncJobs')
  })

  it('forwards each claimed job to the BOT_SECRET-gated run route', () => {
    expect(src).toContain('/api/kb/sync-jobs/run')
    expect(src).toContain('Authorization: `Bearer ${botSecret}`')
    expect(src).toMatch(/if \(!botSecret\) return/)
  })
})
