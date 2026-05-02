import {
    CURRENCY_SYMBOLS,
    ZERO_DECIMAL_CURRENCIES,
    isSupportedCurrency,
} from './currencies'

export function formatAmount(amount: number, code: string): string {
    const isZeroDecimal = isSupportedCurrency(code) && ZERO_DECIMAL_CURRENCIES.has(code)
    const decimals = isZeroDecimal ? 0 : 2
    const symbol = isSupportedCurrency(code) ? CURRENCY_SYMBOLS[code] : ''
    const abs = Math.abs(amount)
    const formatted = abs.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })
    const sign = amount < 0 ? '-' : ''
    return `${sign}${symbol}${formatted}`
}

export function formatAmountWithCode(amount: number, code: string): string {
    return `${formatAmount(amount, code)} ${code}`
}
