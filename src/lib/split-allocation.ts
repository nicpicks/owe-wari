/**
 * Split `total` across `weights` proportionally, in whole cents.
 *
 * Weights are relative, so they work for portions (1, 2, 0.5 …) and for
 * percentages (25, 25, 50) alike. Uses the largest-remainder method: every
 * share is floored to a cent, then the leftover cents go to the largest
 * fractional parts first. The returned amounts therefore always sum to
 * `total` rounded to the nearest cent — no drift between an expense and the
 * sum of its splits.
 *
 * Non-positive weights get 0, and a run of all-zero weights returns all zeros.
 */
export function allocateByWeight(total: number, weights: number[]): number[] {
    const safeWeights = weights.map((w) => (isFinite(w) && w > 0 ? w : 0))
    const totalWeight = safeWeights.reduce((s, w) => s + w, 0)
    const totalCents = isFinite(total) ? Math.round(total * 100) : 0
    if (totalWeight <= 0 || totalCents <= 0) return weights.map(() => 0)

    const parts = safeWeights.map((weight, i) => {
        const exact = (totalCents * weight) / totalWeight
        return { i, weight, floor: Math.floor(exact), frac: exact - Math.floor(exact) }
    })

    // Biggest fraction first; ties broken by weight, then by position, so the
    // same inputs always produce the same allocation.
    const order = parts
        .filter((p) => p.weight > 0)
        .sort((a, b) => b.frac - a.frac || b.weight - a.weight || a.i - b.i)

    const extra = new Array<number>(parts.length).fill(0)
    let leftover = totalCents - parts.reduce((s, p) => s + p.floor, 0)
    for (let k = 0; leftover > 0 && order.length > 0; k++, leftover--) {
        const target = order[k % order.length]!
        extra[target.i] = (extra[target.i] ?? 0) + 1
    }

    return parts.map((p, i) => (p.floor + (extra[i] ?? 0)) / 100)
}

/**
 * Percentages that split `count` ways as evenly as two decimal places allow
 * (e.g. 3 → [33.33, 33.33, 33.34]). Always sums to exactly 100.
 */
export function evenPercents(count: number): number[] {
    if (count <= 0) return []
    return allocateByWeight(100, new Array<number>(count).fill(1))
}
