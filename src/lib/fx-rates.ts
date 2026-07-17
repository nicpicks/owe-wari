import type { CurrencyCode } from './currencies'

// Approximate rates "1 unit of FROM = N units of TO".
// Hardcoded baseline; settle-up UI lets the user edit before confirming.
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
