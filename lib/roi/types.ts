export type Mode = 'conservative' | 'marketing'

export type Horizon = 5 | 10 | 15 | 20

export type MortgageType = 'interest-only' | 'repayment'

export interface DealInput {
  id: string
  name: string
  postcode: string
  dlaStart: number
  loanAmount: number
  annualRent: number
  annualCosts: number
  initialRate?: number
  initialMortgageRate?: number
  fixedTermYears?: number
  mortgageType?: MortgageType
  postFixRateAssumption?: number
  annualCashflowConservative: number
  annualCashflowMarketing: number
  investedCash?: number
}

export interface YearPoint {
  year: number
  rate: number
  debtService: number
  freeCash: number
  dlaRemaining: number
  distributed: number
  loanBalance: number
}

export interface StressPoint {
  rate: number
  freeCashYear6: number
  passes: boolean
}

export interface ReturnKpis {
  netCoCYear1Pct: number
  netCoCHorizonPct: number
  returnOnInvestedCash5Pct: number
  returnOnInvestedCash10Pct: number
  returnOnInvestedCash20Pct: number
  paybackPeriodYears: number | null
  dlaAdjustedReturnPct: number
}

export interface ComparativeResult {
  dealId: string
  mode: Mode
  horizon: Horizon
  dlaStart: number
  repaidByHorizon: number
  dlaRemaining: number
  etaYear: number | null
  breakEvenYear6Pct: number
  refinanceAlert: boolean
  stress2030?: StressPoint[]
  cliffBadge: 'safe' | 'watch' | 'alert'
  dividendOrSalaryByHorizon: number
  kpis: ReturnKpis
  timeline: YearPoint[]
}

export interface EngineScenario {
  horizon: Horizon
  mode: Mode
}

export interface SelectorState {
  deals: DealInput[]
  ghostDeal?: DealInput
  scenario: EngineScenario
}
