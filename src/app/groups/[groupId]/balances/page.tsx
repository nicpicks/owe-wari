'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Tabs from '~/app/_components/tabs'
import SettleUpModal from '~/app/_components/settle-up-modal'
import ConversionRateCard from '~/app/_components/conversion-rate-card'
import Kamifubuki from '~/app/_components/kamifubuki'
import { api } from '~/trpc/react'
import {
    netBalances,
    simplifyDebts,
    simplifyHouseholdDebts,
    type Balance,
    type Household,
} from '~/lib/simplify-debts'
import { formatAmount } from '~/lib/format-currency'
import { fromDefaultCurrency, type GroupRate } from '~/lib/fx-rates'

interface PendingSettle {
    fromUserId: string
    fromName: string
    toUserId: string
    toName: string
    note?: string
    lines: { currency: string; amount: number }[]
}

const householdPrefKey = (groupId: string) => `owe-wari:settle-by-household:${groupId}`

/**
 * The whole pipeline in one place: fold every currency into the settle
 * currency, then simplify — over households when they are in play, over
 * people otherwise.
 */
function transfersFor(
    balances: Balance[] | undefined,
    settleCurrency: string,
    rates: GroupRate[] | undefined,
    households: Household[] | null
) {
    const netted = netBalances(balances ?? [], settleCurrency, rates)
    return households ? simplifyHouseholdDebts(netted, households) : simplifyDebts(netted)
}

const BalancesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => router.push(`/groups/${groupId}/${tab}`)

    const utils = api.useUtils()

    const { data: balances, isLoading, isError, error } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    const { data: group } = api.group.getGroup.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    const { data: rates } = api.group.getRates.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    const { data: households } = api.group.getHouseholds.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    // Only to tell "everything is paid off" apart from "nothing was ever
    // spent" — a brand new group has no debts to celebrate clearing.
    const { data: totals } = api.expense.getTotalExpenseCost.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const defaultCurrency = group?.currency ?? 'SGD'

    // Foreign currencies with money still outstanding — the ones worth quoting
    const activeCodes = useMemo(() => {
        if (!balances) return []
        return Array.from(
            new Set(
                balances
                    .filter((b) => b.currency !== defaultCurrency && Math.abs(b.netBalance) > 0.005)
                    .map((b) => b.currency)
            )
        )
    }, [balances, defaultCurrency])

    const [pending, setPending] = useState<PendingSettle | null>(null)
    // Pairs settled during this visit — kept on screen, dimmed, with a 済 stamp
    const [justSettled, setJustSettled] = useState<
        { key: string; fromName: string; toName: string; amountStr: string }[]
    >([])

    // Households are the group's agreement, so the switch defaults to on once
    // any exist; turning it off is a per-device peek at the individual books.
    const [householdPref, setHouseholdPref] = useState<boolean | null>(null)
    useEffect(() => {
        if (!groupId) return
        try {
            setHouseholdPref(window.localStorage.getItem(householdPrefKey(groupId)) !== 'off')
        } catch {
            setHouseholdPref(true)
        }
    }, [groupId])

    const hasHouseholds = (households?.length ?? 0) > 0
    const byHousehold = hasHouseholds && householdPref !== false

    const setByHousehold = (next: boolean) => {
        setHouseholdPref(next)
        try {
            window.localStorage.setItem(householdPrefKey(groupId), next ? 'on' : 'off')
        } catch {
            /* ignore quota / private mode errors */
        }
    }

    // Fires only on the settlement that clears the board — never on merely
    // opening a group that was already square.
    const [celebrating, setCelebrating] = useState(false)

    const settleUp = api.expense.settleUp.useMutation({
        onSuccess: async (_data, vars) => {
            if (pending) {
                setJustSettled((prev) => [
                    ...prev,
                    {
                        key: `${vars.payerId}|${vars.receiverId}`,
                        fromName: pending.fromName,
                        toName: pending.toName,
                        amountStr: vars.lines
                            .map((l) => formatAmount(l.amount, l.currency))
                            .join(' + '),
                    },
                ])
            }
            await utils.expense.getBalances.invalidate({ groupId })
            const fresh = utils.expense.getBalances.getData({ groupId })
            const left = transfersFor(
                fresh,
                defaultCurrency,
                rates,
                byHousehold ? households ?? [] : null
            )
            if (left.length === 0) setCelebrating(true)
            setPending(null)
        },
        onError: (error) => {
            console.error('Error settling up:', error)
            alert('Failed to settle up')
            setPending(null)
        },
    })

    const soloTransfers = useMemo(
        () => transfersFor(balances, defaultCurrency, rates, null),
        [balances, defaultCurrency, rates]
    )
    const householdTransfers = useMemo(
        () => (hasHouseholds ? transfersFor(balances, defaultCurrency, rates, households ?? []) : []),
        [balances, defaultCurrency, rates, households, hasHouseholds]
    )
    const transfers = byHousehold ? householdTransfers : soloTransfers
    const saved = soloTransfers.length - householdTransfers.length

    const hasSpending = !!totals && (totals.defaultTotal > 0 || totals.otherTotals.length > 0)
    const nothingLeft = !isLoading && !isError && !!totals && transfers.length === 0
    const isSettled = nothingLeft && hasSpending
    const isFreshGroup = nothingLeft && !hasSpending
    // Households square up between themselves at home; say so rather than
    // claiming every individual book is at zero.
    const restIsAtHome = isSettled && byHousehold && soloTransfers.length > 0

    const openTransfers = new Set(transfers.map((t) => `${t.from}|${t.to}`))
    const stampedRows = justSettled.filter((s) => !openTransfers.has(s.key))

    // With one foreign currency still live, quoting the cash equivalent saves
    // the payer doing the sum at the ATM.
    const cashCode = activeCodes.length === 1 ? activeCodes[0]! : null

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                {/* Agreed conversion rate — drives every converted figure below */}
                <ConversionRateCard
                    groupId={groupId}
                    defaultCurrency={defaultCurrency}
                    activeCodes={activeCodes}
                />

                {/* Who owes whom — one row per (from, to) pair with an inline Settle CTA */}
                <div className="card-dark anim-fade-up d-0">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Who owes whom</div>
                        {(isLoading || isError || transfers.length > 0) && (
                            <div className="section-sub">
                                {isLoading
                                    ? 'Loading…'
                                    : isError
                                        ? 'Could not load — try refreshing'
                                        : `${transfers.length} transfer${transfers.length !== 1 ? 's' : ''} to settle · tap to stamp it paid`}
                            </div>
                        )}

                        {hasHouseholds && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.625rem',
                                    flexWrap: 'wrap',
                                    marginTop: '0.75rem',
                                }}
                            >
                                <div
                                    role="group"
                                    aria-label="Settle as"
                                    style={{
                                        display: 'flex',
                                        border: '1px solid var(--border-2)',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {[
                                        { key: 'people', label: 'People', on: !byHousehold },
                                        { key: 'households', label: '家 Households', on: byHousehold },
                                    ].map(({ key, label, on }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => setByHousehold(key === 'households')}
                                            style={{
                                                padding: '0.25rem 0.625rem',
                                                fontSize: '0.75rem',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontFamily: 'var(--font-ui), sans-serif',
                                                background: on ? 'var(--surface-3)' : 'none',
                                                color: on ? 'var(--heading)' : 'var(--dim)',
                                                transition: 'background 0.15s, color 0.15s',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {byHousehold && saved > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                                        {saved} fewer transfer{saved !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {isError && (
                        <p style={{ color: 'var(--red)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            {error.message ?? 'Could not load balances — try refreshing.'}
                        </p>
                    )}

                    {transfers.map((transfer) => {
                        const key = `${transfer.from}|${transfer.to}`
                        const fromLabel = transfer.fromHousehold?.name ?? transfer.fromName
                        const toLabel = transfer.toHousehold?.name ?? transfer.toName
                        const isPooled = !!(transfer.fromHousehold ?? transfer.toHousehold)
                        const handoff = `${transfer.fromName} pays ${transfer.toName}`
                        const cash = cashCode
                            ? fromDefaultCurrency(transfer.amount, cashCode, defaultCurrency, rates)
                            : null
                        return (
                            <div key={key} className="ledger-row">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Two household names never fit on one phone line,
                                        so stack them and let the arrow lead the receiver
                                        rather than dangle at the end of the first */}
                                    {isPooled ? (
                                        <div style={{ fontSize: '0.9375rem', lineHeight: 1.45 }}>
                                            <div style={{ fontWeight: 600, color: 'var(--heading)' }}>{fromLabel}</div>
                                            <div style={{ fontWeight: 600, color: 'var(--heading)' }}>
                                                <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→ </span>
                                                {toLabel}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.9375rem', color: 'var(--body)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{fromLabel}</span>
                                            <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→</span>
                                            <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{toLabel}</span>
                                        </div>
                                    )}
                                    <div className="font-mono" style={{ fontSize: '0.9375rem', color: 'var(--amber)', marginTop: '0.1875rem' }}>
                                        {formatAmount(transfer.amount, transfer.currency)}
                                        {cash !== null && cashCode && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                                                ≈ {formatAmount(cash, cashCode)}
                                            </span>
                                        )}
                                    </div>
                                    {isPooled && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                                            {handoff}
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn-sm-settle"
                                    onClick={() =>
                                        setPending({
                                            fromUserId: transfer.from,
                                            fromName: transfer.fromName,
                                            toUserId: transfer.to,
                                            toName: transfer.toName,
                                            note: isPooled ? `Settles ${fromLabel} → ${toLabel}` : undefined,
                                            lines: [{ currency: transfer.currency, amount: transfer.amount }],
                                        })
                                    }
                                >
                                    済 Settle
                                </button>
                            </div>
                        )
                    })}

                    {/* Freshly settled pairs — dimmed with a hanko stamp */}
                    {stampedRows.map((s) => (
                        <div key={s.key} className="ledger-row" style={{ opacity: 0.45, transition: 'opacity 0.35s' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.9375rem', color: 'var(--body)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{s.fromName}</span>
                                    <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→</span>
                                    <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{s.toName}</span>
                                </div>
                                <div className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                                    {s.amountStr}
                                </div>
                            </div>
                            <div className="stamp-seal" aria-label="Settled">済</div>
                        </div>
                    ))}

                    {isFreshGroup && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', padding: '0.5rem 0' }}>
                            Nothing to settle yet — log an expense to get started.
                        </div>
                    )}

                    {isSettled && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.875rem',
                                padding: '1.25rem 0 0.75rem',
                                textAlign: 'center',
                            }}
                        >
                            <div className="stamp-seal stamp-seal-lg" aria-hidden>
                                <span>完</span>
                                <span>済</span>
                            </div>
                            <div
                                style={{
                                    fontFamily: 'var(--font-display), serif',
                                    fontSize: '1.375rem',
                                    fontWeight: 700,
                                    color: 'var(--heading)',
                                }}
                            >
                                All square
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--dim)', maxWidth: '20rem', lineHeight: 1.6 }}>
                                {restIsAtHome
                                    ? 'Every household is settled — what is left is between people who share a wallet.'
                                    : 'Every debt in this group is cleared.'}
                            </div>
                        </div>
                    )}

                    {!isLoading && !isError && !hasHouseholds && soloTransfers.length > 2 && (
                        <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                            Travelling as couples or families?{' '}
                            <button
                                type="button"
                                onClick={() => navigateToTab('settings')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--amber)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                }}
                            >
                                Pair them up in settings
                            </button>{' '}
                            and they settle as one wallet.
                        </div>
                    )}
                </div>
            </div>

            <Kamifubuki active={celebrating} onDone={() => setCelebrating(false)} />

            <SettleUpModal
                open={!!pending}
                groupId={groupId}
                fromName={pending?.fromName ?? ''}
                toName={pending?.toName ?? ''}
                note={pending?.note}
                defaultCurrency={defaultCurrency}
                savedRates={rates}
                lines={pending?.lines ?? []}
                onClose={() => setPending(null)}
                isSubmitting={settleUp.isPending}
                onConfirm={(lines) => {
                    if (!pending) return
                    settleUp.mutate({
                        groupId,
                        payerId: pending.fromUserId,
                        receiverId: pending.toUserId,
                        lines,
                    })
                }}
            />
        </div>
    )
}

export default BalancesTab
