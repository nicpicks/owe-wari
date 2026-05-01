export const SUPPORTED_CURRENCIES = [
    'SGD', 'USD', 'AUD', 'EUR', 'JPY', 'KRW', 'MYR', 'IDR', 'VND',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: CurrencyCode = 'SGD'

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
    SGD: 'S$',
    USD: 'US$',
    AUD: 'A$',
    EUR: '€',
    JPY: '¥',
    KRW: '₩',
    MYR: 'RM',
    IDR: 'Rp',
    VND: '₫',
}

export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set([
    'JPY', 'KRW', 'VND', 'IDR',
])

export function isSupportedCurrency(code: string): code is CurrencyCode {
    return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
}
