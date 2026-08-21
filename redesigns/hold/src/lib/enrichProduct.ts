import type { Category } from '../scoring/types'
import { cleanProductName } from './cleanName'
import { extractBestPrice, extractPriceFromHtmlMeta } from './extractPrice'
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

async function tryJina(target: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${target}`, {
      signal,
      headers: { Accept: 'text/plain' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function tryHtmlProxy(target: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
      { signal }
    )
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
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
  const target = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`

  const jina = await tryJina(target, signal)
  if (jina) {
    const titled = extractTitleFromMarkdown(jina.slice(0, 4000))
    if (titled && titled.length > 3) {
      name = titled
      notes.push('Name from page')
    }
    const found = extractBestPrice(jina.slice(0, 60000), currency)
    if (found) {
      price = found.price
      currency = found.currency
      source = 'mixed'
      notes.push(`Price ${found.price} ${found.currency}`)
    }
  }

  if (price == null) {
    const html = await tryHtmlProxy(target, signal)
    if (html) {
      const meta = extractPriceFromHtmlMeta(html)
      if (meta) {
        price = meta.price
        currency = meta.currency || currency
        source = 'mixed'
        notes.push(`Price ${meta.price} ${meta.currency || ''}`.trim())
      }
      if (!name || name.endsWith('product')) {
        const ogTitle = html.match(
          /property=["']og:title["'][^>]*content=["']([^"']+)["']/i
        ) || html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
        if (ogTitle?.[1]) {
          name = cleanProductName(ogTitle[1]) || name
          notes.push('Name from og:title')
        }
      }
    }
  }

  if (price == null) notes.push('Price not found — enter it')

  name = cleanProductName(name) || name
  const { category, hits } = scoreCategory(`${base.host} ${name} ${rawUrl}`)
  const finalCategory: Category = hits > 0 ? category : base.category

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

export { extractBestPrice as extractPriceFromText }
