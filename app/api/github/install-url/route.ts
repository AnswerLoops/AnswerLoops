import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export async function GET(req: NextRequest) {
  const rawSlug = process.env.GITHUB_APP_SLUG
  if (!rawSlug) {
    return NextResponse.json({ error: 'GITHUB_APP_SLUG not configured' }, { status: 503 })
  }

  // Accept full URL or bare slug — extract the slug portion either way
  // e.g. "https://github.com/settings/apps/answerloops" → "answerloops"
  const slug = rawSlug.replace(/^https?:\/\/[^/]+(?:\/[^/]+)*\//, '').replace(/\/.*$/, '').trim()
  if (!slug) {
    return NextResponse.json({ error: 'GITHUB_APP_SLUG is not a valid slug or URL' }, { status: 503 })
  }

  const session = await auth()
  const orgId = (session as { orgId?: number })?.orgId ?? DEFAULT_ORG_ID

  const state = Buffer.from(
    JSON.stringify({ orgId, ts: Date.now() })
  ).toString('base64url')

  const url = `https://github.com/apps/${slug}/installations/new?state=${state}`
  return NextResponse.json({ url })
}
