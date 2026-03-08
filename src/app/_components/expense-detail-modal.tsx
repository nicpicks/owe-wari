'use client'

import { useEffect } from 'react'
import { api } from '~/trpc/react'

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#F59E0B',
    Transport: '#6366F1',
    Accommodation: '#06B6D4',
    Groceries: '#10B981',
    General: '#717181',
    Others: '#8B5CF6',
}

function formatAmount(amount: string) {
    return `$${parseFloat(amount).toFixed(2)}`
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

interface ExpenseDetailModalProps {
    expenseId: number | null
    onClose: () => void
}

export function ExpenseDetailModal({ expenseId, onClose }: ExpenseDetailModalProps) {
    const { data: expense, isLoading } = api.expense.getExpense.useQuery(
        { expenseId: expenseId! },
        { enabled: expenseId !== null }
    )

    useEffect(() => {
        if (expenseId === null) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [expenseId, onClose])

    if (expenseId === null) return null

    const categoryColor =
        expense?.category ? (CATEGORY_COLORS[expense.category] ?? '#717181') : '#717181'

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={onClose}
        >
            <div
                className="card-dark relative mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--heading)' }}>
                        {isLoading ? 'Loading…' : expense?.title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-ghost ml-4 text-xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {isLoading && (
                    <p style={{ color: 'var(--muted)' }} className="text-sm">
                        Loading expense details…
                    </p>
                )}

                {expense && (
                    <>
                        {/* Expense Details Card */}
                        <div className="card-dark mb-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                Expense Details
                            </p>

                            <div className="flex items-center justify-between">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Amount</span>
                                <span className="font-mono text-lg font-semibold" style={{ color: 'var(--heading)' }}>
                                    {formatAmount(expense.amount)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Date</span>
                                <span className="text-sm" style={{ color: 'var(--heading)' }}>
                                    {formatDate(expense.expenseDate)}
                                </span>
                            </div>

                            {expense.category && (
                                <div className="flex items-center justify-between">
                                    <span style={{ color: 'var(--muted)' }} className="text-sm">Category</span>
                                    <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: categoryColor }}>
                                        <span
                                            style={{
                                                background: categoryColor + '22',
                                                border: `1.5px solid ${categoryColor}55`,
                                                width: 10,
                                                height: 10,
                                                borderRadius: 3,
                                                display: 'inline-block',
                                            }}
                                        />
                                        {expense.category}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Paid by</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--heading)' }}>
                                    {expense.paidByName}
                                </span>
                            </div>

                            {expense.notes && (
                                <div className="flex items-start justify-between gap-4">
                                    <span style={{ color: 'var(--muted)' }} className="text-sm">Notes</span>
                                    <span className="text-right text-sm" style={{ color: 'var(--heading)' }}>
                                        {expense.notes}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Split Between Card */}
                        {expense.splits.length > 0 && (
                            <div className="card-dark space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                    Split Between
                                </p>
                                {expense.splits.map((split) => (
                                    <div key={split.userId} className="flex items-center justify-between">
                                        <span className="text-sm" style={{ color: 'var(--heading)' }}>
                                            {split.name}
                                        </span>
                                        <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>
                                            {formatAmount(split.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
