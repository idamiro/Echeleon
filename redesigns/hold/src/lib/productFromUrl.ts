import type { Category } from '../scoring/types'

export interface ProductInference {
  name: string
  category: Category
  host: string
  storeLabel: string
  confidence: 'high' | 'medium' | 'low'
  notes: string[]
  priceFromQuery: number | null
  currencyFromQuery: string | null
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
  'tag',
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
  'tr',
  'de',
  'fr',
  'shop',
  'store',
  'buy',
  'cart',
  'search',
  'category',
  'categories',
  'collection',
  'collections',
  'c',
  's',
  'm',
  'mobile',
  't',
])

const CATEGORY_RULES: { category: Category; words: string[] }[] = [
  {
    category: 'footwear',
    words: ['shoe', 'shoes', 'sneaker', 'boot', 'boots', 'sandal', 'loafer', 'runner', 'trainer'],
  },
  {
    category: 'clothing',
    words: [
      'jacket',
      'hoodie',
      'shirt',
      'tee',
      'dress',
      'jean',
      'pants',
      'coat',
      'apparel',
      'fashion',
      'zara',
      'uniqlo',
      'asos',
    ],
  },
  {
    category: 'audio',
    words: [
      'headphone',
      'headphones',
      'earbud',
      'earbuds',
      'airpods',
      'speaker',
      'soundbar',
      'microphone',
      'bose',
      'sony-wh',
      'wh-1000',
    ],
  },
  {
    category: 'tech',
    words: [
      'iphone',
      'ipad',
      'macbook',
      'pixel',
      'galaxy',
      'laptop',
      'keyboard',
      'mouse',
      'monitor',
      'ssd',
      'gpu',
      'camera',
      'drone',
      'router',
      'charger',
      'smartwatch',
      'console',
      'playstation',
      'xbox',
      'apple',
      'samsung',
      'anker',
    ],
  },
  {
    category: 'kitchen',
    words: [
      'kitchen',
      'cookware',
      'blender',
      'knife',
      'toaster',
      'kettle',
      'espresso',
      'coffee',
      'pan',
      'skillet',
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
      'vacuum',
      'desk',
      'shelf',
      'furniture',
      'ikea',
      'bedding',
      'decor',
    ],
  },
  {
    category: 'beauty',
    words: [
      'serum',
      'skincare',
      'moisturizer',
      'perfume',
      'fragrance',
      'makeup',
      'shampoo',
      'beauty',
      'cosmetic',
    ],
  },
  {
    category: 'sports',
    words: [
      'yoga',
      'gym',
      'fitness',
      'dumbbell',
      'bike',
      'bicycle',
      'running',
      'football',
      'tennis',
      'sport',
    ],
  },
  {
    category: 'travel',
    words: ['luggage', 'suitcase', 'travel', 'backpack', 'passport', 'carry-on', 'packing'],
  },
  {
    category: 'hobby',
    words: ['guitar', 'piano', 'lego', 'puzzle', 'sketch', 'paint', 'camera-lens', 'craft', 'hobby'],
  },
  {
    category: 'digital',
    words: [
      'subscription',
      'premium',
      'saas',
      'license',
      'software',
      'membership',
      'notion',
      'adobe',
      'spotify',
      'netflix',
    ],
  },
]

const STORE_LABELS: Record<string, string> = {
  'amazon.com': 'Amazon',
  'amazon.co.uk': 'Amazon UK',
  'amazon.de': 'Amazon DE',
  'amazon.com.tr': 'Amazon TR',
  'apple.com': 'Apple',
  'nike.com': 'Nike',
  'adidas.com': 'Adidas',
  'ebay.com': 'eBay',
  'etsy.com': 'Etsy',
  'ikea.com': 'IKEA',
  'trendyol.com': 'Trendyol',
  'hepsiburada.com': 'Hepsiburada',
  'n11.com': 'n11',
  'mediamarkt.com.tr': 'MediaMarkt',
  'zara.com': 'Zara',
  'asos.com': 'ASOS',
  'sephora.com': 'Sephora',
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
  s = s.replace(/\b[a-z]?\d{5,}\b/gi, '').trim()
  s = s.replace(/\bB0[A-Z0-9]{8,}\b/gi, '').trim()
  return titleCase(s)
}

function isNoiseSegment(seg: string): boolean {
  const lower = seg.toLowerCase()
  if (!seg || seg.length < 2) return true
  if (NOISE_SEGMENTS.has(lower)) return true
  if (/^\d+$/.test(seg)) return true
  if (/^B0[A-Z0-9]{8,}$/i.test(seg)) return true
  return false
}

export function scoreCategory(text: string): { category: Category; hits: number } {
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
  if (h.includes('amazon.')) return 'Amazon'
  for (const [key, label] of Object.entries(STORE_LABELS)) {
    if (h.endsWith(key)) return label
  }
  return titleCase(h.split('.')[0] || h)
}

function parseQueryPrice(url: URL): { price: number | null; currency: string | null } {
  for (const key of ['price', 'amount', 'p', 'cost', 'value']) {
    const v = url.searchParams.get(key)
    if (!v) continue
    const n = Number(String(v).replace(/[^\d.]/g, ''))
    if (Number.isFinite(n) && n > 0) {
      const cur = url.searchParams.get('currency') || url.searchParams.get('cur')
      return {
        price: n,
        currency: cur && /^[a-z]{3}$/i.test(cur) ? cur.toUpperCase() : null,
      }
    }
  }
  return { price: null, currency: null }
}

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
  const qPrice = parseQueryPrice(url)

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
  }

  const segments = url.pathname
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && !isNoiseSegment(s))

  const qTitle =
    url.searchParams.get('title') ||
    url.searchParams.get('name') ||
    url.searchParams.get('product')

  let name = ''
  if (qTitle && qTitle.length > 2 && qTitle.length < 120) {
    name = humanizeSlug(qTitle)
  }

  if (!name && segments.length) {
    const ranked = [...segments].sort((a, b) => {
      const ha = /[a-z]/i.test(a) ? a.length : 0
      const hb = /[a-z]/i.test(b) ? b.length : 0
      return hb - ha || b.length - a.length
    })
    const pick = ranked.find((s) => /[a-z]{3}/i.test(s) && s.length >= 4) || ranked[0]
    if (pick) name = humanizeSlug(pick)
  }

  if ((!name || name.length < 4) && /amazon\./i.test(host)) {
    const parts = url.pathname.split('/').filter(Boolean)
    const dpIdx = parts.findIndex((p) => p === 'dp' || p === 'product')
    if (dpIdx > 0) name = humanizeSlug(parts[dpIdx - 1]!)
  }

  if (!name) {
    name = `${storeLabel} product`
    notes.push('Could not read a clear product name from the path — edit it.')
  } else {
    notes.push('Name inferred from the link.')
  }

  if (qPrice.price != null) {
    notes.push(`Price found in link parameters: ${qPrice.price}`)
  }

  const { category, hits } = scoreCategory(`${host} ${url.pathname} ${name} ${storeLabel}`)
  if (hits > 0) notes.push(`Category lean: ${category}`)
  else notes.push('Category unclear — pick the closest fit.')

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
    priceFromQuery: qPrice.price,
    currencyFromQuery: qPrice.currency,
  }
}

export function looksLikeUrl(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^https?:\/\//i.test(v)) return true
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}/i.test(v)) return true
  return false
}
