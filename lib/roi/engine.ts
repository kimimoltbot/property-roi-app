import { ComparativeResult, DealInput, Horizon, Mode, StressPoint, YearPoint } from './types'

const CLIFF_YEAR = 6
const CONSERVATIVE_STRESS_RATES = [0.04, 0.06, 0.08]
const DEFAULT_FIXED_TERM_YEARS = 5
const DEFAULT_POST_FIX_RATE = 0.07
const DEFAULT_REPAYMENT_TERM_YEARS = 30

function annualModeCash(deal: DealInput, mode: Mode): number {
  return mode === 'conservative' ? deal.annualCashflowConservative : deal.annualCashflowMarketing
}

function resolveInitialRate(deal: DealInput): number {
  return deal.initialMortgageRate ?? deal.initialRate ?? 0.061
}

function rateForYear(deal: DealInput, year: number): number {
  const initialMortgageRate = resolveInitialRate(deal)
  const fixedTermYears = deal.fixedTermYears ?? DEFAULT_FIXED_TERM_YEARS
  const postFixRateAssumption = deal.postFixRateAssumption ?? initialMortgageRate ?? DEFAULT_POST_FIX_RATE

  if (year <= fixedTermYears) return initialMortgageRate
  return postFixRateAssumption
}

function annualDebtService(balance: number, rate: number, mortgageType: DealInput['mortgageType']): number {
  if (mortgageType !== 'repayment') return balance * rate

  const monthlyRate = rate / 12
  const termMonths = DEFAULT_REPAYMENT_TERM_YEARS * 12
  if (monthlyRate === 0) return balance / DEFAULT_REPAYMENT_TERM_YEARS

  const monthlyPayment = (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
  return monthlyPayment * 12
}

function nextBalance(balance: number, debtService: number, rate: number, mortgageType: DealInput['mortgageType']): number {
  if (mortgageType !== 'repayment') return balance

  const interest = balance * rate
  const principal = Math.max(0, debtService - interest)
  return Math.max(0, balance - principal)
}

function breakEvenRateYear6(deal: DealInput, mode: Mode): number {
  const numerator = deal.annualRent - deal.annualCosts + annualModeCash(deal, mode)
  return Math.max(0, numerator / deal.loanAmount)
}

function cliffBadge(stress: StressPoint[] | undefined, refinanceAlert: boolean): 'safe' | 'watch' | 'alert' {
  if (refinanceAlert) return 'alert'
  if (!stress) return 'watch'
  const passCount = stress.filter((s) => s.passes).length
  if (passCount === stress.length) return 'safe'
  if (passCount === 0) return 'alert'
  return 'watch'
}

function accumulatedFreeCash(timeline: YearPoint[], years: number): number {
  return timeline
    .filter((point) => point.year <= years)
    .reduce((sum, point) => sum + point.freeCash, 0)
}

export function runComparativeEngine(deal: DealInput, horizon: Horizon, mode: Mode): ComparativeResult {
  let dlaRemaining = deal.dlaStart
  let distributed = 0
  let etaYear: number | null = null
  let loanBalance = deal.loanAmount
  const timeline: YearPoint[] = []
  const mortgageType = deal.mortgageType ?? 'interest-only'

  for (let year = 1; year <= horizon; year += 1) {
    const modelledRate = rateForYear(deal, year)
    const rate = mode === 'conservative' && year === CLIFF_YEAR ? Math.max(modelledRate, 0.06) : modelledRate
    const debtService = annualDebtService(loanBalance, rate, mortgageType)
    const freeCash = deal.annualRent - deal.annualCosts - debtService + annualModeCash(deal, mode)

    if (freeCash > 0) {
      const payDla = Math.min(dlaRemaining, freeCash)
      dlaRemaining -= payDla
      const remainder = freeCash - payDla
      if (dlaRemaining <= 0 && etaYear === null) etaYear = year
      if (dlaRemaining <= 0 && remainder > 0) {
        distributed += remainder
      }
    } else {
      dlaRemaining += Math.abs(freeCash)
    }

    const endOfYearBalance = nextBalance(loanBalance, debtService, rate, mortgageType)

    timeline.push({
      year,
      rate,
      debtService,
      freeCash,
      dlaRemaining,
      distributed,
      loanBalance: endOfYearBalance,
    })

    loanBalance = endOfYearBalance
  }

  const breakEvenYear6 = breakEvenRateYear6(deal, mode)
  const refinanceAlert = breakEvenYear6 < 0.06

  const stress2030 =
    mode === 'conservative'
      ? CONSERVATIVE_STRESS_RATES.map((rate) => {
          const debtService = annualDebtService(deal.loanAmount, rate, mortgageType)
          const freeCashYear6 = deal.annualRent - deal.annualCosts - debtService + annualModeCash(deal, mode)
          return { rate, freeCashYear6, passes: freeCashYear6 >= 0 }
        })
      : undefined

  const investedCash = Math.max(1, deal.investedCash ?? deal.dlaStart)
  const year1FreeCash = timeline[0]?.freeCash ?? 0
  const horizonFreeCash = accumulatedFreeCash(timeline, horizon)
  const cash5 = accumulatedFreeCash(timeline, Math.min(5, horizon))
  const cash10 = accumulatedFreeCash(timeline, Math.min(10, horizon))
  const cash20 = accumulatedFreeCash(timeline, Math.min(20, horizon))

  const paybackEntry = timeline.find((point) => point.distributed >= investedCash)

  const kpis = {
    netCoCYear1Pct: (year1FreeCash / investedCash) * 100,
    netCoCHorizonPct: (horizonFreeCash / investedCash) * 100,
    returnOnInvestedCash5Pct: (cash5 / investedCash) * 100,
    returnOnInvestedCash10Pct: (cash10 / investedCash) * 100,
    returnOnInvestedCash20Pct: (cash20 / investedCash) * 100,
    paybackPeriodYears: paybackEntry?.year ?? null,
    dlaAdjustedReturnPct: ((horizonFreeCash - Math.max(0, deal.dlaStart - dlaRemaining)) / investedCash) * 100,
  }

  return {
    dealId: deal.id,
    mode,
    horizon,
    dlaStart: deal.dlaStart,
    repaidByHorizon: Math.max(0, deal.dlaStart - dlaRemaining),
    dlaRemaining,
    etaYear,
    breakEvenYear6Pct: breakEvenYear6 * 100,
    refinanceAlert,
    stress2030,
    cliffBadge: cliffBadge(stress2030, refinanceAlert),
    dividendOrSalaryByHorizon: distributed,
    kpis,
    timeline,
  }
}
