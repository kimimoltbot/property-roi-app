import { ComparativeResult, DealInput, Horizon, Mode, StressPoint, YearPoint } from './types'

const CLIFF_YEAR = 6
const CONSERVATIVE_STRESS_RATES = [0.04, 0.06, 0.08]

function annualModeCash(deal: DealInput, mode: Mode): number {
  return mode === 'conservative' ? deal.annualCashflowConservative : deal.annualCashflowMarketing
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

export function runComparativeEngine(deal: DealInput, horizon: Horizon, mode: Mode): ComparativeResult {
  let dlaRemaining = deal.dlaStart
  let distributed = 0
  let etaYear: number | null = null
  const timeline: YearPoint[] = []

  for (let year = 1; year <= horizon; year += 1) {
    const rate = mode === 'conservative' && year === CLIFF_YEAR ? 0.06 : deal.initialRate
    const interest = deal.loanAmount * rate
    const freeCash = deal.annualRent - deal.annualCosts - interest + annualModeCash(deal, mode)

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

    timeline.push({
      year,
      rate,
      freeCash,
      dlaRemaining,
      distributed,
    })
  }

  const breakEvenYear6 = breakEvenRateYear6(deal, mode)
  const refinanceAlert = breakEvenYear6 < 0.06

  const stress2030 =
    mode === 'conservative'
      ? CONSERVATIVE_STRESS_RATES.map((rate) => {
          const freeCashYear6 = deal.annualRent - deal.annualCosts - deal.loanAmount * rate + annualModeCash(deal, mode)
          return { rate, freeCashYear6, passes: freeCashYear6 >= 0 }
        })
      : undefined

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
    timeline,
  }
}
