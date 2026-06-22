import { getOrgByWidgetToken } from '@/lib/db/queries/widgets'
import { saveWidgetLead } from '@/lib/db/queries/widget-leads'

export async function POST(request: Request) {
  let body: { widgetToken?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { widgetToken, email } = body
  if (!widgetToken || typeof widgetToken !== 'string') {
    return new Response('Missing widgetToken', { status: 400 })
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return new Response('Invalid email', { status: 400 })
  }

  const org = await getOrgByWidgetToken(widgetToken)
  if (!org) return new Response('Invalid widget token', { status: 404 })

  await saveWidgetLead(org.id, widgetToken, email.toLowerCase().trim())
  return Response.json({ ok: true })
}
