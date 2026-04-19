'use client'

import { useState } from 'react'
import AuthGate from '@/components/AuthGate'
import { supabase } from '@/lib/supabase'

type Mode = 'conservative' | 'marketing'

const deal = {
  name: 'Vista River Gardens',
  postcode: 'M1 7ED',
  dlaStart: 111082,
  conservative: { eta: 31, repaid20y: 17588, breakEven: 6.0, cliff: 'watch' },
  marketing: { eta: 27, repaid20y: 23500, breakEven: 6.0, cliff: 'watch' },
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('conservative')
  const v = mode === 'conservative' ? deal.conservative : deal.marketing
  const pct = Math.min(100, (v.repaid20y / deal.dlaStart) * 100)

  return (
    <AuthGate>
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Property ROI</h1>
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

          <div className="bg-white rounded-2xl border border-gray-200 shadow p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{deal.name}</h2>
                <p className="text-xs text-gray-500">{deal.postcode}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 uppercase">{v.cliff}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[11px] text-gray-500">DLA ETA</p>
                <p className="font-bold">Year {v.eta}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[11px] text-gray-500">2030 Break-even</p>
                <p className="font-bold">{v.breakEven.toFixed(1)}%</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                <span>DLA Progress (20Y)</span>
                <span>£{v.repaid20y.toLocaleString()} / £{deal.dlaStart.toLocaleString()}</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setMode('conservative')} className={`py-2 rounded-md text-sm ${mode === 'conservative' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
                Conservative (3.0%)
              </button>
              <button onClick={() => setMode('marketing')} className={`py-2 rounded-md text-sm ${mode === 'marketing' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
                Marketing (3.5%)
              </button>
            </div>
          </div>
        </div>
      </main>
    </AuthGate>
  )
}
