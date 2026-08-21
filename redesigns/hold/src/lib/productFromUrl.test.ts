import { describe, expect, it } from 'vitest'
import { cleanProductName } from './cleanName'
import { extractBestPrice } from './extractPrice'
import { inferProductFromUrl } from './productFromUrl'
import { suggestAssessmentForProduct } from './suggestAssessment'

describe('cleanProductName', () => {
  it('strips Amazon marketing fluff to a short product name', () => {
    const n = cleanProductName(
      'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones with Auto Noise Canceling Optimizer, Crystal Clear Hands-Free Calling, Black + Free Shipping - Amazon'
    )
    expect(n.toLowerCase()).toContain('sony')
    expect(n.toLowerCase()).toContain('wh-1000xm5')
    expect(n.toLowerCase()).not.toContain('amazon')
    expect(n.toLowerCase()).not.toContain('industry leading')
    expect(n.length).toBeLessThan(70)
  })
})

describe('extractBestPrice', () => {
  it('prefers sale price over list price and ignores protection plans', () => {
    const text = `
Under $10
2-Year Protection Plan for $32.99
$248.00 with 38 percent savings
List Price: $399.99
$248.00
$399.99
`
    const r = extractBestPrice(text, 'USD')
    expect(r).not.toBeNull()
    expect(r!.price).toBe(248)
    expect(r!.currency).toBe('USD')
  })
})

describe('inferProductFromUrl', () => {
  it('reads Amazon headphones as audio', () => {
    const r = inferProductFromUrl(
      'https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones/dp/B09XS7JWHH?utm_source=x'
    )
    expect(r!.category).toBe('audio')
  })

  it('detects footwear from Nike path', () => {
    const r = inferProductFromUrl(
      'https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111'
    )
    expect(r!.category).toBe('footwear')
  })

  it('reads price from query string', () => {
    const r = inferProductFromUrl(
      'https://shop.example.com/item/cool-lamp?price=149.99&currency=EUR'
    )
    expect(r!.priceFromQuery).toBe(149.99)
  })
})

describe('suggestAssessmentForProduct', () => {
  it('suggests longer ownership for home vs clothing', () => {
    const home = suggestAssessmentForProduct({ category: 'home', name: 'Oak dining table' })
    const clothing = suggestAssessmentForProduct({
      category: 'clothing',
      name: 'Linen shirt',
    })
    expect(Number(home.ownershipYears)).toBeGreaterThan(Number(clothing.ownershipYears))
  })
})
