'use client'

import { FormEvent, useMemo, useState } from 'react'
import AuthGate from '@/components/AuthGate'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

type RunStatus = {
  intelFetched: boolean
  draftSaved: boolean
  roiComputed: boolean
  lastRunAt: string | null
}

type AdvancedInputs = {
  reservationFee: string
  solicitorFee: string
  legalDisbursements: string
  brokerFees: string
  stampDuty: string
  furniturePack: string
  monthlyMortgage: string
  monthlyEstateServiceCharges: string
  monthlyGroundRent: string
  monthlyManagement: string
}

const DEFAULT_ADVANCED: AdvancedInputs = {
  reservationFee: '5,000',
  solicitorFee: '1,500',
  legalDisbursements: '400',
  brokerFees: '995',
  stampDuty: '0',
  furniturePack: '0',
  monthlyMortgage: '0',
  monthlyEstateServiceCharges: '0',
  monthlyGroundRent: '0',
  monthlyManagement: '0',
}

const EMPTY_RUN_STATUS: RunStatus = {
  intelFetched: false,
  draftSaved: false,
  roiComputed: false,
  lastRunAt: null,
}

const UK_POSTCODE_PATTERN = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/

function parseCurrency(value: string) {
  const sanitised = (value ?? '').replace(/£|,/g, '').trim()
  if (!sanitised) return 0
  const parsed = Number(sanitised)
  return Number.isFinite(parsed) ? parsed : NaN
}

function formatCurrencyInput(value: string) {
  const parsed = parseCurrency(value)
  if (!Number.isFinite(parsed)) return value
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed)
}

function moneyInputClass(isInvalid = false) {
  return `financial w-full rounded border ${isInvalid ? 'border-dla-red/80' : 'border-border'} bg-muted px-2 py-1.5 text-xs text-foreground outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1`
}

function cliffBadge(gauge: MiniOutput['cliffGauge']) {
  if (gauge === 'safe') return { label: '2030 Cliff: Safe', variant: 'cliffGreen' as const }
  if (gauge === 'watch') return { label: '2030 Cliff: Watch', variant: 'cliffAmber' as const }
  return { label: '2030 Cliff: Alert', variant: 'cliffRed' as const }
}

