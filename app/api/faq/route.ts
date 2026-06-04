import { getLatestFAQ } from '@/lib/db/queries/faq'

export async function GET() {
  const faq = getLatestFAQ()
  return Response.json(faq ?? { content: null })
}
