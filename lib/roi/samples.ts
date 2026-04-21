import { runComparativeEngine } from './engine'
import { DealInput, Horizon, Mode } from './types'

export const FINAL_FOUR_DEALS: DealInput[] = [
  {
    id: 'fox',
    name: 'Fox',
    postcode: 'M1 4FP',
    dlaStart: 99000,
    loanAmount: 260000,
    annualRent: 26400,
    annualCosts: 7200,
    initialRate: 0.035,
    annualCashflowConservative: 1200,
    annualCashflowMarketing: 2800,
  },
  {
    id: 'circle',
    name: 'Circle',
    postcode: 'M2 5CR',
    dlaStart: 112000,
    loanAmount: 295000,
    annualRent: 28200,
    annualCosts: 7600,
    initialRate: 0.035,
    annualCashflowConservative: 900,
    annualCashflowMarketing: 2600,
  },
  {
    id: 'newcastle',
    name: 'Newcastle',
    postcode: 'NE1 7NW',
    dlaStart: 87000,
    loanAmount: 230000,
    annualRent: 24600,
    annualCosts: 6900,
    initialRate: 0.035,
    annualCashflowConservative: 600,
    annualCashflowMarketing: 1900,
  },
  {
    id: 'vrg',
    name: 'VRG',
    postcode: 'M1 7ED',
    dlaStart: 111082,
    loanAmount: 300000,
    annualRent: 28800,
    annualCosts: 8100,
    initialRate: 0.035,
    annualCashflowConservative: 1000,
    annualCashflowMarketing: 2500,
  },
]

export const DEFAULT_SCENARIO: { horizon: Horizon; mode: Mode } = {
  horizon: 20,
  mode: 'conservative',
}

export const GHOST_DEAL_ID = 'ghost-deal-placeholder'

export const FINAL_FOUR_DETERMINISTIC_OUTPUTS = FINAL_FOUR_DEALS.map((deal) => ({
  dealId: deal.id,
  conservative20Y: runComparativeEngine(deal, 20, 'conservative'),
  marketing20Y: runComparativeEngine(deal, 20, 'marketing'),
}))
