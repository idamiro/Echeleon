import type { Category } from '../scoring/types'

export interface ProductInference {
  name: string
  category: Category
  host: string
  storeLabel: string
  confidence: 'high' | 'medium' | 'low'
  notes: string[]
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'tag',
  'ascsubtag',
])

const NOISE_SEGMENTS = new Set([
  'www',
  'dp',
  'gp',
  'product',
  'products',
  'item',
  'items',
  'p',
  'pd',
  'en',
  'en-us',
  'en-gb',
  'tr',
  'de',
  'fr',
  'shop',
  'store',
  'buy',
  'cart',
  'checkout',
  'search',
  'category',
  'categories',
  'collection',
  'collections',
  'c',
  's',
  'u',
  'us',
  'uk',
  'eu',
  'ip',
  'webapp',
  'app',
  'm',
  'mobile',
])

const CATEGORY_RULES: { category: Category; words: string[] }[] = [
  {
    category: 'clothing',
    words: [
      'shoe',
      'shoes',
      'sneaker',
      'boot',
      'jacket',
      'hoodie',
      'shirt',
      'tee',
      'dress',
      'jean',
      'pants',
      'trouser',
      'coat',
      'sock',
      'hat',
      'cap',
      'bag',
      'backpack',
      'watch-strap',
      'apparel',
      'clothing',
      'fashion',
      'nike',
      'adidas',
      'zara',
      'uniqlo',
      'h&m',
      'asos',
    ],
  },
  {
    category: 'tech',
    words: [
      'iphone',
      'ipad',
      'macbook',
      'airpods',
      'pixel',
      'galaxy',
      'laptop',
      'notebook',
      'keyboard',
      'mouse',
      'monitor',
      'headphone',
      'earbuds',
      'ssd',
      'gpu',
      'camera',
      'drone',
      'router',
      'charger',
      'usb',
      'bluetooth',
      'smartwatch',
      'watch',
      'console',
      'playstation',
      'xbox',
      'switch',
      'tech',
      'electronics',
      'apple',
      'samsung',
      'sony',
      'bose',
      'anker',
    ],
  },
  {
    category: 'home',
    words: [
      'sofa',
      'chair',
      'table',
      'lamp',
      'mattress',
      'pillow',
      'kitchen',
      'cookware',
      'blender',
      'vacuum',
      'cleaner',
      'desk',
      'shelf',
      'furniture',
      'ikea',
      'home',
      'decor',
      'bedding',
    ],
  },
  {
    category: 'hobby',
    words: [
      'guitar',
      'piano',
      'yoga',
      'bike',
      'bicycle',
      'camping',
      'fishing',
      'lego',
      'board-game',
      'puzzle',
      'sketch',
      'paint',
      'camera-lens',
      'triathlon',
      'running',
      'fitness',
      'gym',
      'hobby',
      'craft',
    ],
  },
]

