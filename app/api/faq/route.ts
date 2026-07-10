import { getLatestFAQ } from '@/lib/db/queries/faq'

export async function GET() {
  const faq = await getLatestFAQ()
  return Response.json(faq ?? { content: null })
}
