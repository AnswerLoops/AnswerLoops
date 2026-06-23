import { notFound } from 'next/navigation'
import { getOrgByWidgetToken } from '@/lib/db/queries/widgets'
import { WidgetChat } from './widget-chat'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ widgetToken: string }>
}

export default async function WidgetPage({ params }: Props) {
  const { widgetToken } = await params
  const org = await getOrgByWidgetToken(widgetToken)
  if (!org) notFound()

  const showBranding = org.plan_id === 'hobby'

  return (
    <WidgetChat
      widgetToken={widgetToken}
      orgName={org.name}
      showBranding={showBranding}
    />
  )
}
