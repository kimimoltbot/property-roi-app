'use client'

import { useMemo, useState } from 'react'
import AuthGate from '@/components/AuthGate'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SCENARIO, FINAL_FOUR_DEALS, GHOST_DEAL_ID } from '@/lib/roi/samples'
import { Horizon, Mode } from '@/lib/roi/types'
import { formatMoneyMonospace, formatPctMonospace, selectComparativeRows } from '@/lib/roi/selectors'

const HORIZONS: Horizon[] = [5, 10, 15, 20]

export default function Home() {
  const [mode, setMode] = useState<Mode>(DEFAULT_SCENARIO.mode)
  const [horizon, setHorizon] = useState<Horizon>(DEFAULT_SCENARIO.horizon)
  const [includeGhost, setIncludeGhost] = useState(false)

  const rows = useMemo(
    () =>
      selectComparativeRows({
        deals: FINAL_FOUR_DEALS,
        ghostDeal: includeGhost
          ? {
              id: GHOST_DEAL_ID,
              name: 'Ghost Deal',
              postcode: 'TBD',
              dlaStart: 100000,
              loanAmount: 280000,
              annualRent: 25200,
              annualCosts: 7200,
              initialRate: 0.035,
              annualCashflowConservative: 800,
              annualCashflowMarketing: 2100,
            }
          : undefined,
        scenario: { mode, horizon },
      }),
    [mode, horizon, includeGhost],
  )

  return (
    <AuthGate>
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Property ROI Comparative</h1>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="text-sm px-3 py-1.5 border rounded-lg bg-white"
            >
              Logout
            </button>
          </div>

          <div className="bg-white rounded-xl p-3 border flex flex-wrap gap-2 items-center">
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setMode('conservative')} className={`px-3 py-2 rounded text-sm ${mode === 'conservative' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
                Conservative
              </button>
              <button onClick={() => setMode('marketing')} className={`px-3 py-2 rounded text-sm ${mode === 'marketing' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
                Marketing
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg">
              {HORIZONS.map((h) => (
                <button key={h} onClick={() => setHorizon(h)} className={`px-2 py-2 rounded text-sm ${horizon === h ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
                  {h}Y
                </button>
              ))}
            </div>

            <button onClick={() => setIncludeGhost((s) => !s)} className="ml-auto px-3 py-2 text-sm border rounded-lg">
              {includeGhost ? 'Remove Ghost' : 'Add Ghost'}
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-2">Deal</th>
                  <th className="text-left p-2">DLA ETA</th>
                  <th className="text-left p-2">Repaid</th>
                  <th className="text-left p-2">Remaining</th>
                  <th className="text-left p-2">Break-even Y6</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Div/Salary</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.dealId} className="border-t">
                    <td className="p-2 font-medium">{FINAL_FOUR_DEALS.find((d) => d.id === row.dealId)?.name ?? 'Ghost Deal'}</td>
                    <td className="p-2 font-mono">{row.etaYear ? `Year ${row.etaYear}` : '>' + horizon}</td>
                    <td className="p-2 font-mono whitespace-pre">{formatMoneyMonospace(row.repaidByHorizon)}</td>
                    <td className="p-2 font-mono whitespace-pre">{formatMoneyMonospace(row.dlaRemaining)}</td>
                    <td className="p-2 font-mono whitespace-pre">{formatPctMonospace(row.breakEvenYear6Pct)}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-1 rounded-full uppercase ${row.refinanceAlert ? 'bg-red-100 text-red-700' : row.cliffBadge === 'safe' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row.refinanceAlert ? 'refi alert' : row.cliffBadge}
                      </span>
                    </td>
                    <td className="p-2 font-mono whitespace-pre">{formatMoneyMonospace(row.dividendOrSalaryByHorizon)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === 'conservative' && (
            <div className="bg-white rounded-xl p-3 border">
              <p className="text-sm font-semibold mb-2">2030 Cliff Stress (Year 6 rates: 4/6/8)</p>
              <div className="grid md:grid-cols-4 gap-2">
                {rows.map((row) => (
                  <div key={`${row.dealId}-stress`} className="border rounded-lg p-2">
                    <p className="font-medium mb-1">{FINAL_FOUR_DEALS.find((d) => d.id === row.dealId)?.name ?? 'Ghost Deal'}</p>
                    {row.stress2030?.map((s) => (
                      <p key={s.rate} className="font-mono text-xs whitespace-pre">
                        {(s.rate * 100).toFixed(0)}%: {formatMoneyMonospace(s.freeCashYear6)}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </AuthGate>
  )
}
