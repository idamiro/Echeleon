import { describe, expect, it } from 'vitest'
import { extractPriceFromText } from './enrichProduct'
import { inferProductFromUrl } from './productFromUrl'
import { suggestAssessmentForProduct } from './suggestAssessment'

describe('inferProductFromUrl', () => {
  it('reads an Amazon-style slug and leans audio for headphones', () => {
    const r = inferProductFromUrl(
      'https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones/dp/B09XS7JWHH?utm_source=x'
    )
    expect(r).not.toBeNull()
    expect(r!.name.toLowerCase()).toContain('sony')
    expect(r!.category).toBe('audio')
    expect(r!.storeLabel).toMatch(/Amazon/i)
  })

  it('detects footwear from Nike path', () => {
    const r = inferProductFromUrl(
      'https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111'
    )
    expect(r).not.toBeNull()
    expect(r!.category).toBe('footwear')
  })

  it('reads price from query string', () => {
    const r = inferProductFromUrl('https://shop.example.com/item/cool-lamp?price=149.99&currency=EUR')
    expect(r!.priceFromQuery).toBe(149.99)
    expect(r!.currencyFromQuery).toBe('EUR')
  })

  it('returns null for garbage', () => {
    expect(inferProductFromUrl('not a url')).toBeNull()
  })
})

describe('extractPriceFromText', () => {
  it('finds euro prices', () => {
    const r = extractPriceFromText('Now only €229.00 — free shipping')
    expect(r.price).toBe(229)
    expect(r.currency).toBe('EUR')
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

  it('leans daily for phone-like tech', () => {
    const s = suggestAssessmentForProduct({
      category: 'tech',
      name: 'iPhone 16 Pro',
    })
    expect(s.frequency).toBe('daily')
  })
})
