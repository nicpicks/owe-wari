'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '~/trpc/react'
import { CURRENCY_SYMBOLS, isSupportedCurrency } from '~/lib/currencies'
import { baselineRate, formatRate, resolveRate, type GroupRate } from '~/lib/fx-rates'
import { formatRelative } from '~/lib/format-date'

interface Props {
    groupId: string
    defaultCurrency: string
    /** Non-default currencies with money still moving through them. */
    activeCodes: string[]
}

function symbolFor(code: string): string {
    return isSupportedCurrency(code) ? CURRENCY_SYMBOLS[code] : code
}

export default function ConversionRateCard({ groupId, defaultCurrency, activeCodes }: Props) {
    const utils = api.useUtils()
    const { data: rates } = api.group.getRates.useQuery({ groupId }, { enabled: !!groupId })
    const { data: currencies } = api.group.getCurrencies.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const [editing, setEditing] = useState<string | null>(null)

    const enabledForeign = useMemo(
        () => (currencies ?? []).filter((c) => !c.isDefault).map((c) => c.code),
        [currencies]
    )

    // Quote the currencies actually in play plus any the group has already
    // pinned a rate for; the rest stay behind an "add" affordance.
    const quoted = useMemo(() => {
        const saved = new Set((rates ?? []).map((r) => r.code))
        const shown = enabledForeign.filter((c) => saved.has(c) || activeCodes.includes(c))
        return shown.sort((a, b) => {
            const aActive = activeCodes.includes(a) ? 0 : 1
            const bActive = activeCodes.includes(b) ? 0 : 1
            return aActive - bActive || a.localeCompare(b)
        })
    }, [enabledForeign, rates, activeCodes])

    const addable = enabledForeign.filter((c) => !quoted.includes(c))

    if (enabledForeign.length === 0) return null

    return (
        <>
            <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                {/* Amber corner glow */}
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        top: '-40px',
                        right: '-40px',
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, var(--amber-dim), transparent 70%)',
                        pointerEvents: 'none',
                    }}
                />

                <div style={{ marginBottom: quoted.length > 0 ? '1.25rem' : '0.75rem' }}>
                    <div className="section-title">
                        <span aria-hidden style={{ color: 'var(--amber)', marginRight: '0.5rem' }}>換</span>
                        Conversion rate
                    </div>
                    <div className="section-sub">
                        Everything settles in {defaultCurrency} at the rate you set here
                    </div>
                </div>

                {quoted.map((code, i) => {
                    const saved = rates?.find((r) => r.code === code)
                    const { rate, isCustom } = resolveRate(defaultCurrency, code, rates)
                    const inverse = rate ? 1 / rate : 0
                    return (
                        <div
                            key={code}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem',
                                paddingTop: i === 0 ? 0 : '0.9375rem',
                                marginTop: i === 0 ? 0 : '0.9375rem',
                                borderTop: i === 0 ? 'none' : '1px dashed var(--border)',
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                {/* Hero quote. A rupiah rate is five digits before
                                    the decimals, so the type scales with the screen
                                    and folds after the "=" rather than running under
                                    the Edit button. */}
                                <div
                                    style={{
                                        fontFamily: 'var(--font-display), serif',
                                        fontSize: 'clamp(1.375rem, 6vw, 2rem)',
                                        fontWeight: 600,
                                        color: 'var(--heading)',
                                        letterSpacing: '-0.02em',
                                        lineHeight: 1.1,
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'baseline',
                                        columnGap: '0.4375rem',
                                    }}
                                >
                                    <span>{symbolFor(defaultCurrency)}1</span>
                                    <span style={{ color: 'var(--muted)' }}>=</span>
                                    <span style={{ color: 'var(--amber)' }}>
                                        {symbolFor(code)}
                                        {formatRate(rate)}
                                    </span>
                                </div>
                                <div
                                    className="font-mono"
                                    style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}
                                >
                                    {symbolFor(code)}1 = {symbolFor(defaultCurrency)}
                                    {formatRate(inverse)}
                                    {' · '}
                                    {isCustom && saved?.updatedAt
                                        ? `set ${formatRelative(saved.updatedAt)}`
                                        : 'estimate — tap to set'}
                                </div>
                            </div>

                            <button
                                type="button"
                                className="btn-sm-settle"
                                style={{
                                    background: 'var(--amber-dim)',
                                    color: 'var(--amber)',
                                    borderColor: 'var(--amber)',
                                    flexShrink: 0,
                                }}
                                onClick={() => setEditing(code)}
                            >
                                {isCustom ? '編 Edit' : '編 Set'}
                            </button>
                        </div>
                    )
                })}

                {addable.length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: quoted.length > 0 ? '1.125rem' : 0,
                            paddingTop: quoted.length > 0 ? '0.9375rem' : 0,
                            borderTop: quoted.length > 0 ? '1px dashed var(--border)' : 'none',
                        }}
                    >
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Add a rate for</span>
                        {addable.map((code) => (
                            <button
                                key={code}
                                type="button"
                                className="badge"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setEditing(code)}
                            >
                                + {code}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {editing && (
                <RateEditor
                    groupId={groupId}
                    defaultCurrency={defaultCurrency}
                    code={editing}
                    saved={rates?.find((r) => r.code === editing)?.rate}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        await utils.group.getRates.invalidate({ groupId })
                        setEditing(null)
                    }}
                />
            )}
        </>
    )
}

