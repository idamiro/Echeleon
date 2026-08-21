import { describe, expect, it } from 'vitest'
import { tallyMoneyNotSpent } from './money'

describe('money not spent', () => {
  it('counts only explicit let_it_go — not expired or ignored holds', () => {
    const result = tallyMoneyNotSpent([
      { decision: 'let_it_go', moneyNotSpent: 120, moneyCurrency: 'EUR' },
      { decision: 'bought', moneyNotSpent: 99, moneyCurrency: 'EUR' },
      { decision: 'hold_again' },
      {}, // expired / ignored — no decision
      { decision: 'let_it_go', moneyNotSpent: 40, moneyCurrency: 'TRY' },
    ])
    expect(result.totalEntries).toBe(2)
    expect(result.byCurrency).toEqual({ EUR: 120, TRY: 40 })
  })
})
