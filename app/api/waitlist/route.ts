import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle'
import { waitlist } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const db = await getDb()

  const existing = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ ok: true, already: true })
  }

  await db.insert(waitlist).values({ email })
  return NextResponse.json({ ok: true })
}
