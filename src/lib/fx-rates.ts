import type { CurrencyCode } from './currencies'

// Approximate rates "1 unit of FROM = N units of TO".
// Hardcoded baseline; settle-up UI lets the user edit before confirming.
const RATES: Partial<Record<CurrencyCode, Partial<Record<CurrencyCode, number>>>> = {
    SGD: { USD: 0.74, AUD: 1.13, EUR: 0.69, JPY: 110, KRW: 1020, MYR: 3.5, IDR: 12000, VND: 18500 },
    USD: { SGD: 1.35 },
    AUD: { SGD: 0.88 },
    EUR: { SGD: 1.45 },
    JPY: { SGD: 0.0091 },
    KRW: { SGD: 0.00098 },
    MYR: { SGD: 0.29 },
    IDR: { SGD: 0.0000833 },
    VND: { SGD: 0.000054 },
}

export function getDefaultRate(from: string, to: string): number {
    if (from === to) return 1
    const direct = RATES[from as CurrencyCode]?.[to as CurrencyCode]
    if (direct != null) return direct
    const inverse = RATES[to as CurrencyCode]?.[from as CurrencyCode]
    if (inverse != null) return 1 / inverse
    return 1
}
