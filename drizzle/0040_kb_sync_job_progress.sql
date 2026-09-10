-- Per-job progress for KB syncs, so the Knowledge Base page can show
-- "Syncing 45 / 120" instead of an indefinite spinner. Both counters are
-- written by the run route as the sync embeds documents; they stay 0 until
-- the total is known (after the workspace/repo has been listed).

ALTER TABLE kb_sync_jobs ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE kb_sync_jobs ADD COLUMN IF NOT EXISTS total INTEGER NOT NULL DEFAULT 0;
