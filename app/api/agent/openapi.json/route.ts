import { buildAgentOpenApiSpec } from '@/lib/agent/openapi-spec'

/**
 * GET /api/agent/openapi.json
 *
 * Real OpenAPI 3.0 spec for the Agent API — the spec object itself lives in
 * lib/agent/openapi-spec.ts and is also served at /openapi.json (the root
 * location agent scanners probe). public/.well-known/ai-plugin.json's
 * api.url points here. scripts/generate-api-reference imports this handler.
 */
export async function GET() {
  return Response.json(buildAgentOpenApiSpec())
}
