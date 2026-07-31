import type { CurrencyCode } from './currencies'

// Approximate rates "1 unit of FROM = N units of TO".
// Hardcoded baseline; a group can save its own rate, and the settle-up UI
// lets the user tweak it before confirming.
const RATES: Partial<Record<CurrencyCode, Partial<Record<CurrencyCode, number>>>> = {
    SGD: { USD: 0.74, AUD: 1.13, EUR: 0.69, GBP: 0.58, JPY: 110, CNY: 5.4, HKD: 5.8, TWD: 24, KRW: 1020, THB: 24.5, MYR: 3.5, IDR: 12000, PHP: 43, VND: 18500, INR: 64 },
    USD: { SGD: 1.35 },
    AUD: { SGD: 0.88 },
    EUR: { SGD: 1.45 },
    GBP: { SGD: 1.72 },
    JPY: { SGD: 0.0091 },
    CNY: { SGD: 0.185 },
    HKD: { SGD: 0.172 },
    TWD: { SGD: 0.042 },
    KRW: { SGD: 0.00098 },
    THB: { SGD: 0.041 },
    MYR: { SGD: 0.29 },
    IDR: { SGD: 0.0000833 },
    PHP: { SGD: 0.023 },
    VND: { SGD: 0.000054 },
    INR: { SGD: 0.0156 },
}

export function getDefaultRate(from: string, to: string): number {
    if (from === to) return 1
    const direct = RATES[from as CurrencyCode]?.[to as CurrencyCode]
    if (direct != null) return direct
    const inverse = RATES[to as CurrencyCode]?.[from as CurrencyCode]
    if (inverse != null) return 1 / inverse
    return 1
}

/**
 * Rates in this app are always quoted per unit of the group's default
 * currency: `rate` is how many units of `code` one unit of the default buys.
 * With default SGD, MYR sits at ~3.5 — "S$1 = RM3.50".
 */
export interface GroupRate {
    code: string
    rate: number
}

/** The baseline quote for `code`, in the per-default-unit direction. */
export function baselineRate(defaultCurrency: string, code: string): number {
    return getDefaultRate(defaultCurrency, code)
}

export interface ResolvedRate {
    rate: number
    /** True when the group saved this rate, false when it came from the baseline table. */
    isCustom: boolean
}

export function resolveRate(
    defaultCurrency: string,
    code: string,
    saved: GroupRate[] | undefined
): ResolvedRate {
    if (code === defaultCurrency) return { rate: 1, isCustom: false }
    const match = saved?.find((r) => r.code === code)
    if (match && match.rate > 0) return { rate: match.rate, isCustom: true }
    return { rate: baselineRate(defaultCurrency, code), isCustom: false }
}

/** Convert `amount` of `code` into the group's default currency. */
export function toDefaultCurrency(
    amount: number,
    code: string,
    defaultCurrency: string,
    saved: GroupRate[] | undefined
): number {
    if (code === defaultCurrency) return amount
    const { rate } = resolveRate(defaultCurrency, code, saved)
    if (!rate) return amount
    return amount / rate
}

/**
 * Render a rate as a money-like figure. Small quotes (an SGD-per-IDR of
 * 0.0000833) need far more precision than large ones, so the decimal ceiling
 * slides with magnitude while every quote keeps at least two decimals.
 */
export function formatRate(rate: number): string {
    // No thousands separators — this string also seeds a number input
    if (rate > 0 && rate < 1) {
        // Sub-1 quotes span orders of magnitude (SGD per MYR is 0.29, per IDR
        // is 0.0000833), so count significant digits rather than decimals.
        return rate.toLocaleString('en-US', {
            maximumSignificantDigits: 4,
            useGrouping: false,
        })
    }
    return rate.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: rate >= 100 ? 2 : 4,
        useGrouping: false,
    })
}
