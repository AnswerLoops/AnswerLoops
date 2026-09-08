-- Least-privilege scopes for API keys (orank Usability / RFC 9728).
--
-- Every agent-facing surface (the REST Agent API at /api/agent/* and the MCP
-- server at /api/mcp) authenticates with a per-org Bearer key. Until now every
-- key carried implicit full access — there was no way to mint a read-only
-- credential for an agent that only needs to search the knowledge base. Each
-- operation now declares one required scope (lib/agent/scopes.ts) and the key
-- carries the set it was granted.
--
-- The column is a Postgres text[]. The DEFAULT and the backfill both use the
-- full set, so every existing key keeps working exactly as before and any key
-- created without an explicit choice is unchanged in behaviour. Scope names
-- are validated in application code (normalizeScopes) — unknown entries are
-- dropped rather than trusted — so no CHECK constraint is needed here.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL
  DEFAULT ARRAY['kb:read','faq:read','tickets:read','tickets:write','answers:write']::text[];
--> statement-breakpoint
-- Backfill is implicit for rows that existed before the ADD COLUMN (Postgres
-- applies the DEFAULT to them), but stated explicitly so a re-run against a
-- half-migrated DB — column present, some rows NULL — still converges.
UPDATE api_keys
  SET scopes = ARRAY['kb:read','faq:read','tickets:read','tickets:write','answers:write']::text[]
  WHERE scopes IS NULL OR cardinality(scopes) = 0;
