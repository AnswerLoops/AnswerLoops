import { auth } from '@/auth'
import { listWidgetLeads } from '@/lib/db/queries/widget-leads'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await auth()
  const orgId = session?.orgId ?? DEFAULT_ORG_ID
  const leads = await listWidgetLeads(orgId)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Widget Leads</h1>
          <p className="text-sm text-gray-400">{leads.length} email{leads.length !== 1 ? 's' : ''} collected from chat widget</p>
        </div>
        <a
          href="/api/export/leads"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </a>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 mb-3">
              <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No leads yet</p>
            <p className="text-xs text-gray-400 mt-1">Emails collected from your chat widget appear here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-800">{lead.email}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
