import type { Category } from '../scoring/types'
import { cleanProductName } from './cleanName'
import { extractBestPrice } from './extractPrice'
import { inferProductFromUrl, scoreCategory, type ProductInference } from './productFromUrl'

export interface EnrichedProduct extends Omit<
  ProductInference,
  'priceFromQuery' | 'currencyFromQuery'
> {
  price: number | null
  currency: string | null
  source: 'url' | 'page' | 'mixed'
}

function extractTitleFromMarkdown(md: string): string | null {
  const titleLine = md.match(/^Title:\s*(.+)$/m)
  if (titleLine?.[1]) return cleanProductName(titleLine[1])
  const h1 = md.match(/^#\s+(.+)$/m)
  if (h1?.[1]) {
    return cleanProductName(
      h1[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[\[\]]/g, '')
    )
  }
  return null
}

export async function enrichProductFromUrl(
  rawUrl: string,
  signal?: AbortSignal
): Promise<EnrichedProduct | null> {
  const base = inferProductFromUrl(rawUrl)
  if (!base) return null

  let price = base.priceFromQuery
  let currency = base.currencyFromQuery
  let source: EnrichedProduct['source'] = 'url'
  let name = cleanProductName(base.name) || base.name
  const notes: string[] = [`Store: ${base.storeLabel}`]

  try {
    const target = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`
    const res = await fetch(`https://r.jina.ai/${target}`, {
      signal,
      headers: { Accept: 'text/plain' },
    })
    if (res.ok) {
      const text = await res.text()
      const titled = extractTitleFromMarkdown(text.slice(0, 4000))
      if (titled && titled.length > 3) {
        name = titled
        notes.push('Name from product page title')
      }

      const found = extractBestPrice(text.slice(0, 50000), currency)
      if (found) {
        price = found.price
        currency = found.currency
        source = 'mixed'
        notes.push(`Price ${found.price} ${found.currency}`)
      } else {
        notes.push('Price not found on page — enter it')
      }
    }
  } catch {
    notes.push('Page read failed — using link only')
  }

  name = cleanProductName(name) || name
  const { category, hits } = scoreCategory(`${base.host} ${name} ${rawUrl}`)
  const finalCategory: Category = hits > 0 ? category : base.category
  notes.push(`Category: ${finalCategory}`)

  return {
    name,
    category: finalCategory,
    host: base.host,
    storeLabel: base.storeLabel,
    confidence: price != null && name.length > 4 ? 'high' : hits >= 2 ? 'high' : 'medium',
    notes,
    price,
    currency,
    source,
  }
}

// keep for tests
export { extractBestPrice as extractPriceFromText }
