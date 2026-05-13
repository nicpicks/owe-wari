'use client'

import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { useGroupIdentity } from '~/app/_components/use-group-identity'

const SummaryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: totals } = api.expense.getTotalExpenseCost.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const { data: balances, isLoading: balancesLoading, isError: balancesError } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const { data: usersData } = api.group.getUsers.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const { identity } = useGroupIdentity(groupId)
    const { data: userSpend } = api.expense.getUserSpend.useQuery(
        { groupId, userId: identity ?? '' },
        { enabled: !!groupId && !!identity }
    )
    const identityName = usersData?.find((u) => u.id === identity)?.name

    const defaultCurrency = totals?.defaultCurrency ?? 'SGD'

    const totalOwedDefault = balances
        ? balances
              .filter((b) => b.currency === defaultCurrency && b.netBalance < -0.005)
              .reduce((s, b) => s + Math.abs(b.netBalance), 0)
        : null

    const otherCurrenciesOutstanding = balances
        ? Array.from(
              balances
                  .filter((b) => b.currency !== defaultCurrency && b.netBalance < -0.005)
                  .reduce((map, b) => {
                      map.set(b.currency, (map.get(b.currency) ?? 0) + Math.abs(b.netBalance))
                      return map
                  }, new Map<string, number>())
                  .entries()
          ).map(([currency, total]) => ({ currency, total }))
        : []

    const balancesByUser = new Map<
        string,
        { name: string; rows: { currency: string; netBalance: number }[] }
    >()
    for (const b of balances ?? []) {
        let entry = balancesByUser.get(b.userId)
        if (!entry) {
            entry = { name: b.name, rows: [] }
            balancesByUser.set(b.userId, entry)
        }
        entry.rows.push({ currency: b.currency, netBalance: b.netBalance })
    }

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                {/* Stats row */}
                <div
                    className="anim-fade-up d-0"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}
                >
                    <div className="card-dark" style={{ padding: '1.25rem' }}>
                        <div className="section-sub" style={{ marginBottom: '0.5rem' }}>Total spent</div>
                        <div
                            style={{
                                fontFamily: 'var(--font-cormorant), serif',
                                fontSize: '2rem',
                                fontWeight: 600,
                                color: 'var(--heading)',
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                            }}
                        >
                            {totals
                                ? formatAmount(totals.defaultTotal, totals.defaultCurrency)
                                : '—'}
                        </div>
                        {totals && totals.otherTotals.map(({ currency, total }) => (
                            <div
                                key={currency}
                                style={{
                                    marginTop: '0.375rem',
                                    fontFamily: 'var(--font-cormorant), serif',
                                    fontSize: '1.125rem',
                                    fontWeight: 600,
                                    color: 'var(--muted)',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1,
                                }}
                            >
                                {formatAmount(total, currency)}
                            </div>
                        ))}
                    </div>
                    <div className="card-dark" style={{ padding: '1.25rem' }}>
                        <div className="section-sub" style={{ marginBottom: '0.5rem' }}>Outstanding</div>
                        <div
                            style={{
                                fontFamily: 'var(--font-cormorant), serif',
                                fontSize: '2rem',
                                fontWeight: 600,
                                color: totalOwedDefault && totalOwedDefault > 0 ? 'var(--red)' : 'var(--heading)',
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                            }}
                        >
                            {totalOwedDefault != null
                                ? formatAmount(totalOwedDefault, defaultCurrency)
                                : '—'}
                        </div>
                        {otherCurrenciesOutstanding.map(({ currency, total }) => (
                            <div
                                key={currency}
                                style={{
                                    marginTop: '0.375rem',
                                    fontFamily: 'var(--font-cormorant), serif',
                                    fontSize: '1.125rem',
                                    fontWeight: 600,
                                    color: 'var(--red)',
                                    opacity: 0.6,
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1,
                                }}
                            >
                                {formatAmount(total, currency)}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Your spend — only when identity is set */}
                {identity && userSpend && userSpend.byCurrency.length > 0 && (
                    <div className="card-dark anim-fade-up d-1" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div className="section-title">Your spend</div>
                            <div className="section-sub">
                                {identityName ? `Tallied for ${identityName}` : 'Tallied for you'}
                                {userSpend.paidExpenseCount > 0
                                    ? ` · ${userSpend.paidExpenseCount} expense${userSpend.paidExpenseCount !== 1 ? 's' : ''} paid`
                                    : ''}
                            </div>
                        </div>

                        {userSpend.byCurrency.map(({ currency, paid, share }) => (
                            <div key={currency} className="ledger-row">
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                                        {currency}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                                    <span className="font-mono" style={{ fontSize: '0.9375rem', color: 'var(--heading)' }}>
                                        {formatAmount(paid, currency)}
                                        <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '0.375rem', fontSize: '0.75rem' }}>paid</span>
                                    </span>
                                    <span className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                                        {formatAmount(share, currency)} share
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Member balances */}
                <div className="card-dark anim-fade-up d-2">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Member Balances</div>
                        <div className="section-sub">Net position after all expenses</div>
                    </div>

                    {balancesLoading && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            Loading…
                        </p>
                    )}

                    {balancesError && (
                        <p style={{ color: 'var(--red)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            Could not load balances — try refreshing.
                        </p>
                    )}

                    {balances && usersData?.map((u, i) => {
                        const entry = balancesByUser.get(u.id)
                        const rows = entry?.rows.filter((r) => Math.abs(r.netBalance) > 0.005) ?? []
                        return (
                            <div
                                key={u.id}
                                className={`ledger-row anim-fade-up d-${Math.min(i + 2, 8)}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <div
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: 'var(--surface-3)',
                                            border: '1px solid var(--border-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                            color: 'var(--dim)',
                                            flexShrink: 0,
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        {u.name.charAt(0)}
                                    </div>
                                    <span style={{ color: 'var(--body)', fontSize: '0.9375rem' }}>{u.name}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                                    {rows.length === 0 ? (
                                        <span className="font-mono amount-neu" style={{ fontSize: '0.9375rem' }}>settled</span>
                                    ) : (
                                        rows.map(({ currency, netBalance }) => (
                                            <span
                                                key={currency}
                                                className={`font-mono ${netBalance > 0 ? 'amount-pos' : 'amount-neg'}`}
                                                style={{ fontSize: '0.9375rem' }}
                                            >
                                                {netBalance > 0 ? '+' : '–'}
                                                {formatAmount(Math.abs(netBalance), currency)}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default SummaryTab
