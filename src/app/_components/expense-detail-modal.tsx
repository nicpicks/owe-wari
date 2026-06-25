'use client'

import { useEffect, useState } from 'react'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { useGroupIdentity } from './use-group-identity'

const CATEGORIES = ['General', 'Food', 'Transport', 'Stay', 'Groceries', 'Activities', 'Others'] as const

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#F59E0B',
    Transport: '#6366F1',
    Stay: '#06B6D4',
    Groceries: '#10B981',
    General: '#717181',
    Activities: '#EC4899',
    Others: '#8B5CF6',
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

function toDateInput(date: Date) {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface ExpenseDetailModalProps {
    expenseId: number | null
    groupId: string
    onClose: () => void
}

export function ExpenseDetailModal({ expenseId, groupId, onClose }: ExpenseDetailModalProps) {
    const utils = api.useUtils()
    const { identity } = useGroupIdentity(groupId)
    const { data: expense, isLoading } = api.expense.getExpense.useQuery(
        { expenseId: expenseId! },
        { enabled: expenseId !== null }
    )
    const { data: groupUsers } = api.group.getUsers.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const [isEditing, setIsEditing] = useState(false)
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState(0)
    const [category, setCategory] = useState('General')
    const [notes, setNotes] = useState('')
    const [expenseDate, setExpenseDate] = useState('')
    const [paidByUserId, setPaidByUserId] = useState('')

    useEffect(() => {
        if (!expense) return
        setTitle(expense.title)
        setAmount(parseFloat(expense.amount))
        setCategory(expense.category ?? 'General')
        setNotes(expense.notes ?? '')
        setExpenseDate(toDateInput(expense.expenseDate) ?? '')
        setPaidByUserId(expense.paidByUserId)
    }, [expense])

    useEffect(() => {
        if (expenseId === null) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [expenseId, onClose])

    useEffect(() => {
        if (expenseId === null) {
            setIsEditing(false)
            setIsConfirmingDelete(false)
        }
    }, [expenseId])

    const updateExpense = api.expense.update.useMutation({
        onSuccess: async () => {
            await utils.expense.getExpense.invalidate({ expenseId: expenseId! })
            await utils.expense.getExpenses.invalidate({ groupId })
            await utils.expense.getTotalExpenseCost.invalidate({ groupId })
            setIsEditing(false)
        },
        onError: (e) => {
            console.error(e)
            alert('Failed to update expense')
        },
    })

    const deleteExpense = api.expense.delete.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.expense.getExpense.invalidate({ expenseId: expenseId! }),
                utils.expense.getExpenses.invalidate({ groupId }),
                utils.expense.getTotalExpenseCost.invalidate({ groupId }),
                utils.expense.getBalances.invalidate({ groupId }),
                utils.expense.getHistory.invalidate({ groupId }),
            ])
            onClose()
        },
        onError: (e) => {
            console.error(e)
            alert('Failed to delete expense')
        },
    })

    if (expenseId === null) return null

    const categoryColor =
        expense?.category ? (CATEGORY_COLORS[expense.category] ?? '#717181') : '#717181'

    const handleSave = () => {
        if (!expense) return
        updateExpense.mutate({
            expenseId: expense.id,
            title,
            amount: amount > 0 ? amount : undefined,
            category,
            notes,
            expenseDate: (() => { const [y, m, d] = expenseDate.split('-').map(Number); return new Date(y!, m! - 1, d!) })(),
            paidByUserId,
            actorId: identity ?? undefined,
        })
    }

    const handleCancel = () => {
        if (!expense) return
        setTitle(expense.title)
        setAmount(parseFloat(expense.amount))
        setCategory(expense.category ?? 'General')
        setNotes(expense.notes ?? '')
        setExpenseDate(toDateInput(expense.expenseDate) ?? '')
        setPaidByUserId(expense.paidByUserId)
        setIsEditing(false)
    }

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
                <div className="mb-4 flex items-start justify-between gap-2">
                    {isEditing ? (
                        <input
                            className="field-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{ flex: 1, fontSize: '1rem', fontWeight: 600 }}
                        />
                    ) : (
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--heading)', flex: 1 }}>
                            {isLoading ? 'Loading…' : expense?.title}
                        </h2>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {!isEditing && !isConfirmingDelete && expense && (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn-ghost text-sm"
                                    aria-label="Edit"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => setIsConfirmingDelete(true)}
                                    className="btn-ghost text-sm"
                                    style={{ color: 'var(--red)' }}
                                    aria-label="Delete"
                                >
                                    Delete
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="btn-ghost text-xl leading-none"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Delete confirmation */}
                {isConfirmingDelete && (
                    <div
                        style={{
                            background: 'var(--red-dim)',
                            border: '1px solid rgba(248, 113, 113, 0.25)',
                            borderRadius: '10px',
                            padding: '1.25rem',
                            marginBottom: '1rem',
                        }}
                    >
                        <p style={{ color: 'var(--heading)', fontWeight: 600, marginBottom: '0.375rem' }}>
                            Delete this expense?
                        </p>
                        <p style={{ color: 'var(--dim)', fontSize: '0.875rem', marginBottom: '1.125rem' }}>
                            This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '0.625rem' }}>
                            <button
                                className="btn-ghost"
                                onClick={() => setIsConfirmingDelete(false)}
                                disabled={deleteExpense.isPending}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                No, keep it
                            </button>
                            <button
                                onClick={() => expense && deleteExpense.mutate({ expenseId: expense.id })}
                                disabled={deleteExpense.isPending}
                                style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--red)',
                                    color: '#0B0B0B',
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    padding: '0.625rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: deleteExpense.isPending ? 'not-allowed' : 'pointer',
                                    opacity: deleteExpense.isPending ? 0.5 : 1,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                {deleteExpense.isPending ? 'Deleting…' : 'Yes, delete'}
                            </button>
                        </div>
                    </div>
                )}

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

                            <div className="flex items-center justify-between gap-3">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Amount</span>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        className="field-input font-mono no-spinner"
                                        value={amount || ''}
                                        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                        min="0.01"
                                        required
                                        style={{ maxWidth: '180px', textAlign: 'right', fontSize: '1rem' }}
                                    />
                                ) : (
                                    <span className="font-mono text-lg font-semibold" style={{ color: 'var(--heading)' }}>
                                        {formatAmount(parseFloat(expense.amount), expense.currency)}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Date</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="field-input"
                                        value={expenseDate}
                                        onChange={(e) => setExpenseDate(e.target.value)}
                                        style={{ maxWidth: '180px' }}
                                    />
                                ) : (
                                    <span className="text-sm" style={{ color: 'var(--heading)' }}>
                                        {formatDate(expense.expenseDate)}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Category</span>
                                {isEditing ? (
                                    <select
                                        className="field-select"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        style={{ maxWidth: '180px' }}
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                ) : expense.category ? (
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
                                ) : (
                                    <span style={{ color: 'var(--muted)' }} className="text-sm">—</span>
                                )}
                            </div>

                            <div className="flex items-start justify-between gap-3">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Paid by</span>
                                {isEditing ? (
                                    <select
                                        className="field-select"
                                        value={paidByUserId}
                                        onChange={(e) => setPaidByUserId(e.target.value)}
                                        style={{ maxWidth: '180px' }}
                                    >
                                        {(groupUsers ?? []).map((u) => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                ) : expense.payments && expense.payments.length > 1 ? (
                                    <div className="flex flex-col items-end gap-1">
                                        {expense.payments.map((p) => (
                                            <span key={p.userId} className="text-sm font-medium" style={{ color: 'var(--heading)' }}>
                                                {p.name} <span className="font-mono" style={{ color: 'var(--muted)' }}>({formatAmount(parseFloat(p.amount), expense.currency)})</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm font-medium" style={{ color: 'var(--heading)' }}>
                                        {expense.paidByName}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-start justify-between gap-3">
                                <span style={{ color: 'var(--muted)' }} className="text-sm">Notes</span>
                                {isEditing ? (
                                    <textarea
                                        className="field-textarea"
                                        value={notes}
                                        placeholder="Optional details…"
                                        onChange={(e) => setNotes(e.target.value)}
                                        style={{ flex: 1, maxWidth: '220px', minHeight: '48px' }}
                                    />
                                ) : expense.notes ? (
                                    <span className="text-right text-sm" style={{ color: 'var(--heading)' }}>
                                        {expense.notes}
                                    </span>
                                ) : (
                                    <span style={{ color: 'var(--muted)' }} className="text-sm">—</span>
                                )}
                            </div>

                            {isEditing && (
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="btn-ghost"
                                        onClick={handleCancel}
                                        disabled={updateExpense.isPending}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-amber"
                                        onClick={handleSave}
                                        disabled={updateExpense.isPending || !title.trim()}
                                    >
                                        {updateExpense.isPending ? 'Saving…' : 'Save'}
                                    </button>
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
                                            {formatAmount(parseFloat(split.amount), expense.currency)}
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
