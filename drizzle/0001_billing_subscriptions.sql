CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL UNIQUE REFERENCES "orgs"("id"),
  "plan_id" text NOT NULL DEFAULT 'hobby',
  "status" text NOT NULL DEFAULT 'active',
  "stripe_customer_id" text,
  "stripe_subscription_id" text UNIQUE,
  "stripe_price_id" text,
  "current_period_start" text,
  "current_period_end" text,
  "cancel_at_period_end" integer NOT NULL DEFAULT 0,
  "created_at" text NOT NULL DEFAULT now(),
  "updated_at" text NOT NULL DEFAULT now()
);
