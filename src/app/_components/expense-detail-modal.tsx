'use client'

import { useEffect, useState } from 'react'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { useGroupIdentity } from './use-group-identity'
import { categoryGlyph } from '~/lib/category-glyphs'

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

// Summary row shape from the expenses list — used to paint the modal instantly
// while the full detail (payer name, splits, payments) loads.
export interface Expense {
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

interface ExpenseDetailModalProps {
    expenseId: number | null
    seed?: Expense | null
    groupId: string
    onClose: () => void
}

export function ExpenseDetailModal({ expenseId, seed, groupId, onClose }: ExpenseDetailModalProps) {
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

    // What we render: the full record once fetched, otherwise the list-row seed
    // (splits/payments unknown until the fetch lands).
    const detail =
        expense ??
        (seed && seed.id === expenseId
            ? {
                  ...seed,
                  paidByName: groupUsers?.find((u) => u.id === seed.paidByUserId)?.name ?? '…',
                  splits: null,
                  payments: null,
              }
            : null)

    const [isEditing, setIsEditing] = useState(false)
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
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
            setMenuOpen(false)
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
        detail?.category ? (CATEGORY_COLORS[detail.category] ?? '#717181') : '#717181'

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
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="card-dark modal-card relative mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header: glyph + actions on the top row, full-width title below
                    so long titles wrap across the whole modal. */}
                <div className="mb-4">
                    <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0.75rem' }}>
                        <div
                            className="glyph-tile"
                            style={{
                                width: '38px',
                                height: '38px',
                                fontSize: '1.0625rem',
                                background: `${categoryColor}18`,
                                border: `1px solid ${categoryColor}30`,
                                color: categoryColor,
                            }}
                        >
                            {categoryGlyph(detail?.category)}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, position: 'relative' }}>
                            {!isEditing && !isConfirmingDelete && expense && (
                                <button
                                    onClick={() => setMenuOpen((o) => !o)}
                                    className="btn-ghost text-xl leading-none"
                                    aria-label="More actions"
                                    aria-haspopup="menu"
                                    aria-expanded={menuOpen}
                                >
                                    ⋯
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="btn-ghost text-xl leading-none"
                                aria-label="Close"
                            >
                                ×
                            </button>
                            {menuOpen && (
                                <>
                                    {/* click-away catcher; inside modal-card so it can't close the modal */}
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                        onClick={() => setMenuOpen(false)}
                                    />
                                    <div
                                        role="menu"
                                        className="card-dark"
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 0.375rem)',
                                            right: 0,
                                            zIndex: 11,
                                            minWidth: '150px',
                                            padding: '0.375rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.125rem',
                                            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
                                        }}
                                    >
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                setMenuOpen(false)
                                                setIsEditing(true)
                                            }}
                                            className="btn-ghost text-sm"
                                            style={{ justifyContent: 'flex-start' }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                setMenuOpen(false)
                                                setIsConfirmingDelete(true)
                                            }}
                                            className="btn-ghost text-sm"
                                            style={{ justifyContent: 'flex-start', color: 'var(--red)' }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {isEditing ? (
                        <input
                            className="field-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={{ width: '100%', fontSize: '1rem', fontWeight: 600 }}
                        />
                    ) : (
                        <h2
                            className="text-lg font-semibold"
                            style={{
                                color: 'var(--heading)',
                                fontFamily: 'var(--font-display), serif',
                                overflowWrap: 'break-word',
                                lineHeight: 1.3,
                            }}
                        >
                            {detail ? detail.title : 'Loading…'}
                        </h2>
                    )}
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
                                    color: 'var(--ink)',
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

                {isLoading && !detail && (
                    <p style={{ color: 'var(--muted)' }} className="text-sm">
                        Loading expense details…
                    </p>
                )}

                {detail && (
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
                                        {formatAmount(parseFloat(detail.amount), detail.currency)}
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
                                        {formatDate(detail.expenseDate)}
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
                                ) : detail.category ? (
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
                                        {detail.category}
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
                                ) : detail.payments && detail.payments.length > 1 ? (
                                    <div className="flex flex-col items-end gap-1">
                                        {detail.payments.map((p) => (
                                            <span key={p.userId} className="text-sm font-medium" style={{ color: 'var(--heading)' }}>
                                                {p.name} <span className="font-mono" style={{ color: 'var(--muted)' }}>({formatAmount(parseFloat(p.amount), detail.currency)})</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm font-medium" style={{ color: 'var(--heading)' }}>
                                        {detail.paidByName}
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
                                ) : detail.notes ? (
                                    <span className="text-right text-sm" style={{ color: 'var(--heading)' }}>
                                        {detail.notes}
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
                        {detail.splits === null ? (
                            <div className="card-dark space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                    Split Between
                                </p>
                                {(detail.participantIds.length > 0 ? detail.participantIds : ['']).map((id, i) => (
                                    <div key={id || i} className="flex items-center justify-between">
                                        <div className="skeleton-block" style={{ width: '40%', height: '0.875rem' }} />
                                        <div className="skeleton-block" style={{ width: '3.5rem', height: '0.875rem' }} />
                                    </div>
                                ))}
                            </div>
                        ) : detail.splits.length > 0 ? (
                            <div className="card-dark space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                                    Split Between
                                </p>
                                {detail.splits.map((split) => (
                                    <div key={split.userId} className="flex items-center justify-between">
                                        <span className="text-sm" style={{ color: 'var(--heading)' }}>
                                            {split.name}
                                        </span>
                                        <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>
                                            {formatAmount(parseFloat(split.amount), detail.currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    )
}
