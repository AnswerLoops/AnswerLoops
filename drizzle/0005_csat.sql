CREATE TABLE IF NOT EXISTS "csat_messages" (
  "message_id" text PRIMARY KEY,
  "ticket_id" integer NOT NULL REFERENCES "tickets"("id"),
  "created_at" text NOT NULL DEFAULT NOW()::text
);

CREATE TABLE IF NOT EXISTS "csat_ratings" (
  "id" serial PRIMARY KEY,
  "ticket_id" integer NOT NULL REFERENCES "tickets"("id"),
  "org_id" integer NOT NULL REFERENCES "orgs"("id"),
  "rating" smallint NOT NULL,
  "platform" text NOT NULL,
  "created_at" text NOT NULL DEFAULT NOW()::text
);

CREATE INDEX IF NOT EXISTS "idx_csat_ratings_org" ON "csat_ratings"("org_id");
CREATE INDEX IF NOT EXISTS "idx_csat_ratings_ticket" ON "csat_ratings"("ticket_id");
