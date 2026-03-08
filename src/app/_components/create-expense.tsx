'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api } from '~/trpc/react'

interface User {
    id: string
    name: string
}

// ─── Line items (from receipt scan) ──────────────────────────────────────────

interface LineItem {
    id: string
    name: string
    amount: number
    participantIds: string[]
}

function getInitials(name: string, allNames: string[]): string {
    const first = name.trim()[0]?.toUpperCase() ?? '?'
    const hasConflict = allNames.some(
        (n) => n !== name && n.trim()[0]?.toUpperCase() === first
    )
    if (hasConflict) return name.trim().slice(0, 2).toUpperCase()
    return first
}

// ─── Extensible split mode system ────────────────────────────────────────────

type SplitMode = 'even' | 'manual'

interface SplitModeContext {
    users: User[]
    amount: number
    isChecked: Record<string, boolean>
    manualAmounts: Record<string, number>
}

interface SplitPayload {
    splitUserIds?: string[]
    splitAmounts?: { userId: string; amount: number }[]
}

interface SplitModeConfig {
    key: SplitMode
    label: string
    validate: (ctx: SplitModeContext) => boolean
    toPayload: (ctx: SplitModeContext) => SplitPayload
}

const SPLIT_MODES: SplitModeConfig[] = [
    {
        key: 'even',
        label: 'Even',
        validate: ({ isChecked }) => Object.values(isChecked).some(Boolean),
        toPayload: ({ isChecked }) => ({
            splitUserIds: Object.entries(isChecked)
                .filter(([, v]) => v)
                .map(([id]) => id),
        }),
    },
    {
        key: 'manual',
        label: 'Manual',
        validate: ({ amount, manualAmounts }) =>
            amount > 0 &&
            Math.abs(Object.values(manualAmounts).reduce((s, v) => s + v, 0) - amount) < 0.01,
        toPayload: ({ manualAmounts }) => ({
            splitAmounts: Object.entries(manualAmounts)
                .filter(([, v]) => v > 0)
                .map(([userId, amount]) => ({ userId, amount })),
        }),
    },
]

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
    const [splitMode, setSplitMode] = useState<SplitMode>('even')
    const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({})
    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [scannedLineItems, setScannedLineItems] = useState<LineItem[]>([])
    const [lineItemMemberIds, setLineItemMemberIds] = useState<string[]>([])

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
            const initAmounts: Record<string, number> = {}
            usersData.forEach((u) => { init[u.id] = true; initAmounts[u.id] = 0 })
            setIsChecked(init)
            setManualAmounts(initAmounts)
            setLineItemMemberIds(usersData.map((u) => u.id))
            if (defaultPayee) setPaidByUserId(defaultPayee)
        }
        if (usersError) console.error('Error fetching users:', usersError)
    }, [usersData, usersError])

    const fileInputRef = useRef<HTMLInputElement>(null)

    const scanReceipt = api.receipt.scan.useMutation({
        onSuccess: (data) => {
            if (data.total !== null) {
                setAmount(data.total)
            } else {
                alert('Could not detect a total on this receipt. Please enter the amount manually.')
            }
            if (data.items.length > 0) {
                const scanned = data.items.map((item, i) => ({
                    id: String(i),
                    name: item.name,
                    amount: item.amount,
                    participantIds: [] as string[],
                }))
                setScannedLineItems(scanned)
                setLineItems(scanned)
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
            const base64 = dataUrl.split(',')[1]
            if (!base64) return
            scanReceipt.mutate({ imageBase64: base64, mimeType: file.type as ValidMime })
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const updateLineItem = (id: string, patch: Partial<Pick<LineItem, 'name' | 'amount'>>) => {
        setLineItems((prev) =>
            prev.map((item) => item.id !== id ? item : { ...item, ...patch })
        )
    }

    const removeLineItem = (id: string) => {
        setLineItems((prev) => prev.filter((item) => item.id !== id))
    }

    const addLineItem = () => {
        setLineItems((prev) => [
            ...prev,
            { id: Date.now().toString(), name: '', amount: 0, participantIds: [] },
        ])
    }

    const toggleLineItemMember = (userId: string) => {
        const isRemoving = lineItemMemberIds.includes(userId)
        setLineItemMemberIds((prev) =>
            isRemoving ? prev.filter((id) => id !== userId) : [...prev, userId]
        )
        if (isRemoving) {
            setLineItems((prev) =>
                prev.map((item) => ({
                    ...item,
                    participantIds: item.participantIds.filter((id) => id !== userId),
                }))
            )
        }
    }

    const toggleLineItemParticipant = (itemId: string, userId: string) => {
        setLineItems((prev) =>
            prev.map((item) =>
                item.id !== itemId ? item : {
                    ...item,
                    participantIds: item.participantIds.includes(userId)
                        ? item.participantIds.filter((id) => id !== userId)
                        : [...item.participantIds, userId],
                }
            )
        )
    }

    // Compute per-user totals from line items (round up each share to nearest cent)
    const lineItemTotals: Record<string, number> = {}
    if (lineItems.length > 0) {
        for (const item of lineItems) {
            if (item.participantIds.length === 0) continue
            const share = Math.ceil((item.amount / item.participantIds.length) * 100) / 100
            for (const uid of item.participantIds) {
                lineItemTotals[uid] = (lineItemTotals[uid] ?? 0) + share
            }
        }
    }
    const hasLineItems = lineItems.length > 0
    const allItemsHaveParticipants = lineItems.every((item) => item.participantIds.length > 0)

    const createExpense = api.expense.create.useMutation({
        onSuccess: (data) => router.push(`/groups/${data.id}/expenses`),
        onError: (error) => {
            console.error('Error creating expense:', error)
            alert('Failed to create expense')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (hasLineItems) {
            const splitAmounts = Object.entries(lineItemTotals)
                .filter(([, v]) => v > 0)
                .map(([userId, amt]) => ({ userId, amount: amt }))
            createExpense.mutate({
                title, groupId: groupId ?? '', paidByUserId,
                amount, category, notes, expenseDate, splitAmounts,
            })
        } else {
            const payload = activeModeConfig.toPayload(splitCtx)
            createExpense.mutate({
                title, groupId: groupId ?? '', paidByUserId,
                amount, category, notes, expenseDate, ...payload,
            })
        }
    }

    const checkedCount = Object.values(isChecked).filter(Boolean).length
    const splitAmount = checkedCount > 0 ? amount / checkedCount : 0

    const activeModeConfig = SPLIT_MODES.find((m) => m.key === splitMode)!
    const splitCtx: SplitModeContext = { users, amount, isChecked, manualAmounts }
    const splitValid = activeModeConfig.validate(splitCtx)
    const manualTotal = Object.values(manualAmounts).reduce((s, v) => s + v, 0)
    const manualRemaining = amount - manualTotal

    const allNames = users.map((u) => u.name)
    const submitDisabled = createExpense.isPending
        || (hasLineItems ? !allItemsHaveParticipants : !splitValid)

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

                    {/* Receipt line items */}
                    {hasLineItems && (
                        <div className="card-dark anim-fade-up d-1" style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                    Receipt items
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setLineItems(scannedLineItems.map((item) => ({ ...item, participantIds: [] })))}
                                    style={{
                                        background: 'none', border: '1px solid var(--border-2)',
                                        borderRadius: '6px', padding: '0.3125rem 0.625rem',
                                        color: 'var(--dim)', fontSize: '0.75rem',
                                        fontFamily: 'var(--font-jakarta), sans-serif',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Who's here */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Who&apos;s here:</span>
                                {users.map((user) => {
                                    const included = lineItemMemberIds.includes(user.id)
                                    const initials = getInitials(user.name, allNames)
                                    return (
                                        <button
                                            key={user.id}
                                            type="button"
                                            onClick={() => toggleLineItemMember(user.id)}
                                            title={user.name}
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontFamily: 'var(--font-jakarta), sans-serif',
                                                fontSize: initials.length > 1 ? '0.5625rem' : '0.625rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'background 0.15s, color 0.15s',
                                                background: included ? 'var(--amber)' : 'var(--surface-3)',
                                                color: included ? '#0B0B0B' : 'var(--muted)',
                                            }}
                                        >
                                            {initials}
                                        </button>
                                    )
                                })}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {lineItems.map((item) => {
                                const noParticipants = item.participantIds.length === 0
                                const accent = noParticipants ? 'var(--red)' : undefined
                                return (
                                    <div
                                        key={item.id}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        {/* Name — grows */}
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateLineItem(item.id, { name: e.target.value })}
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                background: 'none',
                                                border: 'none',
                                                borderBottom: `1px solid ${accent ?? 'var(--border-2)'}`,
                                                color: accent ?? 'var(--body)',
                                                fontSize: '0.875rem',
                                                outline: 'none',
                                                padding: '0.25rem 0',
                                                fontFamily: 'var(--font-jakarta), sans-serif',
                                            }}
                                        />
                                        {/* Amount — fixed width, no spinners */}
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.amount || ''}
                                            onChange={(e) => updateLineItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                                            className="font-mono no-spinner"
                                            style={{
                                                width: '64px',
                                                flexShrink: 0,
                                                background: 'none',
                                                border: 'none',
                                                borderBottom: `1px solid ${accent ?? 'var(--border-2)'}`,
                                                color: accent ?? 'var(--dim)',
                                                fontSize: '0.8125rem',
                                                outline: 'none',
                                                padding: '0.25rem 0',
                                                textAlign: 'right',
                                            }}
                                        />
                                        {/* Participant avatars */}
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                            {users.filter((user) => lineItemMemberIds.includes(user.id)).map((user) => {
                                                const selected = item.participantIds.includes(user.id)
                                                const initials = getInitials(user.name, allNames)
                                                return (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => toggleLineItemParticipant(item.id, user.id)}
                                                        title={user.name}
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontFamily: 'var(--font-jakarta), sans-serif',
                                                            fontSize: initials.length > 1 ? '0.5625rem' : '0.625rem',
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            transition: 'background 0.15s, color 0.15s',
                                                            background: selected ? 'var(--amber)' : 'var(--surface-3)',
                                                            color: selected ? '#0B0B0B' : 'var(--muted)',
                                                        }}
                                                    >
                                                        {initials}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {/* Delete row */}
                                        <button
                                            type="button"
                                            onClick={() => removeLineItem(item.id)}
                                            style={{
                                                background: 'none', border: 'none',
                                                color: 'var(--muted)', cursor: 'pointer',
                                                padding: '0 0.125rem', flexShrink: 0,
                                                fontSize: '1rem', lineHeight: 1,
                                                display: 'flex', alignItems: 'center',
                                            }}
                                            title="Remove item"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )
                            })}
                            </div>

                            {/* Add item */}
                            <button
                                type="button"
                                onClick={addLineItem}
                                style={{
                                    marginTop: '0.5rem',
                                    background: 'none', border: 'none',
                                    color: 'var(--dim)', cursor: 'pointer',
                                    fontSize: '0.75rem', fontFamily: 'var(--font-jakarta), sans-serif',
                                    padding: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem',
                                }}
                            >
                                <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> Add item
                            </button>

                            {/* Note if any item has no participants */}
                            {!allItemsHaveParticipants && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: '0.25rem', margin: 0 }}>
                                    Every item needs at least one participant.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Split */}
                    <div className={`card-dark anim-fade-up ${hasLineItems ? 'd-2' : 'd-1'}`} style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                    Split between
                                </div>
                                <div className="section-sub">
                                    {hasLineItems
                                        ? 'Totals from receipt items'
                                        : splitMode === 'even'
                                            ? checkedCount > 0 && amount > 0
                                                ? `$${splitAmount.toFixed(2)} each · ${checkedCount} of ${users.length} selected`
                                                : `${checkedCount} of ${users.length} selected`
                                            : amount > 0 && Math.abs(manualRemaining) < 0.01
                                                ? 'All assigned'
                                                : amount > 0
                                                    ? `$${Math.abs(manualRemaining).toFixed(2)} ${manualRemaining > 0 ? 'remaining' : 'over'}`
                                                    : 'Enter an amount above first'}
                                </div>
                            </div>
                            {/* Mode toggle — hidden when line items are active */}
                            {!hasLineItems && (
                                <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                    {SPLIT_MODES.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setSplitMode(key)}
                                            style={{
                                                padding: '0.25rem 0.625rem',
                                                fontSize: '0.75rem',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontFamily: 'var(--font-jakarta), sans-serif',
                                                background: splitMode === key ? 'var(--surface-3)' : 'none',
                                                color: splitMode === key ? 'var(--heading)' : 'var(--dim)',
                                                transition: 'background 0.15s, color 0.15s',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {users.length === 0 && (
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading members…</p>
                        )}

                        {hasLineItems
                            ? users.map((user) => {
                                const total = lineItemTotals[user.id] ?? 0
                                return (
                                    <div
                                        key={user.id}
                                        className="check-row"
                                        style={{ cursor: 'default' }}
                                    >
                                        <label style={{ flex: 1 }}>{user.name}</label>
                                        <span
                                            className="font-mono"
                                            style={{
                                                fontSize: '0.875rem',
                                                color: total > 0 ? 'var(--heading)' : 'var(--muted)',
                                            }}
                                        >
                                            {total > 0 ? `$${total.toFixed(2)}` : '—'}
                                        </span>
                                    </div>
                                )
                            })
                            : splitMode === 'even'
                                ? users.map((user) => (
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
                                ))
                                : users.map((user) => (
                                    <div
                                        key={user.id}
                                        className="check-row"
                                        style={{ cursor: 'default' }}
                                    >
                                        <label style={{ flex: 1 }}>{user.name}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={manualAmounts[user.id] || ''}
                                            onChange={(e) =>
                                                setManualAmounts({
                                                    ...manualAmounts,
                                                    [user.id]: parseFloat(e.target.value) || 0,
                                                })
                                            }
                                            className="font-mono"
                                            style={{
                                                width: '80px',
                                                background: 'none',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border-2)',
                                                color: 'var(--heading)',
                                                fontSize: '0.875rem',
                                                textAlign: 'right',
                                                outline: 'none',
                                                padding: '0.125rem 0',
                                            }}
                                        />
                                    </div>
                                ))
                        }
                    </div>

                    {/* Actions */}
                    <div className={`anim-fade-up ${hasLineItems ? 'd-3' : 'd-2'}`} style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="submit"
                            className="btn-amber"
                            disabled={submitDisabled}
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
