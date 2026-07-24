function Dash() {
  return <span className="text-slate-300">—</span>
}

function Check() {
  return (
    <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
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
  if (typeof value === 'string') return <span className="text-xs font-semibold text-slate-800">{value}</span>
  return value ? <Check /> : <Dash />
}

export function PricingComparisonTable() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-[0_20px_65px_rgba(30,64,175,0.07)]">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90">
            <th className="w-[38%] px-6 py-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Feature</th>
            <th className="px-4 py-5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Hobby</th>
            <th className="border-x border-blue-100 bg-blue-50/70 px-4 py-5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-700">Pro</th>
            <th className="px-4 py-5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Scale</th>
            <th className="px-4 py-5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Enterprise</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ROWS.map((row, index) => (
            <tr key={row.feature} className={`transition-colors hover:bg-slate-50/80 ${index === 0 ? 'bg-slate-50/35' : 'bg-white'}`}>
              <td className="px-6 py-4 text-sm font-medium text-slate-700">{row.feature}</td>
              <td className="px-4 py-4 text-center"><CellValue value={row.hobby} /></td>
              <td className="border-x border-blue-100/80 bg-blue-50/35 px-4 py-4 text-center"><CellValue value={row.pro} /></td>
              <td className="px-4 py-4 text-center"><CellValue value={row.scale} /></td>
              <td className="px-4 py-4 text-center"><CellValue value={row.enterprise} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex flex-col items-start gap-1.5 border-t border-slate-100 bg-slate-50/60 px-4 py-4 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Scroll horizontally on smaller screens</span>
        <span className="font-semibold text-blue-700">All plans include BYO AI provider</span>
      </div>
    </div>
  )
}
