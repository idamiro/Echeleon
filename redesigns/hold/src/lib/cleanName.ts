/** Clean noisy commerce titles down to a product name only */

const STORE_SUFFIX =
  /\s*[-–—|·]\s*(Amazon(?:\.[a-z.]+)?|Nike|Adidas|Apple|eBay|Etsy|IKEA|Trendyol|Hepsiburada|Zara|ASOS|Best Buy|Walmart|Target|MediaMarkt|Sephora)\s*$/i

const JUNK_PHRASES =
  /\b(free shipping|ship to|add to cart|buy now|limited time|industry leading|crystal clear|auto noise canceling optimizer|hands-?free calling|percent savings|best seller|amazon'?s?\s*choice|climate pledge)\b/gi

export function cleanProductName(raw: string): string {
  let s = raw.trim()
  if (!s) return ''

  // Markdown / URL debris
  s = s.replace(/!\[[^\]]*]/g, '')
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  s = s.replace(/https?:\/\/\S+/gi, '')
  s = s.replace(/\s+/g, ' ').trim()

  s = s.replace(STORE_SUFFIX, '').trim()
  s = s.replace(/\s*\+\s*Free Shipping.*$/i, '').trim()
  s = s.replace(JUNK_PHRASES, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  // "Brand Model — long marketing blurb" → keep left of em dash if left is short enough
  for (const sep of [' — ', ' – ', ' | ', ' - ']) {
    const i = s.indexOf(sep)
    if (i > 8 && i < 64) {
      const left = s.slice(0, i).trim()
      if (left.split(' ').length <= 10) {
        s = left
        break
      }
    }
  }

  // "Sony WH-1000XM5 Wireless Industry Leading..." → cut after model-ish token cluster
  const modelCut = s.match(
    /^((?:[A-Z][a-zA-Z0-9.&]+\s+){0,3}(?:[A-Z0-9][A-Z0-9.\-/]{2,}|[A-Za-z]+(?:\s[A-Z0-9][A-Z0-9.\-/]{2,})+)\s*(?:Wireless|Bluetooth|Noise[\s-]?Cancel(?:ing|ling)|Headphones?|Earbuds?|Shoes?|Sneakers?|Watch|Laptop|Phone|Case)?)/
  )
  if (modelCut?.[1] && modelCut[1].length >= 8 && modelCut[1].length < s.length) {
    const candidate = modelCut[1].trim()
    if (candidate.length >= 10 && candidate.length <= 72) s = candidate
  }

  // Hard cap — prefer readable product name
  if (s.length > 72) {
    const clipped = s.slice(0, 72)
    const lastSpace = clipped.lastIndexOf(' ')
    s = (lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()
  }

  // Drop trailing commas / connectors
  s = s.replace(/[,:;|/]+$/g, '').trim()
  return s
}
