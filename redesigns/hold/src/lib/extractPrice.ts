/**
 * Pick the most likely product price from messy page text.
 * Avoids protection plans, shipping, "under $10", list-price-only noise.
 */

export interface PriceHit {
  price: number
  currency: string
  score: number
  context: string
}

const LINE_PRICE =
  /(?:USD|EUR|GBP|TRY|TL|\$|€|£|₺)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)|([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)\s*(?:USD|EUR|GBP|TRY|TL)/gi

function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    const parts = s.split(',')
    s = parts[1]?.length === 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function currencyFrom(chunk: string, fallback = 'USD'): string {
  const u = chunk.toUpperCase()
  if (u.includes('EUR') || chunk.includes('€')) return 'EUR'
  if (u.includes('GBP') || chunk.includes('£')) return 'GBP'
  if (u.includes('TRY') || u.includes('TL') || chunk.includes('₺')) return 'TRY'
  if (u.includes('USD') || chunk.includes('$')) return 'USD'
  return fallback
}

const BAD_CONTEXT =
  /protection plan|complete protect|\/month|per month|under \$10|shipping|save \$|off the current|renewed|warranty|gift card|subscribe|installment|apr\b|financing/i

const GOOD_CONTEXT =
  /with \d+\s*percent savings|list price|now only|current price|deal price|our price|sale price|buy now|add to cart|price\b/i

export function extractBestPrice(
  text: string,
  preferredCurrency?: string | null
): { price: number; currency: string } | null {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const hits: PriceHit[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const window = [lines[i - 1], line, lines[i + 1]].filter(Boolean).join(' ')
    if (BAD_CONTEXT.test(window) && !/percent savings/i.test(window)) continue

    const matches = [...line.matchAll(LINE_PRICE)]
    for (const m of matches) {
      const raw = m[1] || m[2]
      if (!raw) continue
      const price = parseAmount(raw)
      if (price == null) continue
      if (price < 12 || price > 200000) continue

      let score = 1
      if (GOOD_CONTEXT.test(window)) score += 4
      if (/with \d+\s*percent savings/i.test(line)) score += 6
      if (/^\$?\d/.test(line) && line.length < 16) score += 2
      if (/list price/i.test(window) && !/percent savings/i.test(window)) score -= 3
      if (price === Math.round(price) && price >= 50) score += 1

      const currency = currencyFrom(m[0], preferredCurrency || 'USD')
      hits.push({ price, currency, score, context: line.slice(0, 80) })
    }
  }

  if (!hits.length) return null

  // Prefer highest score; break ties by frequency of that price
  const byPrice = new Map<string, { price: number; currency: string; score: number; n: number }>()
  for (const h of hits) {
    const key = `${h.currency}:${h.price}`
    const cur = byPrice.get(key)
    if (!cur) byPrice.set(key, { price: h.price, currency: h.currency, score: h.score, n: 1 })
    else {
      cur.score = Math.max(cur.score, h.score)
      cur.n += 1
    }
  }

  const ranked = [...byPrice.values()].sort(
    (a, b) => b.score + b.n * 0.5 - (a.score + a.n * 0.5)
  )

  // If top looks like list price and second is discounted, prefer second when much lower
  const top = ranked[0]!
  const second = ranked[1]
  if (
    second &&
    top.price > second.price * 1.2 &&
    second.score >= top.score - 2 &&
    second.n >= 2
  ) {
    return { price: second.price, currency: second.currency }
  }

  return { price: top.price, currency: top.currency }
}
