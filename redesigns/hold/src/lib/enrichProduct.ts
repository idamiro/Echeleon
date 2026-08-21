import type { Category } from '../scoring/types'
import { inferProductFromUrl, scoreCategory, type ProductInference } from './productFromUrl'

export interface EnrichedProduct extends Omit<
  ProductInference,
  'priceFromQuery' | 'currencyFromQuery'
> {
  price: number | null
  currency: string | null
  source: 'url' | 'page' | 'mixed'
  summary?: string
}

const PRICE_RE =
  /(?:USD|EUR|GBP|TRY|TL|\$|€|£|₺)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)|(?:([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]+(?:[.,][0-9]{2})?)\s*(?:USD|EUR|GBP|TRY|TL|\$|€|£|₺))/gi

function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    const parts = s.split(',')
    s = parts[1]?.length === 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function currencyFromSymbol(chunk: string): string | null {
  const u = chunk.toUpperCase()
  if (u.includes('USD') || chunk.includes('$')) return 'USD'
  if (u.includes('EUR') || chunk.includes('€')) return 'EUR'
  if (u.includes('GBP') || chunk.includes('£')) return 'GBP'
  if (u.includes('TRY') || u.includes('TL') || chunk.includes('₺')) return 'TRY'
  return null
}

export function extractPriceFromText(text: string): {
  price: number | null
  currency: string | null
} {
  const matches = [...text.matchAll(PRICE_RE)].slice(0, 16)
  for (const m of matches) {
    const amountRaw = m[1] || m[2]
    if (!amountRaw) continue
    const price = parseAmount(amountRaw)
    if (price == null || price < 1 || price > 500000) continue
    return { price, currency: currencyFromSymbol(m[0]) }
  }
  return { price: null, currency: null }
}

function extractTitleFromMarkdown(md: string): string | null {
  const h1 = md.match(/^#\s+(.+)$/m)
  if (h1?.[1]) {
    return h1[1]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[\[\]]/g, '')
      .trim()
      .slice(0, 120)
  }
  const title = md.match(/Title:\s*(.+)/i)
  if (title?.[1]) return title[1].trim().slice(0, 120)
  return null
}

/**
 * Enrich a pasted product URL:
 * 1) local path inference (+ query price)
 * 2) page read via Jina Reader for title + price (no API key)
 */
export async function enrichProductFromUrl(
  rawUrl: string,
  signal?: AbortSignal
): Promise<EnrichedProduct | null> {
  const base = inferProductFromUrl(rawUrl)
  if (!base) return null

  let price = base.priceFromQuery
  let currency = base.currencyFromQuery
  let source: EnrichedProduct['source'] = 'url'
  let name = base.name
  let summary: string | undefined
  const notes = [...base.notes]

  try {
    const target = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`
    const res = await fetch(`https://r.jina.ai/${target}`, {
      signal,
      headers: { Accept: 'text/plain' },
    })
    if (res.ok) {
      const text = (await res.text()).slice(0, 28000)
      const titled = extractTitleFromMarkdown(text)
      if (titled && titled.length > 3) {
        name = titled
        notes.push('Title read from product page.')
      }
      const found = extractPriceFromText(text)
      if (found.price != null) {
        price = found.price
        currency = found.currency || currency
        source = 'mixed'
        notes.push(
          `Price detected on page: ${found.price}${found.currency ? ` ${found.currency}` : ''}`
        )
      }
      const para = text
        .split('\n')
        .map((l) => l.trim())
        .find(
          (l) =>
            l.length > 70 &&
            l.length < 240 &&
            !l.startsWith('#') &&
            !l.startsWith('http') &&
            !l.startsWith('![')
        )
      if (para) summary = para
    }
  } catch {
    notes.push('Live page read unavailable — using link inference only.')
  }

  const { category, hits } = scoreCategory(`${base.host} ${name}`)
  const finalCategory: Category = hits > 0 ? category : base.category

  return {
    name,
    category: finalCategory,
    host: base.host,
    storeLabel: base.storeLabel,
    confidence:
      price != null && name.length > 4 ? 'high' : hits >= 2 ? 'high' : base.confidence,
    notes,
    price,
    currency,
    source,
    summary,
  }
}