function normalisePostcode(postcode: string) {
  const compact = postcode.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!compact) return ''

  const match = compact.match(UK_POSTCODE_PATTERN)
  if (!match) {
    if (compact.length > 3) return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`
    return compact
  }

  return `${match[1]} ${match[2]}`
}

function isValidUkPostcode(postcode: string) {
  return UK_POSTCODE_PATTERN.test(postcode.replace(/\s+/g, ''))
}

function dealCodeFromPostcode(postcode: string) {
  return `DRAFT-${postcode.replace(/\s+/g, '-')}`
}

function statusPill(done: boolean, label: string) {
  return (
    <span className={`rounded border px-2 py-1 text-[10px] ${done ? 'border-emerald-700/70 bg-emerald-900/30 text-emerald-300' : 'border-border bg-panel text-muted-foreground'}`}>
      {done ? '✓' : '•'} {label}
    </span>
  )
}

export default function DashboardPage() {
  const [postcode, setPostcode] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [source, setSource] = useState('Manual entry')
  const [listingUrl, setListingUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [advanced, setAdvanced] = useState<AdvancedInputs>(DEFAULT_ADVANCED)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedDealId, setSavedDealId] = useState<string | null>(null)
  const [miniOutput, setMiniOutput] = useState<MiniOutput | null>(null)
  const [runStatus, setRunStatus] = useState<RunStatus>(EMPTY_RUN_STATUS)

  const cleanPostcode = normalisePostcode(postcode)
  const purchasePriceValue = parseCurrency(purchasePrice)
  const monthlyRentValue = parseCurrency(monthlyRent)
  const postcodeInvalid = postcode.trim().length > 0 && !isValidUkPostcode(cleanPostcode)
  const purchasePriceInvalid = purchasePrice.trim().length > 0 && (!Number.isFinite(purchasePriceValue) || purchasePriceValue <= 0)
  const monthlyRentInvalid = monthlyRent.trim().length > 0 && (!Number.isFinite(monthlyRentValue) || monthlyRentValue <= 0)

  const finance = useMemo(() => {
    const reservationFee = parseCurrency(advanced.reservationFee)
    const solicitorFee = parseCurrency(advanced.solicitorFee)
    const legalDisbursements = parseCurrency(advanced.legalDisbursements)
    const brokerFees = parseCurrency(advanced.brokerFees)
    const stampDuty = parseCurrency(advanced.stampDuty)
    const furniturePack = parseCurrency(advanced.furniturePack)

    const mortgageAmount = purchasePriceValue * 0.75
    const exchangeDepositGross = purchasePriceValue * 0.1
    const exchangeDepositNet = Math.max(0, exchangeDepositGross - reservationFee)
    const exchangeCombinedTotal = exchangeDepositNet + solicitorFee + legalDisbursements

    const completionDepositRemaining = purchasePriceValue * 0.15
    const completionTotal = completionDepositRemaining + brokerFees + stampDuty + furniturePack
    const totalRequiredToComplete = exchangeCombinedTotal + completionTotal

    const mortgage = parseCurrency(advanced.monthlyMortgage)
    const estateServiceCharges = parseCurrency(advanced.monthlyEstateServiceCharges)
    const groundRent = parseCurrency(advanced.monthlyGroundRent)
    const management = parseCurrency(advanced.monthlyManagement)
    const estimatedRent = monthlyRentValue

    const totalMonthly = mortgage + estateServiceCharges + groundRent + management
    const totalYearly = totalMonthly * 12
    const cashSaving = estimatedRent - totalMonthly

    return {
      reservationFee,
      solicitorFee,
      legalDisbursements,
      brokerFees,
      stampDuty,
      furniturePack,
      mortgageAmount,
      exchangeDepositGross,
      exchangeDepositNet,
      exchangeCombinedTotal,
      completionDepositRemaining,
      completionTotal,
      totalRequiredToComplete,
      mortgage,
      estateServiceCharges,
      groundRent,
      management,
      estimatedRent,
      totalMonthly,
      totalYearly,
      cashSaving,
    }
  }, [advanced, purchasePriceValue, monthlyRentValue])

  const canSubmit = useMemo(() => {
    return !postcodeInvalid && !purchasePriceInvalid && !monthlyRentInvalid && cleanPostcode.length > 0
  }, [postcodeInvalid, purchasePriceInvalid, monthlyRentInvalid, cleanPostcode])

  const matrixRows = useMemo(() => {
    if (!canSubmit) return []

    const baseDeal: DealInput = {
      id: 'quick-size-up-draft',
      name: 'Quick Size-Up',
      postcode: cleanPostcode,
      dlaStart: 111082,
      loanAmount: purchasePriceValue * 0.75,
      annualRent: monthlyRentValue * 12,
      annualCosts: finance.totalYearly,
      initialRate: 0.061,
      annualCashflowConservative: monthlyRentValue * 12 * 0.05,
      annualCashflowMarketing: monthlyRentValue * 12 * 0.08,
    }

    return [
      { label: 'Conservative · 5Y', result: runComparativeEngine(baseDeal, 5, 'conservative') },
      { label: 'Conservative · 20Y', result: runComparativeEngine(baseDeal, 20, 'conservative') },
      { label: 'Marketing · 20Y', result: runComparativeEngine(baseDeal, 20, 'marketing') },
    ]
  }, [canSubmit, cleanPostcode, purchasePriceValue, monthlyRentValue, finance.totalYearly])

  const advancedSummary = useMemo(() => {
    const entries = ([
      ['Reservation', finance.reservationFee],
      ['Solicitor', finance.solicitorFee],
      ['Broker', finance.brokerFees],
      ['Stamp duty', finance.stampDuty],
      ['Mortgage pcm', finance.mortgage],
      ['Management pcm', finance.management],
      ['Ground rent pcm', finance.groundRent],
      ['Estate charges pcm', finance.estateServiceCharges],
    ] as Array<[string, number]>).filter(([, value]) => value > 0)

    if (entries.length === 0) return 'Advanced · Using baseline assumptions'

    const shown = entries.slice(0, 3).map(([label, value]) => `${label} ${formatMoneyMonospace(value)}`)
    const remainder = entries.length > 3 ? ` +${entries.length - 3} more` : ''

    return `Advanced · ${shown.join(' · ')}${remainder}`
  }, [finance])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    setRunStatus({ ...EMPTY_RUN_STATUS, lastRunAt: new Date().toISOString() })

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        throw new Error('You must be signed in to save a draft deal.')
      }
      const user = authData.user

      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (membershipError) {
        throw new Error(`Unable to load workspace membership: ${membershipError.message}`)
      }

      const workspaceId = memberships?.[0]?.workspace_id as string | undefined
      if (!workspaceId) {
        throw new Error('Workspace membership not found for this user. Please run workspace backfill SQL and sign in again.')
      }

      const intelResponse = await fetch(`/api/intel?postcode=${encodeURIComponent(cleanPostcode)}`)
      if (!intelResponse.ok) throw new Error('Unable to fetch postcode intelligence.')
      const intel = (await intelResponse.json()) as IntelResponse
      setRunStatus((v) => ({ ...v, intelFetched: true }))

      const assumptionsSnapshot = {
        postcode: intel.normalizedPostcode ?? cleanPostcode,
        purchasePrice: purchasePriceValue,
        expectedMonthlyRent: monthlyRentValue,
        source,
        listingUrl,
        notes,
        skepticismBufferPct: 10,
        licensingProvision: {
          y1: intel.licensing?.y1 ?? 750,
          y6: intel.licensing?.y6 ?? 750,
          y11: intel.licensing?.y11 ?? 750,
        },
        advancedCashflow: {
          ...advanced,
          onExchange: {
            depositGross10Pct: finance.exchangeDepositGross,
            reservationFee: finance.reservationFee,
            depositNet: finance.exchangeDepositNet,
            solicitor: finance.solicitorFee,
            legalDisbursements: finance.legalDisbursements,
            combinedTotal: finance.exchangeCombinedTotal,
          },
          onCompletion: {
            mortgageAmount75PctLtv: finance.mortgageAmount,
            depositRemaining15Pct: finance.completionDepositRemaining,
            brokerFees: finance.brokerFees,
            stampDuty: finance.stampDuty,
            furniturePack: finance.furniturePack,
            completionTotal: finance.completionTotal,
          },
          totalRequiredToComplete: finance.totalRequiredToComplete,
          monthlyBreakdown: {
            mortgage: finance.mortgage,
            estateServiceCharges: finance.estateServiceCharges,
            groundRent: finance.groundRent,
            management: finance.management,
            estimatedRent: finance.estimatedRent,
            totalMonthly: finance.totalMonthly,
            totalYearly: finance.totalYearly,
            cashSaving: finance.cashSaving,
          },
        },
        capturedAt: new Date().toISOString(),
      }

      const finalPostcode = normalisePostcode(intel.normalizedPostcode ?? cleanPostcode)
      const dealCode = dealCodeFromPostcode(finalPostcode)

      const dealPayload = {
        deal_code: dealCode,
        name: `Quick Size-Up ${finalPostcode}`,
        market: 'Quick Size-Up',
        asset_type: 'draft',
        status: 'draft',
        acquisition_price: purchasePriceValue,
        expected_rent_pa: monthlyRentValue * 12,
        capex_budget: finance.furniturePack,
        holding_period_years: 20,
        workspace_id: workspaceId,
        created_by: user.id,
        updated_by: user.id,
        metadata: {
          postcode: finalPostcode,
          expected_monthly_rent: monthlyRentValue,
          source,
          listing_url: listingUrl,
          notes,
          intel_snapshot: intel,
          cashflow_snapshot: assumptionsSnapshot.advancedCashflow,
        },
      }

      const { data: upsertedDeal, error: dealError } = await supabase
        .from('deals')
        .upsert(dealPayload, { onConflict: 'deal_code' })
        .select('id')
        .single()

      if (dealError) throw new Error(`Unable to save draft deal: ${dealError.message}`)
      setRunStatus((v) => ({ ...v, draftSaved: true }))

      const dealInput: DealInput = {
        id: 'quick-size-up-draft',
        name: `Quick Size-Up ${finalPostcode}`,
        postcode: finalPostcode,
        dlaStart: 111082,
        loanAmount: purchasePriceValue * 0.75,
        annualRent: monthlyRentValue * 12,
        annualCosts: finance.totalYearly,
        initialRate: 0.061,
        annualCashflowConservative: monthlyRentValue * 12 * 0.05,
        annualCashflowMarketing: monthlyRentValue * 12 * 0.08,
      }

      const fiveYear = runComparativeEngine(dealInput, 5, 'conservative')
      const mini: MiniOutput = {
        breakEvenMortgageRatePct: fiveYear.breakEvenYear6Pct,
        fiveYearDlaContribution: fiveYear.repaidByHorizon,
        cliffGauge: fiveYear.cliffBadge,
      }

      const { error: assumptionsError } = await supabase
        .from('assumptions')
        .upsert(
          {
            deal_id: upsertedDeal.id,
            scenario_label: 'quick-size-up',
            discount_rate: 0.1,
            rent_growth_rate: 0.03,
            expense_growth_rate: 0.02,
            exit_cap_rate: 0.055,
            vacancy_rate: 0.05,
            management_fee_rate: 0.12,
            tax_rate: 0.19,
            inflation_rate: 0.02,
            financing_ltv: 0.75,
            financing_interest_rate: 0.061,
            notes: JSON.stringify({ ...assumptionsSnapshot, miniOutput: mini }),
          },
          { onConflict: 'deal_id,scenario_label' },
        )

      if (assumptionsError) throw new Error(`Unable to persist assumptions snapshot: ${assumptionsError.message}`)

      setSavedDealId(upsertedDeal.id)
      setMiniOutput(mini)
      setRunStatus((v) => ({ ...v, roiComputed: true }))
      setPostcode(finalPostcode)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to run Quick Size-Up.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGate>
      <main className="min-h-screen bg-background p-2 lg:p-3">
        <div className="mx-auto max-w-[1500px] space-y-2">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-base font-semibold tracking-tight">Dashboard · Quick Size-Up Cockpit</h1>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="rounded border border-border bg-panel px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>

          <div className="rounded border border-border bg-panel/50 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {statusPill(runStatus.intelFetched, 'Intel fetched')}
              {statusPill(runStatus.draftSaved, 'Draft saved')}
              {statusPill(runStatus.roiComputed, 'ROI computed')}
              <span className="ml-auto text-[10px] text-muted-foreground">
                Last run: {runStatus.lastRunAt ? new Date(runStatus.lastRunAt).toLocaleString('en-GB') : 'Not run yet'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[540px_minmax(0,1fr)]">
            <Card className="shadow-none">
              <CardHeader>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Postcode Quick Size-Up</h2>
                  <p className="text-[11px] text-muted-foreground">Dense capture with exchange/completion cashflow assumptions.</p>
                </div>
                {savedDealId ? <Badge variant="neutral">Draft saved</Badge> : null}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="space-y-1 text-[11px] text-muted-foreground">
                      <span>Postcode</span>
                      <input
                        required
                        value={postcode}
                        onChange={(event) => setPostcode(event.target.value.toUpperCase())}
                        onBlur={() => setPostcode((v) => normalisePostcode(v))}
                        placeholder="e.g. SW1A 1AA"
                        className={moneyInputClass(postcodeInvalid)}
                      />
                      {postcodeInvalid ? <span className="text-[10px] text-dla-red">Use a valid UK postcode format.</span> : null}
                    </label>

                    <label className="space-y-1 text-[11px] text-muted-foreground">
                      <span>Purchase price (£)</span>
                      <input
                        required
                        inputMode="decimal"
                        value={purchasePrice}
                        onChange={(event) => setPurchasePrice(event.target.value)}
                        onBlur={() => setPurchasePrice((v) => formatCurrencyInput(v))}
                        placeholder="e.g. 225,000"
                        className={moneyInputClass(purchasePriceInvalid)}
                      />
                      {purchasePriceInvalid ? <span className="text-[10px] text-dla-red">Enter a valid amount above £0.</span> : null}
                    </label>

                    <label className="space-y-1 text-[11px] text-muted-foreground">
                      <span>Estimated monthly rent (£)</span>
                      <input
                        required
                        inputMode="decimal"
                        value={monthlyRent}
                        onChange={(event) => setMonthlyRent(event.target.value)}
                        onBlur={() => setMonthlyRent((v) => formatCurrencyInput(v))}
                        placeholder="e.g. 1,450"
                        className={moneyInputClass(monthlyRentInvalid)}
                      />
                      {monthlyRentInvalid ? <span className="text-[10px] text-dla-red">Enter a valid amount above £0.</span> : null}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="space-y-1 text-[11px] text-muted-foreground">
                      <span>Source</span>
                      <input
                        value={source}
                        onChange={(event) => setSource(event.target.value)}
                        placeholder="e.g. Rightmove, Zoopla, agent email"
                        className={moneyInputClass()}
                      />
                    </label>

                    <label className="space-y-1 text-[11px] text-muted-foreground md:col-span-2">
                      <span>Listing URL</span>
                      <input
                        type="url"
                        value={listingUrl}
                        onChange={(event) => setListingUrl(event.target.value)}
                        placeholder="https://"
                        className={moneyInputClass()}
                      />
                    </label>
                  </div>

                  <label className="space-y-1 text-[11px] text-muted-foreground">
                    <span>Notes</span>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Any context, caveats, or call notes"
                      className="w-full rounded border border-border bg-muted px-2 py-1.5 text-xs text-foreground outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-1"
                    />
                  </label>

                  <details className="rounded border border-border bg-panel/30 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-foreground">{advancedSummary}</summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">On exchange</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Reservation fee (£)</span><input value={advanced.reservationFee} onChange={(e) => setAdvanced((v) => ({ ...v, reservationFee: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, reservationFee: formatCurrencyInput(v.reservationFee) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Solicitor (£)</span><input value={advanced.solicitorFee} onChange={(e) => setAdvanced((v) => ({ ...v, solicitorFee: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, solicitorFee: formatCurrencyInput(v.solicitorFee) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Legal disbursements (£)</span><input value={advanced.legalDisbursements} onChange={(e) => setAdvanced((v) => ({ ...v, legalDisbursements: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, legalDisbursements: formatCurrencyInput(v.legalDisbursements) }))} className={moneyInputClass()} /></label>
                          <div className="fin-panel p-2 text-[11px]"><p className="metric-label">Combined total</p><p className="financial text-xs">{formatMoneyMonospace(finance.exchangeCombinedTotal)}</p></div>
                        </div>
                        <div className="mt-1 fin-panel p-2 text-[11px]"><p className="metric-label">10% deposit less reservation</p><p className="financial text-xs">{formatMoneyMonospace(finance.exchangeDepositNet)}</p></div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">On completion</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Broker fees (£)</span><input value={advanced.brokerFees} onChange={(e) => setAdvanced((v) => ({ ...v, brokerFees: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, brokerFees: formatCurrencyInput(v.brokerFees) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Stamp duty (£)</span><input value={advanced.stampDuty} onChange={(e) => setAdvanced((v) => ({ ...v, stampDuty: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, stampDuty: formatCurrencyInput(v.stampDuty) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Furniture pack (£)</span><input value={advanced.furniturePack} onChange={(e) => setAdvanced((v) => ({ ...v, furniturePack: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, furniturePack: formatCurrencyInput(v.furniturePack) }))} className={moneyInputClass()} /></label>
                          <div className="fin-panel p-2 text-[11px]"><p className="metric-label">Completion total</p><p className="financial text-xs">{formatMoneyMonospace(finance.completionTotal)}</p></div>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
                          <div className="fin-panel p-2"><p className="metric-label">Assumed mortgage amount (75% LTV)</p><p className="financial text-xs">{formatMoneyMonospace(finance.mortgageAmount)}</p></div>
                          <div className="fin-panel p-2"><p className="metric-label">Deposit remaining (15%)</p><p className="financial text-xs">{formatMoneyMonospace(finance.completionDepositRemaining)}</p></div>
                          <div className="fin-panel p-2"><p className="metric-label">Total required to complete</p><p className="financial text-xs font-semibold">{formatMoneyMonospace(finance.totalRequiredToComplete)}</p></div>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Cash flow monthly breakdown</p>
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Mortgage (£)</span><input value={advanced.monthlyMortgage} onChange={(e) => setAdvanced((v) => ({ ...v, monthlyMortgage: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, monthlyMortgage: formatCurrencyInput(v.monthlyMortgage) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Estate service charges (£)</span><input value={advanced.monthlyEstateServiceCharges} onChange={(e) => setAdvanced((v) => ({ ...v, monthlyEstateServiceCharges: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, monthlyEstateServiceCharges: formatCurrencyInput(v.monthlyEstateServiceCharges) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Ground rent (£)</span><input value={advanced.monthlyGroundRent} onChange={(e) => setAdvanced((v) => ({ ...v, monthlyGroundRent: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, monthlyGroundRent: formatCurrencyInput(v.monthlyGroundRent) }))} className={moneyInputClass()} /></label>
                          <label className="space-y-1 text-[11px] text-muted-foreground"><span>Management (£)</span><input value={advanced.monthlyManagement} onChange={(e) => setAdvanced((v) => ({ ...v, monthlyManagement: e.target.value }))} onBlur={() => setAdvanced((v) => ({ ...v, monthlyManagement: formatCurrencyInput(v.monthlyManagement) }))} className={moneyInputClass()} /></label>
                          <div className="fin-panel p-2"><p className="metric-label">Estimated rent (monthly)</p><p className="financial text-xs">{formatMoneyMonospace(finance.estimatedRent)}</p></div>
                          <div className="fin-panel p-2"><p className="metric-label">Total monthly / yearly</p><p className="financial text-xs">{formatMoneyMonospace(finance.totalMonthly)} / {formatMoneyMonospace(finance.totalYearly)}</p></div>
                        </div>
                        <div className="mt-1 fin-panel p-2"><p className="metric-label">Cash saving</p><p className="financial text-xs font-semibold">{formatMoneyMonospace(finance.cashSaving)}</p></div>
                      </div>
                    </div>
                  </details>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!canSubmit || submitting}
                      className="rounded border border-accent bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground hover:brightness-110 disabled:opacity-60"
                    >
                      {submitting ? 'Running size-up…' : 'Run quick size-up'}
                    </button>
                    {savedDealId ? <p className="financial text-xs text-muted-foreground">Draft ID: {savedDealId}</p> : null}
                    {miniOutput ? <Badge variant={cliffBadge(miniOutput.cliffGauge).variant}>{cliffBadge(miniOutput.cliffGauge).label}</Badge> : null}
                  </div>

                  {error ? <p className="text-xs text-dla-red">{error}</p> : null}
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Comparison matrix</h2>
                  <p className="text-[11px] text-muted-foreground">Engine outputs in-view for same-screen decisioning.</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="overflow-hidden rounded border border-border">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scenario</TableHead>
                        <TableHead>Break-even rate (Yr6)</TableHead>
                        <TableHead>DLA repaid</TableHead>
                        <TableHead>DLA remaining</TableHead>
                        <TableHead>ETA DLA clear</TableHead>
                        <TableHead>Dividend/salary</TableHead>
                        <TableHead>Cliff gauge</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrixRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">Enter postcode, price, and rent to populate matrix.</TableCell>
                        </TableRow>
                      ) : (
                        matrixRows.map((row) => (
                          <TableRow key={row.label}>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="financial">{formatPctMonospace(row.result.breakEvenYear6Pct)}</TableCell>
                            <TableCell className="financial">{formatMoneyMonospace(row.result.repaidByHorizon)}</TableCell>
                            <TableCell className="financial">{formatMoneyMonospace(row.result.dlaRemaining)}</TableCell>
                            <TableCell className="financial">{row.result.etaYear ? `Year ${row.result.etaYear}` : 'Not cleared'}</TableCell>
                            <TableCell className="financial">{formatMoneyMonospace(row.result.dividendOrSalaryByHorizon)}</TableCell>
                            <TableCell>
                              <Badge variant={cliffBadge(row.result.cliffBadge).variant}>{cliffBadge(row.result.cliffBadge).label.replace('2030 Cliff: ', '')}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="fin-panel p-2">
                    <p className="metric-label">Funding required to complete</p>
                    <p className="financial text-xs font-semibold">{formatMoneyMonospace(finance.totalRequiredToComplete)}</p>
                  </div>
                  <div className="fin-panel p-2">
                    <p className="metric-label">Total monthly outgoing</p>
                    <p className="financial text-xs">{formatMoneyMonospace(finance.totalMonthly)}</p>
                  </div>
                  <div className="fin-panel p-2">
                    <p className="metric-label">Cash saving (monthly)</p>
                    <p className="financial text-xs">{formatMoneyMonospace(finance.cashSaving)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </AuthGate>
  )
}
