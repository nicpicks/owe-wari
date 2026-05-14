'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Tabs from '~/app/_components/tabs'
import { ExpenseDetailModal } from '~/app/_components/expense-detail-modal'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'

interface Expense {
    id: number
    title: string
    amount: string
    currency: string
    category: string | null
    notes: string | null
    expenseDate: Date
}

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#F59E0B',
    Transport: '#6366F1',
    Accommodation: '#06B6D4',
    Groceries: '#10B981',
    General: '#717171',
    Others: '#8B5CF6',
}

const CATEGORY_ORDER = ['Food', 'Transport', 'Accommodation', 'Groceries', 'General', 'Others']
const UNCATEGORIZED = 'Uncategorized'
const ALL_CHIP_COLOR = '#F2A007'

const catKey = (e: Expense) => {
    const c = e.category?.trim()
    return c ? c : UNCATEGORIZED
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

    const categories = (() => {
        const present = new Set(expenses.map(catKey))
        const known = CATEGORY_ORDER.filter((c) => present.has(c))
        const extras = Array.from(present)
            .filter((c) => !CATEGORY_ORDER.includes(c) && c !== UNCATEGORIZED)
            .sort()
        const tail = present.has(UNCATEGORIZED) ? [UNCATEGORIZED] : []
        return [...known, ...extras, ...tail]
    })()

    const filteredExpenses =
        selectedCategory === null
            ? expenses
            : expenses.filter((e) => catKey(e) === selectedCategory)

    const filteredTotal = (() => {
        const totals = new Map<string, number>()
        for (const e of filteredExpenses) {
            totals.set(e.currency, (totals.get(e.currency) ?? 0) + parseFloat(e.amount))
        }
        return Array.from(totals.entries())
            .map(([currency, total]) => formatAmount(total, currency))
            .join(' · ')
    })()

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
                                : selectedCategory === null
                                  ? `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} recorded`
                                  : `${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''} · ${filteredTotal}`}
                        </div>
                    </div>
                    <Link href={`/groups/${groupId}/expenses/create`}>
                        <button className="btn-amber" style={{ flexShrink: 0 }}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                            </svg>
                            Add
                        </button>
                    </Link>
                </div>

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
                        {categories.length > 1 && (
                            <div
                                className="anim-fade-up d-1"
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    marginBottom: '1.25rem',
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
                                    No expenses in this category.
                                </p>
                            </div>
                        ) : (
                            <div className="card-dark anim-fade-up d-2" style={{ padding: 0, overflow: 'hidden' }}>
                                {filteredExpenses.map((expense, i) => {
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
                                                padding: '1rem 1.5rem',
                                                borderBottom:
                                                    i < filteredExpenses.length - 1
                                                        ? '1px solid var(--border)'
                                                        : 'none',
                                                gap: '1rem',
                                            }}
                                        >
                                            {/* Category dot + info */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
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
                                                            width: '7px',
                                                            height: '7px',
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
                                                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                                                        {expense.expenseDate instanceof Date
                                                            ? expense.expenseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                                            : new Date(expense.expenseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                        {expense.category && (
                                                            <span style={{ marginLeft: '0.5rem', color: catColor }}>
                                                                {expense.category}
                                                            </span>
                                                        )}
                                                    </div>
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
