ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "escalation_role_id" text;
ALTER TABLE "integrations" ADD COLUMN IF NOT EXISTS "confidence_threshold" double precision DEFAULT 0.8;
