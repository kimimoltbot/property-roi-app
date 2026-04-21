import { runComparativeEngine } from './engine'
import { SelectorState } from './types'

export function selectComparativeRows(state: SelectorState) {
  const deals = state.ghostDeal ? [...state.deals, state.ghostDeal] : state.deals
  return deals.map((deal) => runComparativeEngine(deal, state.scenario.horizon, state.scenario.mode))
}

export function selectDealById(state: SelectorState, dealId: string) {
  const row = selectComparativeRows(state).find((item) => item.dealId === dealId)
  return row ?? null
}

export function formatMoneyMonospace(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}£${abs.toLocaleString('en-GB', { maximumFractionDigits: 0 }).padStart(9, ' ')}`
}

export function formatPctMonospace(value: number): string {
  return `${value.toFixed(1).padStart(5, ' ')}%`
}
