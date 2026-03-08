'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Tabs from '~/app/_components/tabs'
import { ExpenseDetailModal } from '~/app/_components/expense-detail-modal'
import { api } from '~/trpc/react'

interface Expense {
    id: number
    title: string
    amount: string
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

const ExpensesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null)

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
                            {expenses.length > 0
                                ? `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} recorded`
                                : 'No expenses yet'}
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
                    <div className="card-dark anim-fade-up d-1" style={{ padding: 0, overflow: 'hidden' }}>
                        {expenses.map((expense, i) => {
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
                                        borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : 'none',
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
                                        ${parseFloat(expense.amount).toFixed(2)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <ExpenseDetailModal
                expenseId={selectedExpenseId}
                onClose={() => setSelectedExpenseId(null)}
            />
        </div>
    )
}

export default ExpensesTab
