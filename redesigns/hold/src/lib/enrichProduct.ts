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

function withTimeout<T>(
  promise: Promise<T | null>,
  ms: number,
  signal?: AbortSignal
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise
      .then((v) => {
        window.clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      })
      .catch(() => {
        window.clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(null)
      })
  })
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

/** Instant parse — no network */
export function enrichFromUrlLocal(rawUrl: string): EnrichedProduct | null {
  const base = inferProductFromUrl(rawUrl)
  if (!base) return null
  const name = cleanProductName(base.name) || base.name
  const { category, hits } = scoreCategory(`${base.host} ${name} ${rawUrl}`)
  return {
    name,
    category: hits > 0 ? category : base.category,
    host: base.host,
    storeLabel: base.storeLabel,
    confidence: base.priceFromQuery != null ? 'medium' : base.confidence,
    notes: [`Store: ${base.storeLabel}`],
    price: base.priceFromQuery,
    currency: base.currencyFromQuery,
    source: 'url',
  }
}

/**
 * Fast enrich: local first (caller), then Jina + HTML in parallel.
 * If Jina already fills name+price, we skip waiting on the HTML proxy.
 */
export async function enrichProductFromUrl(
  rawUrl: string,
  signal?: AbortSignal
): Promise<EnrichedProduct | null> {
  const local = enrichFromUrlLocal(rawUrl)
  if (!local) return null

  let price = local.price
  let currency = local.currency
  let source: EnrichedProduct['source'] = local.source
  let name = local.name
  const notes = [...local.notes]
  const target = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`

  const jinaP = withTimeout(tryJina(target, signal), 3000, signal)
  const htmlP = withTimeout(tryHtmlProxy(target, signal), 3000, signal)

  const jina = await jinaP
  if (signal?.aborted) return local

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

  const nameWeak = !name || name.length < 4 || /product$/i.test(name)
  if ((price == null || nameWeak) && !signal?.aborted) {
    const html = await htmlP
    if (html) {
      if (price == null) {
        const meta = extractPriceFromHtmlMeta(html)
        if (meta) {
          price = meta.price
          currency = meta.currency || currency
          source = 'mixed'
          notes.push(`Price ${meta.price} ${meta.currency || ''}`.trim())
        }
      }
      if (nameWeak) {
        const ogTitle =
          html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
          html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
        if (ogTitle?.[1]) {
          name = cleanProductName(ogTitle[1]) || name
          notes.push('Name from og:title')
        }
      }
    }
  }

  if (price == null) notes.push('Price not found — enter it')

  name = cleanProductName(name) || name
  const { category, hits } = scoreCategory(`${local.host} ${name} ${rawUrl}`)
  const finalCategory: Category = hits > 0 ? category : local.category

  return {
    name,
    category: finalCategory,
    host: local.host,
    storeLabel: local.storeLabel,
    confidence: price != null && name.length > 4 ? 'high' : hits >= 2 ? 'high' : 'medium',
    notes,
    price,
    currency,
    source,
  }
}

export { extractBestPrice as extractPriceFromText }
