'use client'

import { useMemo, useState } from 'react'
import AuthGate from '@/components/AuthGate'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Mode = 'conservative' | 'marketing'

const deal = {
  name: 'Vista River Gardens',
  postcode: 'M1 7ED',
  dlaStart: 111082,
  conservative: { eta: 31, repaid20y: 17588, breakEven: 6.0 },
  marketing: { eta: 27, repaid20y: 23500, breakEven: 6.0 },
}

function getCliffHealthVariant(score: number) {
  if (score < 6) return { label: 'Red', variant: 'cliffRed' as const }
  if (score <= 7) return { label: 'Watch', variant: 'cliffAmber' as const }
  return { label: 'Healthy', variant: 'cliffGreen' as const }
}

function getDlaEtaVariant(eta: number) {
  if (!Number.isFinite(eta)) return { label: 'Never', variant: 'dlaRed' as const }
  if (eta <= 15) return { label: `Year ${eta}`, variant: 'dlaGreen' as const }
  if (eta <= 30) return { label: `Year ${eta}`, variant: 'dlaAmber' as const }
  return { label: `Year ${eta}`, variant: 'dlaRed' as const }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('conservative')
  const v = mode === 'conservative' ? deal.conservative : deal.marketing

  const metrics = useMemo(() => {
    const pct = Math.min(100, (v.repaid20y / deal.dlaStart) * 100)
    const cliff = getCliffHealthVariant(v.breakEven)
    const eta = getDlaEtaVariant(v.eta)
    return { pct, cliff, eta }
  }, [v])

  return (
    <AuthGate>
      <main className="min-h-screen bg-background p-3">
        <div className="mx-auto max-w-md space-y-3">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Property ROI</h1>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="rounded border border-border bg-panel px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Logout
            </button>
          </div>

          <Card className="shadow-none">
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{deal.name}</h2>
                <p className="text-[11px] text-muted-foreground">{deal.postcode}</p>
              </div>
              <Badge variant={metrics.cliff.variant}>{metrics.cliff.label}</Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="fin-panel p-2">
                  <p className="metric-label">DLA ETA</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="financial text-sm font-semibold">{metrics.eta.label}</p>
                    <Badge variant={metrics.eta.variant}>ETA</Badge>
                  </div>
                </div>
                <div className="fin-panel p-2">
                  <p className="metric-label">2030 Break-even</p>
                  <p className="financial text-sm font-semibold">{v.breakEven.toFixed(1)}%</p>
                </div>
              </div>

              <div>
                <div className="metric-label mb-1 flex justify-between">
                  <span>DLA Progress (20Y)</span>
                  <span className="financial">£{v.repaid20y.toLocaleString()} / £{deal.dlaStart.toLocaleString()}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${metrics.pct}%` }} />
                </div>
              </div>

              <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
                <TabsList>
                  <TabsTrigger value="conservative">Conservative (3.0%)</TabsTrigger>
                  <TabsTrigger value="marketing">Marketing (3.5%)</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </AuthGate>
  )
}
