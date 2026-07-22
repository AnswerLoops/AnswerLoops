function Dash() {
  return <span className="text-gray-300">—</span>
}

function Check() {
  return (
    <svg className="mx-auto h-4 w-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Cell = boolean | string

interface Row {
  feature: string
  hobby: Cell
  pro: Cell
  scale: Cell
  enterprise: Cell
}

const ROWS: Row[] = [
  { feature: 'AI deflections / month', hobby: '50', pro: '500', scale: '2,000', enterprise: 'Unlimited' },
  { feature: 'Discord, Slack, GitHub, Telegram, Email', hobby: true, pro: true, scale: true, enterprise: true },
  { feature: 'Website chat widget + lead capture', hobby: true, pro: true, scale: true, enterprise: true },
  { feature: 'Knowledge base (upload, URL, GitHub sync)', hobby: true, pro: true, scale: true, enterprise: true },
  { feature: 'Bring your own AI provider', hobby: true, pro: true, scale: true, enterprise: true },
  { feature: 'CSV export', hobby: false, pro: true, scale: true, enterprise: true },
  { feature: 'White-label widget (remove branding)', hobby: false, pro: true, scale: true, enterprise: true },
  { feature: 'CSAT scoring', hobby: false, pro: false, scale: true, enterprise: true },
  { feature: 'Human escalation routing', hobby: false, pro: false, scale: true, enterprise: true },
  { feature: 'Simulation / dry-run mode', hobby: false, pro: false, scale: true, enterprise: true },
  { feature: 'Knowledge gap dashboard', hobby: false, pro: false, scale: true, enterprise: true },
  { feature: 'Priority support', hobby: false, pro: false, scale: true, enterprise: true },
  { feature: 'Custom AI model configuration', hobby: false, pro: false, scale: false, enterprise: true },
  { feature: 'SLA + dedicated support', hobby: false, pro: false, scale: false, enterprise: true },
  { feature: 'Custom invoicing', hobby: false, pro: false, scale: false, enterprise: true },
]

function CellValue({ value }: { value: Cell }) {
  if (typeof value === 'string') return <span className="text-sm text-gray-700">{value}</span>
  return value ? <Check /> : <Dash />
}

export function PricingComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature</th>
            <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Hobby</th>
            <th className="px-5 py-3.5 text-center text-xs font-semibold text-brand-600 uppercase tracking-wide">Pro</th>
            <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Scale</th>
            <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Enterprise</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ROWS.map((row) => (
            <tr key={row.feature} className="bg-white">
              <td className="px-5 py-3 text-sm text-gray-700">{row.feature}</td>
              <td className="px-5 py-3 text-center"><CellValue value={row.hobby} /></td>
              <td className="px-5 py-3 text-center bg-brand-50/40"><CellValue value={row.pro} /></td>
              <td className="px-5 py-3 text-center"><CellValue value={row.scale} /></td>
              <td className="px-5 py-3 text-center"><CellValue value={row.enterprise} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