function RateEditor({
    groupId,
    defaultCurrency,
    code,
    saved,
    onClose,
    onSaved,
}: {
    groupId: string
    defaultCurrency: string
    code: string
    saved: number | undefined
    onClose: () => void
    onSaved: () => Promise<void>
}) {
    const [value, setValue] = useState(() =>
        formatRate(saved ?? baselineRate(defaultCurrency, code))
    )

    useEffect(() => {
        setValue(formatRate(saved ?? baselineRate(defaultCurrency, code)))
    }, [saved, defaultCurrency, code])

    const parsed = parseFloat(value)
    const valid = Number.isFinite(parsed) && parsed > 0

    const setRate = api.group.setRate.useMutation({
        onSuccess: onSaved,
        onError: (error) => {
            console.error('Error saving rate:', error)
            alert(error.message || 'Failed to save the conversion rate')
        },
    })

    const deleteRate = api.group.deleteRate.useMutation({
        onSuccess: onSaved,
        onError: (error) => {
            console.error('Error clearing rate:', error)
            alert('Failed to clear the conversion rate')
        },
    })

    const busy = setRate.isPending || deleteRate.isPending

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="card-dark modal-card"
                style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}
            >
                <div className="section-title" style={{ marginBottom: '0.25rem' }}>
                    {defaultCurrency} → {code}
                </div>
                <div className="section-sub" style={{ marginBottom: '1.25rem' }}>
                    How many {code} one {defaultCurrency} buys. Every {code} debt is shown
                    in {defaultCurrency} at this rate.
                </div>

                <div className="field-group">
                    <label className="field-label" htmlFor="rate-input">
                        {symbolFor(defaultCurrency)}1 equals
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span
                            style={{
                                fontFamily: 'var(--font-display), serif',
                                fontSize: '1.5rem',
                                color: 'var(--amber)',
                                flexShrink: 0,
                            }}
                        >
                            {symbolFor(code)}
                        </span>
                        <input
                            id="rate-input"
                            className="field-input no-spinner font-mono"
                            type="number"
                            step="0.0001"
                            min="0"
                            inputMode="decimal"
                            autoFocus
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && valid && !busy) {
                                    setRate.mutate({ groupId, code, rate: parsed })
                                }
                            }}
                            style={{ fontSize: '1.25rem' }}
                        />
                    </div>
                </div>

                <div
                    className="font-mono"
                    style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.75rem' }}
                >
                    {valid
                        ? `${symbolFor(code)}1 = ${symbolFor(defaultCurrency)}${formatRate(1 / parsed)}`
                        : 'Enter a rate greater than zero'}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-amber"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={!valid || busy}
                        onClick={() => setRate.mutate({ groupId, code, rate: parsed })}
                    >
                        {setRate.isPending ? 'Saving…' : '記 Save rate'}
                    </button>
                </div>

                {saved != null && (
                    <button
                        type="button"
                        onClick={() => deleteRate.mutate({ groupId, code })}
                        disabled={busy}
                        style={{
                            marginTop: '0.875rem',
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            color: 'var(--muted)',
                            fontSize: '0.75rem',
                            cursor: busy ? 'not-allowed' : 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        {deleteRate.isPending ? 'Clearing…' : 'Clear and use the estimate'}
                    </button>
                )}
            </div>
        </div>
    )
}
