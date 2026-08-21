/** Pure tally — money not spent only from explicit let_it_go */
export function tallyMoneyNotSpent(
  holds: Array<{
    decision?: string
    moneyNotSpent?: number
    moneyCurrency?: string
  }>
): { byCurrency: Record<string, number>; totalEntries: number } {
  const byCurrency: Record<string, number> = {}
  let totalEntries = 0
  for (const h of holds) {
    if (h.decision === 'let_it_go' && h.moneyNotSpent != null && h.moneyCurrency) {
      byCurrency[h.moneyCurrency] =
        (byCurrency[h.moneyCurrency] ?? 0) + h.moneyNotSpent
      totalEntries += 1
    }
  }
  return { byCurrency, totalEntries }
}
