'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Tabs from '~/app/_components/tabs'
import { ExpenseDetailModal } from '~/app/_components/expense-detail-modal'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { useGroupIdentity } from '~/app/_components/use-group-identity'

interface Expense {
    id: number
    title: string
    amount: string
    currency: string
    category: string | null
    notes: string | null
    expenseDate: Date
    paidByUserId: string
    participantIds: string[]
}

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
const ALL_CHIP_COLOR = '#FFAE1F'

const catKey = (e: Expense) => {
    const c = e.category?.trim()
    return c ? c : UNCATEGORIZED
}

const localDateStr = (date: Date) => {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatGroupDate = (dateStr: string): string => {
    const today = localDateStr(new Date())
    const yesterday = localDateStr(new Date(Date.now() - 86_400_000))
    if (dateStr === today) return 'Today'
    if (dateStr === yesterday) return 'Yesterday'
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y!, m! - 1, d!)
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    })
}

const FilterChip = ({
    label,
    color,
    count,
    active,
    onClick,
}: {
    label: string
    color: string
    count: number
    active: boolean
    onClick: () => void
}) => (
    <button
        onClick={onClick}
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4375rem',
            padding: '0.375rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            background: active ? `${color}1F` : 'var(--surface-2)',
            border: `1px solid ${active ? `${color}66` : 'var(--border-2)'}`,
            color: active ? 'var(--heading)' : 'var(--dim)',
        }}
    >
        <span
            style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
            }}
        />
        {label}
        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{count}</span>
    </button>
)

const ExpensesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'all' | 'me'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const { identity, isLoaded: identityLoaded } = useGroupIdentity(groupId)

    const { data: expensesData, error: expensesError } = api.expense.getExpenses.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    useEffect(() => {
        if (expensesData) setExpenses(expensesData)
        if (expensesError) console.error('Error fetching expenses', expensesError)
    }, [expensesData, expensesError])

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const categories = useMemo(() => {
        const present = new Set(expenses.map(catKey))
        const known = CATEGORY_ORDER.filter((c) => present.has(c))
        const extras = Array.from(present)
            .filter((c) => !CATEGORY_ORDER.includes(c) && c !== UNCATEGORIZED)
            .sort()
        const tail = present.has(UNCATEGORIZED) ? [UNCATEGORIZED] : []
        return [...known, ...extras, ...tail]
    }, [expenses])

    const filteredExpenses = useMemo(() => {
        let result = expenses
        if (selectedCategory !== null) {
            result = result.filter((e) => catKey(e) === selectedCategory)
        }
        if (viewMode === 'me' && identity) {
            result = result.filter(
                (e) => e.paidByUserId === identity || e.participantIds.includes(identity)
            )
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase()
            result = result.filter((e) => e.title.toLowerCase().includes(q))
        }
        return result
    }, [expenses, selectedCategory, viewMode, identity, searchQuery])

    // Group filtered expenses by local date, preserving newest-first order from the API
    const groupedExpenses = useMemo(() => {
        const groups = new Map<string, Expense[]>()
        for (const e of filteredExpenses) {
            const key = localDateStr(new Date(e.expenseDate))
            const arr = groups.get(key) ?? []
            arr.push(e)
            groups.set(key, arr)
        }
        return Array.from(groups.entries())
    }, [filteredExpenses])

    const totalExpenseCount = filteredExpenses.length

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                {/* Header row */}
                <div
                    className="anim-fade-up d-0"
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem',
                        gap: '1rem',
                    }}
                >
                    <div>
                        <div className="section-title">Expenses</div>
                        <div className="section-sub">
                            {expenses.length === 0
                                ? 'No expenses yet'
                                : (() => {
                                    const base =
                                        selectedCategory === null && viewMode === 'all'
                                            ? `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} recorded`
                                            : `${totalExpenseCount} expense${totalExpenseCount !== 1 ? 's' : ''}${selectedCategory ? ` in ${selectedCategory}` : ''}`
                                    return searchQuery.trim()
                                        ? `${base} matching "${searchQuery.trim()}"`
                                        : base
                                })()}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {/* All | Me toggle — only shown once identity is resolved and set */}
                        {identityLoaded && identity && (
                            <div
                                style={{
                                    display: 'flex',
                                    border: '1px solid var(--border-2)',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                }}
                            >
                                {(['all', 'me'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setViewMode(mode)}
                                        style={{
                                            padding: '0.3125rem 0.75rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-ui), sans-serif',
                                            background: viewMode === mode ? 'var(--amber)' : 'none',
                                            color: viewMode === mode ? 'var(--ink)' : 'var(--dim)',
                                            transition: 'background 0.15s, color 0.15s',
                                        }}
                                    >
                                        {mode === 'all' ? 'All' : 'Me'}
                                    </button>
                                ))}
                            </div>
                        )}
                        <Link href={`/groups/${groupId}/expenses/create`}>
                            <button className="btn-amber">
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                    <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                                </svg>
                                Add
                            </button>
                        </Link>
                    </div>
                </div>

                {expenses.length > 0 && (
                    <div style={{ position: 'relative', marginBottom: '1rem' }} className="anim-fade-up d-1">
                        <svg
                            width="14" height="14" viewBox="0 0 14 14" fill="none"
                            style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                        >
                            <circle cx="6" cy="6" r="4.5" stroke="var(--muted)" strokeWidth="1.5"/>
                            <path d="M9.5 9.5L12.5 12.5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <input
                            type="text"
                            placeholder="Search expenses…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-2)',
                                background: 'var(--surface-2)',
                                color: 'var(--heading)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                fontFamily: 'var(--font-ui), sans-serif',
                            }}
                        />
                    </div>
                )}

                {expenses.length === 0 ? (
                    <div
                        className="card-dark anim-fade-up d-1"
                        style={{ textAlign: 'center', padding: '3rem 1.5rem' }}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧾</div>
                        <p style={{ color: 'var(--dim)', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
                            Nothing here yet. Add your first expense to get started.
                        </p>
                        <Link href={`/groups/${groupId}/expenses/create`}>
                            <button className="btn-amber">Add first expense</button>
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Category filter chips */}
                        {categories.length > 1 && (
                            <div
                                className="anim-fade-up d-1"
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    marginBottom: '1.5rem',
                                }}
                            >
                                <FilterChip
                                    label="All"
                                    color={ALL_CHIP_COLOR}
                                    count={expenses.length}
                                    active={selectedCategory === null}
                                    onClick={() => setSelectedCategory(null)}
                                />
                                {categories.map((cat) => (
                                    <FilterChip
                                        key={cat}
                                        label={cat}
                                        color={CATEGORY_COLORS[cat] ?? '#717171'}
                                        count={expenses.filter((e) => catKey(e) === cat).length}
                                        active={selectedCategory === cat}
                                        onClick={() =>
                                            setSelectedCategory(selectedCategory === cat ? null : cat)
                                        }
                                    />
                                ))}
                            </div>
                        )}

                        {filteredExpenses.length === 0 ? (
                            <div
                                className="card-dark anim-fade-up d-2"
                                style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}
                            >
                                <p style={{ color: 'var(--dim)', fontSize: '0.9375rem' }}>
                                    {searchQuery.trim()
                                        ? `No expenses matching "${searchQuery.trim()}".`
                                        : viewMode === 'me'
                                          ? "You're not involved in any expenses yet."
                                          : `No ${selectedCategory?.toLowerCase() ?? ''} expenses recorded yet.`}
                                </p>
                            </div>
                        ) : (
                            <div className="anim-fade-up d-2">
                                {groupedExpenses.map(([dateStr, dayExpenses]) => {
                                    // Compute daily total per currency
                                    const dayTotals = new Map<string, number>()
                                    for (const e of dayExpenses) {
                                        dayTotals.set(e.currency, (dayTotals.get(e.currency) ?? 0) + parseFloat(e.amount))
                                    }
                                    const dayTotalStr = Array.from(dayTotals.entries())
                                        .map(([currency, total]) => formatAmount(total, currency))
                                        .join(' · ')

                                    return (
                                        <div key={dateStr} style={{ marginBottom: '1.5rem' }}>
                                            {/* Day header */}
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'baseline',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '0.5rem',
                                                    padding: '0 0.25rem',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '0.6875rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.08em',
                                                        textTransform: 'uppercase',
                                                        color: 'var(--dim)',
                                                    }}
                                                >
                                                    {formatGroupDate(dateStr)}
                                                </span>
                                                <span
                                                    className="font-mono"
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--muted)',
                                                    }}
                                                >
                                                    {dayTotalStr}
                                                </span>
                                            </div>

                                            {/* Expenses for this day */}
                                            <div className="card-dark" style={{ padding: 0, overflow: 'hidden' }}>
                                                {dayExpenses.map((expense, i) => {
                                                    const catColor = CATEGORY_COLORS[expense.category ?? ''] ?? '#717171'
                                                    return (
                                                        <div
                                                            key={expense.id}
                                                            onClick={() => setSelectedExpenseId(expense.id)}
                                                            className="cursor-pointer transition-colors hover:bg-white/5"
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '0.875rem 1.25rem',
                                                                borderBottom:
                                                                    i < dayExpenses.length - 1
                                                                        ? '1px solid var(--border)'
                                                                        : 'none',
                                                                gap: '1rem',
                                                            }}
                                                        >
                                                            {/* Category dot + info */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                                                <div
                                                                    style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        borderRadius: '8px',
                                                                        background: `${catColor}18`,
                                                                        border: `1px solid ${catColor}30`,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: '6px',
                                                                            height: '6px',
                                                                            borderRadius: '50%',
                                                                            background: catColor,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div
                                                                        style={{
                                                                            color: 'var(--heading)',
                                                                            fontWeight: 500,
                                                                            fontSize: '0.9375rem',
                                                                            whiteSpace: 'nowrap',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                        }}
                                                                    >
                                                                        {expense.title}
                                                                    </div>
                                                                    {expense.category && (
                                                                        <div style={{ fontSize: '0.6875rem', color: catColor, marginTop: '0.125rem', fontWeight: 500 }}>
                                                                            {expense.category}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Amount */}
                                                            <div
                                                                className="font-mono"
                                                                style={{
                                                                    fontWeight: 600,
                                                                    fontSize: '0.9375rem',
                                                                    color: 'var(--heading)',
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                {formatAmount(parseFloat(expense.amount), expense.currency)}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            <ExpenseDetailModal
                expenseId={selectedExpenseId}
                groupId={groupId ?? ''}
                onClose={() => setSelectedExpenseId(null)}
            />
        </div>
    )
}

export default ExpensesTab
