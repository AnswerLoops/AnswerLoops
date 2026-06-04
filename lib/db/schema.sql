CREATE TABLE IF NOT EXISTS sla_configs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  priority       TEXT NOT NULL UNIQUE,
  response_hours INTEGER NOT NULL,
  resolve_hours  INTEGER NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_message_id    TEXT UNIQUE,
  discord_channel_id    TEXT,
  discord_thread_id     TEXT,
  discord_author_id     TEXT,
  discord_author_name   TEXT,
  content               TEXT NOT NULL,
  category              TEXT,
  severity_score        REAL,
  ai_summary            TEXT,
  ai_suggested_priority TEXT,
  ai_draft              TEXT,
  ai_draft_status       TEXT NOT NULL DEFAULT 'pending',
  ai_draft_posted_at    TEXT,
  priority              TEXT NOT NULL DEFAULT 'medium',
  status                TEXT NOT NULL DEFAULT 'open',
  resolution_notes      TEXT,
  sla_response_deadline TEXT,
  sla_resolve_deadline  TEXT,
  sla_response_met      INTEGER,
  sla_resolve_met       INTEGER,
  first_response_at     TEXT,
  resolved_at           TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_ai_draft ON tickets(ai_draft_status);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id      INTEGER NOT NULL REFERENCES tickets(id),
  staff_name     TEXT NOT NULL,
  content        TEXT NOT NULL,
  discord_msg_id TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
  event_type TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  actor      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS github_repos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id INTEGER NOT NULL,
  owner           TEXT NOT NULL,
  repo            TEXT NOT NULL,
  is_private      INTEGER NOT NULL DEFAULT 0,
  added_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner, repo)
);

CREATE TABLE IF NOT EXISTS faq_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start   TEXT NOT NULL,
  week_end     TEXT NOT NULL,
  content      TEXT NOT NULL,
  ticket_count INTEGER NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER REFERENCES tickets(id),
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO sla_configs (priority, response_hours, resolve_hours) VALUES
  ('critical', 1,   4),
  ('high',     4,   24),
  ('medium',   24,  72),
  ('low',      72,  168);
