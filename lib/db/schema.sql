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

-- Semantic enrichment: one embedding vector per ticket (JSON float array).
CREATE TABLE IF NOT EXISTS ticket_embeddings (
  ticket_id  INTEGER PRIMARY KEY REFERENCES tickets(id),
  vector     TEXT NOT NULL,
  model      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nearest-neighbour links between tickets (cosine similarity), recomputed at ingest.
CREATE TABLE IF NOT EXISTS ticket_links (
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
  related_id INTEGER NOT NULL REFERENCES tickets(id),
  score      REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (ticket_id, related_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_ticket ON ticket_links(ticket_id);

-- Feedback loop: 👍/👎 on an AI answer, from Discord reactions or staff.
-- One vote per (ticket, source, actor) — re-voting updates the existing row.
CREATE TABLE IF NOT EXISTS ticket_feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
  source     TEXT NOT NULL,          -- 'discord' | 'staff'
  vote       TEXT NOT NULL,          -- 'up' | 'down'
  actor      TEXT NOT NULL,          -- discord user id or staff name
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ticket_id, source, actor)
);

CREATE INDEX IF NOT EXISTS idx_ticket_feedback_ticket ON ticket_feedback(ticket_id);

-- Maps the Discord message id of a posted AI answer back to its ticket, so a
-- reaction on that message can be attributed to the right ticket.
CREATE TABLE IF NOT EXISTS answer_messages (
  discord_message_id TEXT PRIMARY KEY,
  ticket_id          INTEGER NOT NULL REFERENCES tickets(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Confidence assessment of each AI answer, and whether it was auto-deflected.
CREATE TABLE IF NOT EXISTS ai_assessments (
  ticket_id      INTEGER PRIMARY KEY REFERENCES tickets(id),
  confidence     REAL NOT NULL,
  answered_fully INTEGER NOT NULL,
  auto_deflected INTEGER NOT NULL DEFAULT 0,
  reasoning      TEXT,
  model          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge base: resolved answers promoted into a durable, searchable asset.
-- Each article carries its own embedding (same model as tickets) so the KB can
-- be semantically searched and used to ground the agent.
CREATE TABLE IF NOT EXISTS kb_articles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  question         TEXT NOT NULL,
  answer           TEXT NOT NULL,
  embedding        TEXT NOT NULL,        -- JSON float array
  model            TEXT NOT NULL,
  source_ticket_id INTEGER REFERENCES tickets(id),
  published        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(published);
CREATE INDEX IF NOT EXISTS idx_kb_articles_source    ON kb_articles(source_ticket_id);

INSERT OR IGNORE INTO sla_configs (priority, response_hours, resolve_hours) VALUES
  ('critical', 1,   4),
  ('high',     4,   24),
  ('medium',   24,  72),
  ('low',      72,  168);
