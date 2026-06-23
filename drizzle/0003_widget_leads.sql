CREATE TABLE IF NOT EXISTS "widget_leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL REFERENCES "orgs"("id"),
  "widget_token" text NOT NULL,
  "email" text NOT NULL,
  "created_at" text NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_widget_leads_org" ON "widget_leads" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_widget_leads_email" ON "widget_leads" ("email");
