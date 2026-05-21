'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#F59E0B',
    Transport: '#6366F1',
    Stay: '#06B6D4',
    Groceries: '#10B981',
    General: '#717171',
    Activities: '#EC4899',
    Others: '#8B5CF6',
}

const CATEGORY_ORDER = ['Food', 'Transport', 'Stay', 'Groceries', 'Activities', 'General', 'Others']
const UNCATEGORIZED = 'Uncategorized'

const TotalsTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: expensesData } = api.expense.getExpenses.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const { data: usersData } = api.group.getUsers.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const expenses = expensesData ?? []
    const users = usersData ?? []

    const categoryRows = useMemo(() => {
        const map = new Map<string, { totals: Map<string, number>; count: number }>()
        for (const e of expenses) {
            const cat = e.category?.trim() || UNCATEGORIZED
            let entry = map.get(cat)
            if (!entry) {
                entry = { totals: new Map(), count: 0 }
                map.set(cat, entry)
            }
            entry.count++
            entry.totals.set(e.currency, (entry.totals.get(e.currency) ?? 0) + parseFloat(e.amount))
        }

        const present = new Set(map.keys())
        const known = CATEGORY_ORDER.filter((c) => present.has(c))
        const extras = Array.from(present)
            .filter((c) => !CATEGORY_ORDER.includes(c) && c !== UNCATEGORIZED)
            .sort()
        const tail = present.has(UNCATEGORIZED) ? [UNCATEGORIZED] : []
        const ordered = [...known, ...extras, ...tail]

        return ordered.map((cat) => ({ cat, ...map.get(cat)! }))
    }, [expenses])

    const memberRows = useMemo(() => {
        const map = new Map<string, Map<string, number>>()
        for (const e of expenses) {
            let totals = map.get(e.paidByUserId)
            if (!totals) {
                totals = new Map()
                map.set(e.paidByUserId, totals)
            }
            totals.set(e.currency, (totals.get(e.currency) ?? 0) + parseFloat(e.amount))
        }

        const rows = users.map((u) => ({
            userId: u.id,
            name: u.name,
            totals: map.get(u.id) ?? new Map<string, number>(),
        }))

        rows.sort((a, b) => {
            const aTotal = Array.from(a.totals.values()).reduce((s, v) => s + v, 0)
            const bTotal = Array.from(b.totals.values()).reduce((s, v) => s + v, 0)
            return bTotal - aTotal
        })

        return rows
    }, [expenses, users])

    if (expenses.length === 0) {
        return (
            <div className="page-shell">
                <Tabs pathname={pathname} navigateToTab={navigateToTab} />
                <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                    <div
                        className="card-dark anim-fade-up d-0"
                        style={{ textAlign: 'center', padding: '3rem 1.5rem' }}
                    >
                        <p style={{ color: 'var(--muted)', fontSize: '0.9375rem' }}>No expenses yet</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">By Category</div>
                        <div className="section-sub">Total spent per category</div>
                    </div>

                    {categoryRows.map(({ cat, totals, count }) => {
                        const color = CATEGORY_COLORS[cat] ?? '#717171'
                        return (
                            <div key={cat} className="ledger-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <div
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: color,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ color: 'var(--body)', fontSize: '0.9375rem' }}>{cat}</span>
                                    <span
                                        style={{
                                            fontSize: '0.6875rem',
                                            fontWeight: 600,
                                            color: 'var(--muted)',
                                            background: 'var(--surface-3)',
                                            border: '1px solid var(--border-2)',
                                            borderRadius: '999px',
                                            padding: '0.0625rem 0.4375rem',
                                        }}
                                    >
                                        {count}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                                    {Array.from(totals.entries()).map(([currency, total]) => (
                                        <span
                                            key={currency}
                                            className="font-mono"
                                            style={{ fontSize: '0.9375rem', color: 'var(--heading)' }}
                                        >
                                            {formatAmount(total, currency)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="card-dark anim-fade-up d-1">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">By Member</div>
                        <div className="section-sub">Total paid per person</div>
                    </div>

                    {memberRows.map(({ userId, name, totals }) => (
                        <div key={userId} className="ledger-row">
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                                {totals.size === 0 ? (
                                    <span className="font-mono" style={{ fontSize: '0.9375rem', color: 'var(--muted)' }}>—</span>
                                ) : (
                                    Array.from(totals.entries()).map(([currency, total]) => (
                                        <span
                                            key={currency}
                                            className="font-mono"
                                            style={{ fontSize: '0.9375rem', color: 'var(--heading)' }}
                                        >
                                            {formatAmount(total, currency)}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default TotalsTab
