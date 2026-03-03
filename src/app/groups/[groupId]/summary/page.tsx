'use client'

import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'

const SummaryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: totalExpenses } = api.expense.getTotalExpenseCost.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const { data: balances } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const totalOwed = balances
        ? balances.filter((b) => b.netBalance < -0.005).reduce((s, b) => s + Math.abs(b.netBalance), 0)
        : null

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
                            {totalExpenses != null
                                ? `$${Number(totalExpenses).toFixed(2)}`
                                : '—'}
                        </div>
                    </div>
                    <div className="card-dark" style={{ padding: '1.25rem' }}>
                        <div className="section-sub" style={{ marginBottom: '0.5rem' }}>Outstanding</div>
                        <div
                            style={{
                                fontFamily: 'var(--font-cormorant), serif',
                                fontSize: '2rem',
                                fontWeight: 600,
                                color: totalOwed && totalOwed > 0 ? 'var(--red)' : 'var(--heading)',
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                            }}
                        >
                            {totalOwed != null ? `$${totalOwed.toFixed(2)}` : '—'}
                        </div>
                    </div>
                </div>

                {/* Member balances */}
                <div className="card-dark anim-fade-up d-1">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Member Balances</div>
                        <div className="section-sub">Net position after all expenses</div>
                    </div>

                    {!balances && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            Loading…
                        </p>
                    )}

                    {balances?.map(({ userId, name, netBalance }, i) => (
                        <div
                            key={userId}
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
                                    {name.charAt(0)}
                                </div>
                                <span style={{ color: 'var(--body)', fontSize: '0.9375rem' }}>{name}</span>
                            </div>
                            <span
                                className={`font-mono ${netBalance > 0.005 ? 'amount-pos' : netBalance < -0.005 ? 'amount-neg' : 'amount-neu'}`}
                                style={{ fontSize: '0.9375rem' }}
                            >
                                {netBalance > 0.005
                                    ? `+$${netBalance.toFixed(2)}`
                                    : netBalance < -0.005
                                    ? `–$${Math.abs(netBalance).toFixed(2)}`
                                    : 'settled'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default SummaryTab
