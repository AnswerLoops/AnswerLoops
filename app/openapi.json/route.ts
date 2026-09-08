import { buildAgentOpenApiSpec } from '@/lib/agent/openapi-spec'

/**
 * GET /openapi.json
 *
 * The conventional root location an agent looks for an OpenAPI description.
 * Identical to /api/agent/openapi.json — both render lib/agent/openapi-spec.ts.
 * Kept as its own route (rather than a rewrite) so the response is a plain
 * 200 JSON body with no redirect hop for a scanner to follow.
 */
export async function GET() {
  return Response.json(buildAgentOpenApiSpec())
}
