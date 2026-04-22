'use client'

import { FormEvent, useMemo, useState } from 'react'
import AuthGate from '@/components/AuthGate'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { runComparativeEngine } from '@/lib/roi/engine'
import { formatMoneyMonospace, formatPctMonospace } from '@/lib/roi/selectors'
import type { DealInput } from '@/lib/roi/types'

type IntelResponse = {
  normalizedPostcode?: string
  licensing?: { y1?: number; y6?: number; y11?: number }
}

type MiniOutput = {
  breakEvenMortgageRatePct: number
  fiveYearDlaContribution: number
  cliffGauge: 'safe' | 'watch' | 'alert'
}

function toCurrency(value: string) {
  return Number(value.replace(/,/g, ''))
}

function cliffBadge(gauge: MiniOutput['cliffGauge']) {
  if (gauge === 'safe') return { label: '2030 Cliff: Safe', variant: 'cliffGreen' as const }
  if (gauge === 'watch') return { label: '2030 Cliff: Watch', variant: 'cliffAmber' as const }
  return { label: '2030 Cliff: Alert', variant: 'cliffRed' as const }
}

function normalisePostcode(postcode: string) {
  return postcode.trim().toUpperCase().replace(/\s+/g, ' ')
}

function miniDealCard(output: MiniOutput | null) {
  if (!output) return null
  const cliff = cliffBadge(output.cliffGauge)

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mini Deal Card (5Y)</h2>
          <p className="text-[11px] text-muted-foreground">Quick Size-Up output</p>
        </div>
        <Badge variant={cliff.variant}>{cliff.label}</Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="fin-panel p-2">
          <p className="metric-label">Break-even Mortgage Rate</p>
          <p className="financial mt-1 text-sm font-semibold">{formatPctMonospace(output.breakEvenMortgageRatePct)}</p>
        </div>
        <div className="fin-panel p-2">
          <p className="metric-label">5Y DLA Contribution</p>
          <p className="financial mt-1 text-sm font-semibold">{formatMoneyMonospace(output.fiveYearDlaContribution)}</p>
        </div>
        <div className="fin-panel p-2">
          <p className="metric-label">2030 Cliff Gauge</p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                output.cliffGauge === 'safe'
                  ? 'bg-cliff-green'
                  : output.cliffGauge === 'watch'
                    ? 'bg-cliff-amber'
                    : 'bg-cliff-red'
              }`}
            />
            <p className="financial text-sm font-semibold">{cliff.label.replace('2030 Cliff: ', '')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [postcode, setPostcode] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedDealId, setSavedDealId] = useState<string | null>(null)
  const [miniOutput, setMiniOutput] = useState<MiniOutput | null>(null)

  const canSubmit = useMemo(() => {
    return postcode.trim().length > 0 && toCurrency(purchasePrice) > 0 && toCurrency(monthlyRent) > 0
  }, [postcode, purchasePrice, monthlyRent])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        throw new Error('You must be signed in to save a draft deal.')
      }

      const user = authData.user
      const cleanPostcode = normalisePostcode(postcode)
      const purchasePriceValue = toCurrency(purchasePrice)
      const monthlyRentValue = toCurrency(monthlyRent)

      const intelResponse = await fetch(`/api/intel?postcode=${encodeURIComponent(cleanPostcode)}`)
      if (!intelResponse.ok) throw new Error('Unable to fetch postcode intelligence.')
      const intel = (await intelResponse.json()) as IntelResponse

      const assumptionsSnapshot = {
        postcode: intel.normalizedPostcode ?? cleanPostcode,
        purchasePrice: purchasePriceValue,
        expectedMonthlyRent: monthlyRentValue,
        licensingProvision: {
          y1: intel.licensing?.y1 ?? 1200,
          y6: intel.licensing?.y6 ?? 1200,
          y11: intel.licensing?.y11 ?? 1500,
        },
        capturedAt: new Date().toISOString(),
      }

      const dealInput: DealInput = {
        id: 'quick-size-up-draft',
        name: `Quick Size-Up ${intel.normalizedPostcode ?? cleanPostcode}`,
        postcode: intel.normalizedPostcode ?? cleanPostcode,
        dlaStart: purchasePriceValue * 0.32,
        loanAmount: purchasePriceValue * 0.75,
        annualRent: monthlyRentValue * 12,
        annualCosts: monthlyRentValue * 12 * 0.25,
        initialRate: 0.05,
        annualCashflowConservative: monthlyRentValue * 12 * 0.05,
        annualCashflowMarketing: monthlyRentValue * 12 * 0.08,
      }

      const fiveYear = runComparativeEngine(dealInput, 5, 'conservative')
      const mini: MiniOutput = {
        breakEvenMortgageRatePct: fiveYear.breakEvenYear6Pct,
        fiveYearDlaContribution: fiveYear.repaidByHorizon,
        cliffGauge: fiveYear.cliffBadge,
      }

      const { data: existingDraft, error: draftLookupError } = await supabase
        .from('deals')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .eq('postcode', intel.normalizedPostcode ?? cleanPostcode)
        .maybeSingle()

      if (draftLookupError) {
        throw new Error(`Unable to check existing draft: ${draftLookupError.message}`)
      }

      const draftPayload = {
        user_id: user.id,
        status: 'draft',
        postcode: intel.normalizedPostcode ?? cleanPostcode,
        purchase_price: purchasePriceValue,
        expected_monthly_rent: monthlyRentValue,
        intel_snapshot: intel,
        mini_output: mini,
        updated_at: new Date().toISOString(),
      }

      let dealId = existingDraft?.id as string | undefined

      if (dealId) {
        const { error: updateError } = await supabase.from('deals').update(draftPayload).eq('id', dealId).eq('user_id', user.id)
        if (updateError) throw new Error(`Unable to update draft deal: ${updateError.message}`)
      } else {
        const { data: insertedDeal, error: insertError } = await supabase
          .from('deals')
          .insert(draftPayload)
          .select('id')
          .single()
        if (insertError) throw new Error(`Unable to create draft deal: ${insertError.message}`)
        dealId = insertedDeal.id as string
      }

      const { error: assumptionsError } = await supabase.from('assumptions').upsert(
        {
          user_id: user.id,
          deal_id: dealId,
          snapshot: assumptionsSnapshot,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'deal_id' },
      )

      if (assumptionsError) throw new Error(`Unable to persist assumptions snapshot: ${assumptionsError.message}`)

      setSavedDealId(dealId ?? null)
      setMiniOutput(mini)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to run Quick Size-Up.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGate>
      <main className="min-h-screen bg-background p-3">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Dashboard · Quick Size-Up</h1>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="rounded border border-border bg-panel px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>

          <Card className="shadow-none">
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Quick Size-Up</h2>
                <p className="text-[11px] text-muted-foreground">Create or update a draft with postcode intelligence and 5Y mini output.</p>
              </div>
              {savedDealId ? <Badge variant="neutral">Draft saved</Badge> : null}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Postcode</span>
                  <input
                    required
                    value={postcode}
                    onChange={(event) => setPostcode(event.target.value)}
                    placeholder="e.g. SW1A 1AA"
                    className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1"
                  />
                </label>

                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Purchase Price (£)</span>
                  <input
                    required
                    inputMode="decimal"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    placeholder="e.g. 225000"
                    className="financial w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1"
                  />
                </label>

                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Expected Monthly Rent (£)</span>
                  <input
                    required
                    inputMode="decimal"
                    value={monthlyRent}
                    onChange={(event) => setMonthlyRent(event.target.value)}
                    placeholder="e.g. 1450"
                    className="financial w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1"
                  />
                </label>

                <div className="md:col-span-3 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className="rounded border border-accent bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:brightness-110 disabled:opacity-60"
                  >
                    {submitting ? 'Running size-up…' : 'Run Quick Size-Up'}
                  </button>
                  {savedDealId ? <p className="financial text-xs text-muted-foreground">Draft ID: {savedDealId}</p> : null}
                </div>

                {error ? <p className="md:col-span-3 text-xs text-dla-red">{error}</p> : null}
              </form>
            </CardContent>
          </Card>

          {miniDealCard(miniOutput)}
        </div>
      </main>
    </AuthGate>
  )
}
