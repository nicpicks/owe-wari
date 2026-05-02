/**
 * Returns a human-readable relative time string for `at`, anchored on `now`.
 * Tiers: "just now" (< 1 min), "Nm ago" (< 1h), "Nh ago" (< 24h),
 *        "yesterday" (< 48h), "Nd ago" (< 7d), "MMM d" (older).
 */
export function formatRelative(at: Date | string | number, now: Date = new Date()): string {
    const past = at instanceof Date ? at : new Date(at)
    const diffMs = now.getTime() - past.getTime()

    if (diffMs < 0) return 'just now'

    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour

    if (diffMs < minute) return 'just now'
    if (diffMs < hour) {
        const m = Math.floor(diffMs / minute)
        return `${m}m ago`
    }
    if (diffMs < day) {
        const h = Math.floor(diffMs / hour)
        return `${h}h ago`
    }
    if (diffMs < 2 * day) return 'yesterday'
    if (diffMs < 7 * day) {
        const d = Math.floor(diffMs / day)
        return `${d}d ago`
    }
    return past.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

/** ISO-like absolute timestamp suitable for tooltips. */
export function formatAbsolute(at: Date | string | number): string {
    const d = at instanceof Date ? at : new Date(at)
    return d.toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}