const STORE_LABELS: Record<string, string> = {
  'amazon.com': 'Amazon',
  'amazon.co.uk': 'Amazon UK',
  'amazon.de': 'Amazon DE',
  'amazon.com.tr': 'Amazon TR',
  'amzn.to': 'Amazon',
  'apple.com': 'Apple',
  'store.steampowered.com': 'Steam',
  'nike.com': 'Nike',
  'adidas.com': 'Adidas',
  'ebay.com': 'eBay',
  'etsy.com': 'Etsy',
  'ikea.com': 'IKEA',
  'bestbuy.com': 'Best Buy',
  'walmart.com': 'Walmart',
  'target.com': 'Target',
  'mediamarkt.com.tr': 'MediaMarkt',
  'trendyol.com': 'Trendyol',
  'hepsiburada.com': 'Hepsiburada',
  'n11.com': 'n11',
  'teknosa.com': 'Teknosa',
  'zara.com': 'Zara',
  'asos.com': 'ASOS',
  'uniqlo.com': 'Uniqlo',
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function humanizeSlug(raw: string): string {
  let s = decodeURIComponent(raw)
  s = s.replace(/\.[a-z0-9]{2,5}$/i, '')
  s = s.replace(/[_+/]+/g, ' ')
  s = s.replace(/-+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // Drop trailing ids like 123456 or B0XXXX
  s = s.replace(/\b[a-z]?\d{5,}\b/gi, '').trim()
  s = s.replace(/\bB0[A-Z0-9]{8,}\b/gi, '').trim()
  return titleCase(s)
}

function isNoiseSegment(seg: string): boolean {
  const lower = seg.toLowerCase()
  if (!seg || seg.length < 2) return true
  if (NOISE_SEGMENTS.has(lower)) return true
  if (/^\d+$/.test(seg)) return true
  if (/^[a-f0-9]{8,}$/i.test(seg) && !/[aeiou]/i.test(seg)) return true
  if (/^B0[A-Z0-9]{8,}$/i.test(seg)) return true
  return false
}

function scoreCategory(text: string): { category: Category; hits: number } {
  const hay = text.toLowerCase()
  let best: Category = 'other'
  let bestHits = 0
  for (const rule of CATEGORY_RULES) {
    let hits = 0
    for (const w of rule.words) {
      if (hay.includes(w)) hits += 1
    }
    if (hits > bestHits) {
      bestHits = hits
      best = rule.category
    }
  }
  return { category: best, hits: bestHits }
}

function storeLabelForHost(host: string): string {
  const h = host.replace(/^www\./, '').toLowerCase()
  if (STORE_LABELS[h]) return STORE_LABELS[h]
  for (const [key, label] of Object.entries(STORE_LABELS)) {
    if (h.endsWith(key) || h.includes(key.split('.')[0]!)) {
      // prefer exact-ish
      if (h === key || h.endsWith('.' + key) || h.includes(key)) return label
    }
  }
  // Amazon regional
  if (h.includes('amazon.')) return 'Amazon'
  const base = h.split('.')[0] || h
  return titleCase(base)
}

/**
 * Infer product identity from a pasted commerce URL — no network / scraping.
 */
export function inferProductFromUrl(rawUrl: string): ProductInference | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (!/^https?:$/i.test(url.protocol)) return null

  const host = url.hostname.replace(/^www\./, '')
  const storeLabel = storeLabelForHost(host)
  const notes: string[] = [`Detected store: ${storeLabel}`]

  // Clean tracking noise for display / parsing
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
  }

  const segments = url.pathname
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && !isNoiseSegment(s))

  // Prefer query titles some shops use
  const qTitle =
    url.searchParams.get('title') ||
    url.searchParams.get('name') ||
    url.searchParams.get('product') ||
    url.searchParams.get('q')

  let name = ''
  if (qTitle && qTitle.length > 2 && qTitle.length < 120) {
    name = humanizeSlug(qTitle)
  }

  if (!name && segments.length) {
    // Longest human-looking segment usually is the product slug
    const ranked = [...segments].sort((a, b) => {
      const ha = /[a-z]/i.test(a) ? a.length : 0
      const hb = /[a-z]/i.test(b) ? b.length : 0
      return hb - ha || b.length - a.length
    })
    const pick = ranked.find((s) => /[a-z]{3}/i.test(s) && s.length >= 4) || ranked[0]
    if (pick) name = humanizeSlug(pick)
  }

  // Amazon dp/ASIN — try previous segment for name
  if ((!name || name.length < 4) && /amazon\./i.test(host)) {
    const parts = url.pathname.split('/').filter(Boolean)
    const dpIdx = parts.findIndex((p) => p === 'dp' || p === 'product')
    if (dpIdx > 0) name = humanizeSlug(parts[dpIdx - 1]!)
  }

  if (!name) {
    name = `${storeLabel} product`
    notes.push('Could not read a clear product name from the path — edit it.')
  } else {
    notes.push('Name inferred from the link path (no page scrape).')
  }

  const { category, hits } = scoreCategory(
    `${host} ${url.pathname} ${name} ${storeLabel}`.toLowerCase()
  )
  if (hits > 0) {
    notes.push(`Category lean: ${category}`)
  } else {
    notes.push('Category unclear — pick the closest fit.')
  }

  const confidence: ProductInference['confidence'] =
    hits >= 2 && name.length > 6 && !name.endsWith('product')
      ? 'high'
      : hits >= 1 || name.length > 8
        ? 'medium'
        : 'low'

  return {
    name,
    category,
    host,
    storeLabel,
    confidence,
    notes,
  }
}

export function looksLikeUrl(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^https?:\/\//i.test(v)) return true
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}/i.test(v)) return true
  return false
}
