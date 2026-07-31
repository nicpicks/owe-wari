'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { CURRENCY_SYMBOLS, isSupportedCurrency } from '~/lib/currencies'
import { formatRate, resolveRate, type GroupRate } from '~/lib/fx-rates'

interface SettleLine {
    currency: string
    amount: number
}

interface Props {
    open: boolean
    groupId: string
    fromName: string
    toName: string
    defaultCurrency: string
    /** Rates the group agreed on; used to prefill each line. */
    savedRates: GroupRate[] | undefined
    lines: SettleLine[]
    onClose: () => void
    onConfirm: (lines: SettleLine[]) => void
    isSubmitting: boolean
}

function symbolFor(code: string): string {
    return isSupportedCurrency(code) ? CURRENCY_SYMBOLS[code] : code
}

export default function SettleUpModal({
    open,
    groupId,
    fromName,
    toName,
    defaultCurrency,
    savedRates,
    lines,
    onClose,
    onConfirm,
    isSubmitting,
}: Props) {
    // rates[code] = units of `code` per 1 unit of defaultCurrency (same
    // direction the group's saved rate is stored in)
    const [rates, setRates] = useState<Record<string, number>>({})

    useEffect(() => {
        const next: Record<string, number> = {}
        for (const line of lines) {
            if (line.currency === defaultCurrency) continue
            next[line.currency] = resolveRate(defaultCurrency, line.currency, savedRates).rate
        }
        setRates(next)
    }, [lines, defaultCurrency, savedRates])

    const total = useMemo(() => {
        let sum = 0
        for (const line of lines) {
            if (line.currency === defaultCurrency) {
                sum += line.amount
                continue
            }
            const rate = rates[line.currency]
            sum += rate ? line.amount / rate : line.amount
        }
        return sum
    }, [lines, rates, defaultCurrency])

    const utils = api.useUtils()
    const setRate = api.group.setRate.useMutation({
        onSuccess: async () => {
            await utils.group.getRates.invalidate({ groupId })
        },
        onError: (error) => {
            console.error('Error saving rate:', error)
            alert(error.message || 'Failed to save the conversion rate')
        },
    })

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="card-dark modal-card"
                style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}
            >
                <div className="section-title" style={{ marginBottom: '0.25rem' }}>
                    Settle with {toName}
                </div>
                <div className="section-sub" style={{ marginBottom: '1.25rem' }}>
                    {fromName} pays {toName}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {lines.map((line) => {
                        const isDefault = line.currency === defaultCurrency
                        const rate = rates[line.currency] ?? 1
                        const converted = rate ? line.amount / rate : line.amount
                        const groupRate = resolveRate(defaultCurrency, line.currency, savedRates)
                        // Only worth offering when the typed rate is a real change
                        const differsFromGroup =
                            !isDefault && rate > 0 && Math.abs(rate - groupRate.rate) > 1e-9
                        return (
                            <div
                                key={line.currency}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.375rem',
                                    padding: '0.75rem',
                                    background: 'var(--surface-2)',
                                    borderRadius: '6px',
                                }}
                            >
                                <div className="font-mono" style={{ fontSize: '0.9375rem', color: 'var(--heading)' }}>
                                    {formatAmount(line.amount, line.currency)} {line.currency}
                                </div>
                                {!isDefault && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                                            <span>
                                                {symbolFor(defaultCurrency)}1 =
                                            </span>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                inputMode="decimal"
                                                value={rate}
                                                onChange={(e) =>
                                                    setRates((prev) => ({
                                                        ...prev,
                                                        [line.currency]: parseFloat(e.target.value) || 0,
                                                    }))
                                                }
                                                style={{
                                                    width: '90px',
                                                    padding: '0.125rem 0.375rem',
                                                    background: 'var(--surface-3)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--body)',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: '0.75rem',
                                                }}
                                            />
                                            <span>
                                                {line.currency} → {formatAmount(converted, defaultCurrency)}{' '}
                                                {defaultCurrency}
                                            </span>
                                        </div>
                                        {differsFromGroup && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setRate.mutate({
                                                        groupId,
                                                        code: line.currency,
                                                        rate,
                                                    })
                                                }
                                                disabled={setRate.isPending}
                                                style={{
                                                    alignSelf: 'flex-start',
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    color: 'var(--amber)',
                                                    fontSize: '0.6875rem',
                                                    cursor: setRate.isPending ? 'not-allowed' : 'pointer',
                                                    textDecoration: 'underline',
                                                }}
                                            >
                                                {setRate.isPending
                                                    ? 'Saving…'
                                                    : `Save ${formatRate(rate)} as the group rate`}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div
                    style={{
                        marginTop: '1.25rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                    }}
                >
                    <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Total to pay</span>
                    <span className="font-mono" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--amber)' }}>
                        {formatAmount(total, defaultCurrency)} {defaultCurrency}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <button type="button" className="btn-ghost" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-amber"
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={isSubmitting}
                        onClick={() => onConfirm(lines)}
                    >
                        {isSubmitting ? 'Settling…' : '済 Confirm'}
                    </button>
                </div>
            </div>
        </div>
    )
}
