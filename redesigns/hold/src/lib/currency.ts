/** Broad currency list — not limited to EUR/USD/GBP */
export const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'TRY',
  'CAD',
  'AUD',
  'CHF',
  'JPY',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'HRK',
  'RSD',
  'UAH',
  'RUB',
  'INR',
  'CNY',
  'KRW',
  'SGD',
  'HKD',
  'TWD',
  'THB',
  'MYR',
  'IDR',
  'PHP',
  'VND',
  'AED',
  'SAR',
  'ILS',
  'ZAR',
  'BRL',
  'MXN',
  'ARS',
  'CLP',
  'COP',
  'NZD',
] as const

const LOCALE_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  TR: 'TRY',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF',
  JP: 'JPY',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  BG: 'BGN',
  HR: 'EUR',
  RS: 'RSD',
  UA: 'UAH',
  RU: 'RUB',
  IN: 'INR',
  CN: 'CNY',
  KR: 'KRW',
  SG: 'SGD',
  HK: 'HKD',
  TW: 'TWD',
  TH: 'THB',
  MY: 'MYR',
  ID: 'IDR',
  PH: 'PHP',
  VN: 'VND',
  AE: 'AED',
  SA: 'SAR',
  IL: 'ILS',
  ZA: 'ZAR',
  BR: 'BRL',
  MX: 'MXN',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
}

export function defaultCurrencyFromLocale(locale = detectLocale()): string {
  try {
    const parts = locale.replace('_', '-').split('-')
    const region = (parts[1] || parts[0] || '').toUpperCase()
    if (LOCALE_CURRENCY[region]) return LOCALE_CURRENCY[region]
    // Intl may expose currency for some locales
    const opts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
    }).resolvedOptions()
    if (opts.currency) return opts.currency
  } catch {
    /* fall through */
  }
  return 'USD'
}

export function detectLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }
  return 'en-US'
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount < 10 && amount % 1 !== 0 ? 2 : amount < 100 ? 2 : 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code)
}
