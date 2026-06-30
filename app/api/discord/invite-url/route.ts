import { NextResponse } from 'next/server'

// Permissions: View Channel + Send Messages + Read Message History + Add Reactions + Embed Links
const PERMISSIONS = '85056'

export function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'DISCORD_CLIENT_ID not configured' }, { status: 503 })
  }
  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=${PERMISSIONS}`
  return NextResponse.json({ url })
}
