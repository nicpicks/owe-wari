'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api } from '~/trpc/react'

interface User {
    id: string
    name: string
}

export default function CreateExpense() {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()

    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState(0)
    const [expenseDate, setExpenseDate] = useState(new Date())
    const [category, setCategory] = useState('General')
    const [paidByUserId, setPaidByUserId] = useState('')
    const [notes, setNotes] = useState('')
    const [users, setUsers] = useState<User[]>([])
    const [isChecked, setIsChecked] = useState<Record<string, boolean>>({})

    const { data: defaultPayee } = api.group.getDefaultPayee.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const { data: usersData, error: usersError } = api.group.getUsers.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    useEffect(() => {
        if (usersData) {
            setUsers(usersData)
            const init: Record<string, boolean> = {}
            usersData.forEach((u) => { init[u.id] = true })
            setIsChecked(init)
            if (defaultPayee) setPaidByUserId(defaultPayee)
        }
        if (usersError) console.error('Error fetching users:', usersError)
    }, [usersData, usersError])

    const fileInputRef = useRef<HTMLInputElement>(null)

    const scanReceipt = api.receipt.scan.useMutation({
        onSuccess: (data) => {
            if (data.amount !== null) {
                setAmount(data.amount)
            } else {
                alert('Could not detect a total on this receipt. Please enter the amount manually.')
            }
        },
        onError: () => {
            alert('Receipt scan failed. Please enter the amount manually.')
        },
    })

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
        type ValidMime = (typeof validTypes)[number]
        if (!validTypes.includes(file.type as ValidMime)) {
            alert('Please select a JPEG, PNG, GIF, or WebP image.')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const dataUrl = reader.result as string
            // Strip the "data:<mime>;base64," prefix
            const base64 = dataUrl.split(',')[1]
            if (!base64) return
            scanReceipt.mutate({ imageBase64: base64, mimeType: file.type as ValidMime })
        }
        reader.readAsDataURL(file)
        // Reset so the same file can be re-selected if needed
        e.target.value = ''
    }

    const createExpense = api.expense.create.useMutation({
        onSuccess: (data) => router.push(`/groups/${data.id}/expenses`),
        onError: (error) => {
            console.error('Error creating expense:', error)
            alert('Failed to create expense')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const splitUserIds = Object.entries(isChecked)
            .filter(([, checked]) => checked)
            .map(([userId]) => userId)

        createExpense.mutate({
            title, groupId: groupId ?? '', paidByUserId,
            amount, category, notes, expenseDate, splitUserIds,
        })
    }

    const checkedCount = Object.values(isChecked).filter(Boolean).length
    const splitAmount = checkedCount > 0 ? amount / checkedCount : 0

    return (
        <div className="page-shell">
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border)', padding: '1rem' }}>
                <div className="page-container">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            style={{
                                background: 'none', border: 'none',
                                color: 'var(--dim)', cursor: 'pointer',
                                padding: '0.25rem', display: 'flex', alignItems: 'center',
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.25rem', fontStyle: 'italic', color: 'var(--heading)' }}>
                            Add expense
                        </span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                    {/* Expense details */}
                    <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                Expense details
                            </span>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={scanReceipt.isPending}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                                    background: 'none', border: '1px solid var(--border-2)',
                                    borderRadius: '6px', padding: '0.3125rem 0.625rem',
                                    color: scanReceipt.isPending ? 'var(--muted)' : 'var(--dim)',
                                    fontSize: '0.75rem', fontFamily: 'var(--font-jakarta), sans-serif',
                                    cursor: scanReceipt.isPending ? 'default' : 'pointer',
                                    transition: 'color 0.15s, border-color 0.15s',
                                }}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </svg>
                                {scanReceipt.isPending ? 'Scanning…' : 'Scan receipt'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                capture="environment"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                            <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="field-label">What for</label>
                                <input
                                    className="field-input"
                                    type="text"
                                    placeholder="Dinner at Shinjuku"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="field-group">
                                <label className="field-label">Amount</label>
                                <input
                                    className="field-input"
                                    type="number"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    value={amount || ''}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    required
                                    style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '1.0625rem' }}
                                />
                            </div>

                            <div className="field-group">
                                <label className="field-label">Date</label>
                                <input
                                    className="field-input"
                                    type="date"
                                    value={expenseDate.toISOString().split('T')[0]}
                                    onChange={(e) => setExpenseDate(new Date(e.target.value))}
                                />
                            </div>

                            <div className="field-group">
                                <label className="field-label">Category</label>
                                <select
                                    className="field-select"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                >
                                    {['General', 'Food', 'Transport', 'Accommodation', 'Groceries', 'Others'].map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="field-group">
                                <label className="field-label">Paid by</label>
                                <select
                                    className="field-select"
                                    value={paidByUserId}
                                    onChange={(e) => setPaidByUserId(e.target.value)}
                                >
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="field-label">Notes</label>
                                <textarea
                                    className="field-textarea"
                                    placeholder="Optional details…"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    style={{ minHeight: '64px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Split */}
                    <div className="card-dark anim-fade-up d-1" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                    Split between
                                </div>
                                <div className="section-sub">
                                    {checkedCount > 0 && amount > 0
                                        ? `$${splitAmount.toFixed(2)} each · ${checkedCount} of ${users.length} selected`
                                        : `${checkedCount} of ${users.length} selected`}
                                </div>
                            </div>
                        </div>

                        {users.length === 0 && (
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading members…</p>
                        )}

                        {users.map((user) => (
                            <div
                                key={user.id}
                                className="check-row"
                                onClick={() =>
                                    setIsChecked({ ...isChecked, [user.id]: !isChecked[user.id] })
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={!!isChecked[user.id]}
                                    onChange={() => {}}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <label style={{ flex: 1 }}>{user.name}</label>
                                {isChecked[user.id] && amount > 0 && checkedCount > 0 && (
                                    <span
                                        className="font-mono"
                                        style={{ fontSize: '0.875rem', color: 'var(--dim)' }}
                                    >
                                        ${splitAmount.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="anim-fade-up d-2" style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="submit"
                            className="btn-amber"
                            disabled={createExpense.isPending || checkedCount === 0}
                            style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
                        >
                            {createExpense.isPending ? 'Adding…' : 'Add expense'}
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => router.back()}>
                            Cancel
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
