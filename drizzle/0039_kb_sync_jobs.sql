-- Background queue for knowledge-base syncs.
--
-- Notion and GitHub KB syncs used to run inline inside the HTTP request that
-- triggered them (the "Sync now" button, and GitHub's push webhook). A medium
-- workspace or repo blew the request/proxy timeout; GitHub's ~10s webhook
-- deadline was missed, so GitHub retried the delivery and two full
-- delete-and-recreate syncs raced on the same kb_sources row.
--
-- Now those entry points enqueue a row here and return immediately. The bot
-- process sweeps for queued rows and drives each one by calling
-- POST /api/kb/sync-jobs/run (authenticated with BOT_SECRET), the same
-- sweep + internal-route pattern the stuck-ticket safety net already uses.

CREATE TABLE IF NOT EXISTS kb_sync_jobs (
  id            SERIAL PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES orgs(id),
  kind          TEXT NOT NULL,                 -- 'notion' | 'github_repo'
  repo_id       INTEGER,                       -- github_repos.id when kind = 'github_repo'
  status        TEXT NOT NULL DEFAULT 'queued', -- queued | running | succeeded | failed
  detail        TEXT,                          -- final summary or error message
  synced_count  INTEGER NOT NULL DEFAULT 0,
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT now(),
  started_at    TEXT,
  finished_at   TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_kb_sync_jobs_status ON kb_sync_jobs (status, created_at);
--> statement-breakpoint
-- Debounce: at most one queued-or-running job per source. A second enqueue for
-- the same source while one is still active is a no-op (INSERT ... ON CONFLICT
-- DO NOTHING). COALESCE(repo_id, 0) so the Notion rows (repo_id IS NULL) also
-- collapse to a single active job.
CREATE UNIQUE INDEX IF NOT EXISTS kb_sync_jobs_one_active
  ON kb_sync_jobs (kind, COALESCE(repo_id, 0))
  WHERE status IN ('queued', 'running');
