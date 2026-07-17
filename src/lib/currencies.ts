export const SUPPORTED_CURRENCIES = [
    'SGD', 'USD', 'AUD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'TWD', 'KRW',
    'THB', 'MYR', 'IDR', 'PHP', 'VND', 'INR',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: CurrencyCode = 'SGD'

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
    SGD: 'S$',
    USD: 'US$',
    AUD: 'A$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    HKD: 'HK$',
    TWD: 'NT$',
    KRW: '₩',
    THB: '฿',
    MYR: 'RM',
    IDR: 'Rp',
    PHP: '₱',
    VND: '₫',
    INR: '₹',
}

export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set([
    'JPY', 'KRW', 'VND', 'IDR',
])

export function isSupportedCurrency(code: string): code is CurrencyCode {
    return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
}
