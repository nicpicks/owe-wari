'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api } from '~/trpc/react'
import { CATEGORIES, suggestFromHistory, suggestFromRules } from '~/lib/categorize'
import { allocateByWeight, evenPercents } from '~/lib/split-allocation'
import { useGroupIdentity } from './use-group-identity'

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

/** 3 → "3", 1.5 → "1.5", 33.33 → "33.33" (no trailing zeros). */
function formatPortion(value: number): string {
    return String(Math.round(value * 100) / 100)
}

// ─── Extensible split mode system ────────────────────────────────────────────

type SplitMode = 'even' | 'portions' | 'percent' | 'manual'

interface SplitModeContext {
    users: User[]
    amount: number
    isChecked: Record<string, boolean>
    manualAmounts: Record<string, number>
    portions: Record<string, number>
    percents: Record<string, number>
}

interface SplitPayload {
    splitUserIds?: string[]
    splitAmounts?: { userId: string; amount: number }[]
}

interface SplitModeConfig {
    key: SplitMode
    label: string
    title: string
    validate: (ctx: SplitModeContext) => boolean
    toPayload: (ctx: SplitModeContext) => SplitPayload
}

/** Sum a per-user weight map over the group's members. */
function sumWeights(users: User[], weights: Record<string, number>): number {
    return users.reduce((s, u) => s + (weights[u.id] ?? 0), 0)
}

/**
 * Turn relative weights (portions or percentages) into per-user amounts that
 * add up to the expense total exactly. Members weighted 0 are left out.
 */
function weightedSplitAmounts(
    users: User[],
    amount: number,
    weights: Record<string, number>
): { userId: string; amount: number }[] {
    const allocated = allocateByWeight(amount, users.map((u) => weights[u.id] ?? 0))
    return users
        .map((u, i) => ({ userId: u.id, amount: allocated[i] ?? 0 }))
        .filter((s) => s.amount > 0)
}

const SPLIT_MODES: SplitModeConfig[] = [
    {
        key: 'even',
        label: 'Even',
        title: 'Split evenly',
        validate: ({ isChecked }) => Object.values(isChecked).some(Boolean),
        toPayload: ({ isChecked }) => ({
            splitUserIds: Object.entries(isChecked)
                .filter(([, v]) => v)
                .map(([id]) => id),
        }),
    },
    {
        key: 'portions',
        label: 'Portions',
        title: 'Split by portions — bigger eaters take more shares',
        validate: ({ users, amount, portions }) => amount > 0 && sumWeights(users, portions) > 0,
        toPayload: ({ users, amount, portions }) => ({
            splitAmounts: weightedSplitAmounts(users, amount, portions),
        }),
    },
    {
        key: 'percent',
        label: '%',
        title: 'Split by percentage',
        validate: ({ users, amount, percents }) =>
            amount > 0 && Math.abs(sumWeights(users, percents) - 100) < 0.01,
        toPayload: ({ users, amount, percents }) => ({
            splitAmounts: weightedSplitAmounts(users, amount, percents),
        }),
    },
    {
        key: 'manual',
        label: 'Manual',
        title: 'Enter each person’s amount',
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

function evalExpr(expr: string): number | null {
    const s = expr.replace(/\s+/g, '')
    if (!s) return null
    let pos = 0

    function parseExpr(): number {
        let left = parseTerm()
        while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
            const op = s[pos++]!
            const right = parseTerm()
            left = op === '+' ? left + right : left - right
        }
        return left
    }

    function parseTerm(): number {
        let left = parseFactor()
        while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
            const op = s[pos++]!
            const right = parseFactor()
            if (op === '/' && right === 0) throw new Error('div by zero')
            left = op === '*' ? left * right : left / right
        }
        return left
    }

    function parseFactor(): number {
        if (s[pos] === '(') {
            pos++
            const val = parseExpr()
            if (s[pos] === ')') pos++
            return val
        }
        const start = pos
        if (s[pos] === '-' || s[pos] === '+') pos++
        while (pos < s.length && (s[pos] === '.' || (s[pos]! >= '0' && s[pos]! <= '9'))) pos++
        const num = parseFloat(s.slice(start, pos))
        if (isNaN(num)) throw new Error('invalid')
        return num
    }

    try {
        const result = parseExpr()
        if (pos !== s.length) return null
        return isFinite(result) ? result : null
    } catch {
        return null
    }
}

export default function CreateExpense() {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const utils = api.useUtils()

    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState(0)
    const [rawAmount, setRawAmount] = useState('')
    // Until a total is entered by hand (or read off a receipt), the item rows
    // add themselves up into it.
    const [amountTouched, setAmountTouched] = useState(false)
    const [expenseDate, setExpenseDate] = useState(new Date())
    const [category, setCategory] = useState('General')
    // A category the user picked themselves is final — no more suggestions.
    const [categoryTouched, setCategoryTouched] = useState(false)
    const [scanCategory, setScanCategory] = useState<string | null>(null)
    const [paidByUserId, setPaidByUserId] = useState('')
    const [notes, setNotes] = useState('')
    const [users, setUsers] = useState<User[]>([])
    const [isChecked, setIsChecked] = useState<Record<string, boolean>>({})
    const [splitMode, setSplitMode] = useState<SplitMode>('even')
    const [manualAmounts, setManualAmounts] = useState<Record<string, number>>({})
    const [portions, setPortions] = useState<Record<string, number>>({})
    const [percents, setPercents] = useState<Record<string, number>>({})
    // Portions/percentages are seeded from the Even-mode selection the first
    // time you open that mode; once you've edited them we leave them alone.
    const [portionsTouched, setPortionsTouched] = useState(false)
    const [percentsTouched, setPercentsTouched] = useState(false)
    const [payMode, setPayMode] = useState<'single' | 'multiple'>('single')
    const [payAmounts, setPayAmounts] = useState<Record<string, number>>({})
    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [scannedLineItems, setScannedLineItems] = useState<LineItem[]>([])
    const [lineItemMemberIds, setLineItemMemberIds] = useState<string[]>([])

    const { identity } = useGroupIdentity(groupId)

    const { data: defaultPayee } = api.group.getDefaultPayee.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const { data: usersData, error: usersError } = api.group.getUsers.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const { data: categoryHints } = api.expense.getCategoryHints.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId, staleTime: 5 * 60_000 }
    )

    const { data: groupCurrenciesData } = api.group.getCurrencies.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )
    const [currency, setCurrency] = useState<string>('SGD')

    useEffect(() => {
        if (!groupCurrenciesData) return
        const def = groupCurrenciesData.find((c) => c.isDefault)?.code
        if (def) setCurrency(def)
    }, [groupCurrenciesData])

    useEffect(() => {
        if (usersData) {
            setUsers(usersData)
            const init: Record<string, boolean> = {}
            const initAmounts: Record<string, number> = {}
            usersData.forEach((u) => { init[u.id] = true; initAmounts[u.id] = 0 })
            setIsChecked(init)
            setManualAmounts(initAmounts)
            setPayAmounts(initAmounts)
            setPortions(Object.fromEntries(usersData.map((u) => [u.id, 1])))
            const even = evenPercents(usersData.length)
            setPercents(Object.fromEntries(usersData.map((u, i) => [u.id, even[i] ?? 0])))
            setLineItemMemberIds(usersData.map((u) => u.id))
            const userIds = new Set(usersData.map((u) => u.id))
            const preferred =
                (identity && userIds.has(identity) ? identity : null) ??
                defaultPayee ??
                usersData[0]?.id ??
                ''
            setPaidByUserId(preferred)
        }
        if (usersError) console.error('Error fetching users:', usersError)
    }, [usersData, usersError])

    useEffect(() => {
        if (!usersData) return
        const userIds = new Set(usersData.map((u) => u.id))
        if (identity && userIds.has(identity)) {
            setPaidByUserId(identity)
        } else if (defaultPayee) {
            setPaidByUserId(defaultPayee)
        }
    }, [identity, defaultPayee, usersData])

    const fileInputRef = useRef<HTMLInputElement>(null)

    const scanReceipt = api.receipt.scan.useMutation({
        onSuccess: (data) => {
            if (data.total !== null) {
                setAmount(data.total)
                setRawAmount(String(data.total))
                // A total off the receipt covers tax and service the items don't,
                // so it outranks the running item sum from here on.
                setAmountTouched(true)
            } else {
                alert('Could not detect a total on this receipt. Please enter the amount manually.')
            }
            if (data.category) setScanCategory(data.category)
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
    const lineItemsSum = lineItems.reduce((s, item) => s + item.amount, 0)

    // Key the items in and the total adds itself up, instead of sitting at 0
    // waiting to be typed twice. Stops the moment a total is entered by hand.
    useEffect(() => {
        if (amountTouched) return
        setAmount(lineItemsSum)
        setRawAmount(lineItemsSum > 0 ? lineItemsSum.toFixed(2) : '')
    }, [lineItemsSum, amountTouched])

    // What the group has called this before beats the built-in word list, and a
    // receipt the model actually read beats both. Offered as a tap, never
    // applied — an ambiguous title gets silence rather than a coin flip.
    const categoryGuess = categoryTouched
        ? null
        : scanCategory
            ?? suggestFromHistory(title, categoryHints ?? [])
            ?? suggestFromRules(title)
    const suggestedCategory = categoryGuess && categoryGuess !== category ? categoryGuess : null

    const applyItemsSum = () => {
        setAmount(lineItemsSum)
        setRawAmount(lineItemsSum.toFixed(2))
    }
    // Once the total is the user's own, an item sum that has drifted away from
    // it is offered rather than applied.
    const itemsSumDiffers =
        hasLineItems && lineItemsSum > 0 && Math.abs(lineItemsSum - amount) >= 0.01

    const createExpense = api.expense.create.useMutation({
        onSuccess: async (data) => {
            await Promise.all([
                utils.expense.getExpenses.invalidate({ groupId: data.id }),
                utils.expense.getTotalExpenseCost.invalidate({ groupId: data.id }),
                utils.expense.getBalances.invalidate({ groupId: data.id }),
            ])
            router.push(`/groups/${data.id}/expenses`)
        },
        onError: (error) => {
            console.error('Error creating expense:', error)
            alert(error.message || 'Failed to create expense')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const multiPay = payMode === 'multiple'
            ? Object.entries(payAmounts).filter(([, v]) => v > 0).map(([userId, amt]) => ({ userId, amount: amt }))
            : undefined
        if (hasLineItems) {
            const splitAmounts = Object.entries(lineItemTotals)
                .filter(([, v]) => v > 0)
                .map(([userId, amt]) => ({ userId, amount: amt }))
            createExpense.mutate({
                title, groupId: groupId ?? '', paidByUserId,
                createdByUserId: identity ?? undefined,
                amount, currency, category, notes, expenseDate, splitAmounts,
                payAmounts: multiPay,
            })
        } else {
            const payload = activeModeConfig.toPayload(splitCtx)
            createExpense.mutate({
                title, groupId: groupId ?? '', paidByUserId,
                createdByUserId: identity ?? undefined,
                amount, currency, category, notes, expenseDate, ...payload,
                payAmounts: multiPay,
            })
        }
    }

    const checkedCount = Object.values(isChecked).filter(Boolean).length
    const splitAmount = checkedCount > 0 ? amount / checkedCount : 0

    const activeModeConfig = SPLIT_MODES.find((m) => m.key === splitMode)!
    const splitCtx: SplitModeContext = { users, amount, isChecked, manualAmounts, portions, percents }
    const splitValid = activeModeConfig.validate(splitCtx)
    const manualTotal = Object.values(manualAmounts).reduce((s, v) => s + v, 0)
    const manualRemaining = amount - manualTotal

    // Portions / percentages: per-user amounts, pre-rounded to cents so what a
    // member sees on their row is exactly what gets stored.
    const portionTotal = sumWeights(users, portions)
    const percentTotal = sumWeights(users, percents)
    const percentRemaining = 100 - percentTotal
    const weightedAmounts =
        // While the percentages don't add up to 100 yet, show each row's literal
        // share of the total (50% of $100 is $50) rather than a normalised one,
        // so the gap stays visible instead of being silently spread around.
        splitMode === 'percent' && Math.abs(percentRemaining) >= 0.01
            ? users.map((u) => Math.round(amount * (percents[u.id] ?? 0)) / 100)
            : allocateByWeight(amount, users.map((u) => (splitMode === 'percent' ? percents : portions)[u.id] ?? 0))

    const setPortion = (userId: string, value: number) => {
        setPortionsTouched(true)
        setPortions((prev) => ({ ...prev, [userId]: Math.max(0, Math.round(value * 100) / 100) }))
    }

    const setPercent = (userId: string, value: number) => {
        setPercentsTouched(true)
        setPercents((prev) => ({ ...prev, [userId]: Math.max(0, Math.min(100, value)) }))
    }

    /** Spread 100% evenly across the members who currently have a share. */
    const balancePercents = () => {
        const ids = users.filter((u) => (percents[u.id] ?? 0) > 0).map((u) => u.id)
        const targets = ids.length > 0 ? ids : users.map((u) => u.id)
        const even = evenPercents(targets.length)
        const next: Record<string, number> = Object.fromEntries(users.map((u) => [u.id, 0]))
        targets.forEach((id, i) => { next[id] = even[i] ?? 0 })
        setPercentsTouched(true)
        setPercents(next)
    }

    // Opening Portions/% for the first time carries over who was ticked in Even
    // mode, so an unticked member doesn't silently get a share.
    const selectMode = (mode: SplitMode) => {
        setSplitMode(mode)
        const selected = users.filter((u) => isChecked[u.id])
        const targets = selected.length > 0 ? selected : users
        if (mode === 'portions' && !portionsTouched) {
            setPortions(Object.fromEntries(
                users.map((u) => [u.id, targets.some((t) => t.id === u.id) ? 1 : 0])
            ))
        }
        if (mode === 'percent' && !percentsTouched) {
            const even = evenPercents(targets.length)
            const next: Record<string, number> = Object.fromEntries(users.map((u) => [u.id, 0]))
            targets.forEach((t, i) => { next[t.id] = even[i] ?? 0 })
            setPercents(next)
        }
    }

    const splitSummary = (): string => {
        if (hasLineItems) {
            return scannedLineItems.length > 0 ? 'Totals from receipt items' : 'Totals from items'
        }
        if (splitMode === 'even') {
            return checkedCount > 0 && amount > 0
                ? `$${splitAmount.toFixed(2)} each · ${checkedCount} of ${users.length} selected`
                : `${checkedCount} of ${users.length} selected`
        }
        if (splitMode === 'portions') {
            if (portionTotal <= 0) return 'Give at least one person a portion'
            const label = `${formatPortion(portionTotal)} portion${portionTotal === 1 ? '' : 's'}`
            return amount > 0
                ? `${label} · $${(amount / portionTotal).toFixed(2)} per portion`
                : `${label} · enter an amount above`
        }
        if (splitMode === 'percent') {
            if (Math.abs(percentRemaining) < 0.01) {
                return amount > 0 ? 'All assigned' : 'Enter an amount above first'
            }
            return `${formatPortion(Math.abs(percentRemaining))}% ${percentRemaining > 0 ? 'left' : 'over'}`
        }
        if (amount <= 0) return 'Enter an amount above first'
        return Math.abs(manualRemaining) < 0.01
            ? 'All assigned'
            : `$${Math.abs(manualRemaining).toFixed(2)} ${manualRemaining > 0 ? 'remaining' : 'over'}`
    }

    const payTotal = Object.values(payAmounts).reduce((s, v) => s + v, 0)
    const payRemaining = amount - payTotal
    const payValid = payMode === 'single' || (amount > 0 && Math.abs(payRemaining) < 0.01 && Object.values(payAmounts).some((v) => v > 0))

    const hasOp = /[+*/]/.test(rawAmount) || rawAmount.slice(1).includes('-')
    const exprPreview = hasOp ? evalExpr(rawAmount) : null

    const toolbarButton: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        background: 'none', border: '1px solid var(--border-2)',
        borderRadius: '6px', padding: '0.3125rem 0.625rem',
        fontSize: '0.75rem', fontFamily: 'var(--font-ui), sans-serif',
        transition: 'color 0.15s, border-color 0.15s',
        whiteSpace: 'nowrap',
    }

    const stepperButton: React.CSSProperties = {
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        border: '1px solid var(--border-2)',
        background: 'none',
        color: 'var(--dim)',
        fontSize: '0.875rem',
        lineHeight: 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
    }

    const allNames = users.map((u) => u.name)
    const submitDisabled = createExpense.isPending
        || !payValid
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
                        <span style={{ fontFamily: 'var(--font-display), serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--heading)' }}>
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
                            <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                                {!hasLineItems && (
                                    <button
                                        type="button"
                                        onClick={addLineItem}
                                        style={{ ...toolbarButton, color: 'var(--dim)', cursor: 'pointer' }}
                                    >
                                        <span style={{ fontSize: '0.9375rem', lineHeight: 1 }}>+</span> Items
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={scanReceipt.isPending}
                                    style={{
                                        ...toolbarButton,
                                        color: scanReceipt.isPending ? 'var(--muted)' : 'var(--dim)',
                                        cursor: scanReceipt.isPending ? 'default' : 'pointer',
                                    }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                        <circle cx="12" cy="13" r="4"/>
                                    </svg>
                                    {scanReceipt.isPending ? 'Scanning…' : 'Scan receipt'}
                                </button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                capture="environment"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Amount hero */}
                        <div style={{
                            textAlign: 'center',
                            paddingBottom: '1.375rem',
                            marginBottom: '1.375rem',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    style={{
                                        background: 'var(--surface-3)',
                                        border: '1px solid var(--border-2)',
                                        borderRadius: '6px',
                                        color: 'var(--dim)',
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        letterSpacing: '0.04em',
                                        padding: '0.3125rem 1.875rem 0.3125rem 0.625rem',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        appearance: 'none',
                                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23717171' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.5rem center',
                                        flexShrink: 0,
                                        alignSelf: 'center',
                                    }}
                                >
                                    {(groupCurrenciesData ?? []).map(({ code }) => (
                                        <option key={code} value={code}>{code}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="no-spinner"
                                    placeholder="0.00"
                                    value={rawAmount}
                                    onChange={(e) => {
                                        const raw = e.target.value
                                        setAmountTouched(true)
                                        setRawAmount(raw)
                                        const result = evalExpr(raw)
                                        setAmount(result !== null && result >= 0 ? result : parseFloat(raw) || 0)
                                    }}
                                    onBlur={() => {
                                        const result = evalExpr(rawAmount)
                                        if (result !== null && result >= 0) {
                                            const fmt = result % 1 === 0 ? String(result) : result.toFixed(2)
                                            setRawAmount(fmt)
                                            setAmount(result)
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            const result = evalExpr(rawAmount)
                                            if (result !== null && result >= 0) {
                                                const fmt = result % 1 === 0 ? String(result) : result.toFixed(2)
                                                setRawAmount(fmt)
                                                setAmount(result)
                                            }
                                        }
                                    }}
                                    required
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: '2.75rem',
                                        fontWeight: 600,
                                        fontFamily: 'var(--font-mono), monospace',
                                        color: amount > 0 ? 'var(--heading)' : 'var(--muted)',
                                        textAlign: 'center',
                                        minWidth: '8ch',
                                        width: `${Math.max(8, rawAmount.length + 1)}ch`,
                                        padding: 0,
                                        lineHeight: 1.15,
                                    }}
                                />
                            </div>
                            {exprPreview !== null && (
                                <div style={{
                                    fontSize: '0.875rem',
                                    color: 'var(--muted)',
                                    fontFamily: 'var(--font-mono), monospace',
                                    marginTop: '0.375rem',
                                    textAlign: 'center',
                                }}>
                                    = {exprPreview.toFixed(2)}
                                </div>
                            )}
                            {itemsSumDiffers && (
                                <button
                                    type="button"
                                    onClick={applyItemsSum}
                                    style={{
                                        display: 'block',
                                        margin: '0.375rem auto 0',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        color: 'var(--dim)',
                                        fontSize: '0.75rem',
                                        fontFamily: 'var(--font-ui), sans-serif',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        textUnderlineOffset: '2px',
                                    }}
                                >
                                    Items add up to {currency} {lineItemsSum.toFixed(2)} — use that
                                </button>
                            )}
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
                                <label className="field-label">Date</label>
                                <input
                                    className="field-input"
                                    type="date"
                                    value={`${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`}
                                    onChange={(e) => {
                                        const [y, m, d] = e.target.value.split('-').map(Number)
                                        setExpenseDate(new Date(y!, m! - 1, d!))
                                    }}
                                />
                            </div>

                            <div className="field-group">
                                <label className="field-label">Category</label>
                                <select
                                    className="field-select"
                                    value={category}
                                    onChange={(e) => {
                                        setCategoryTouched(true)
                                        setCategory(e.target.value)
                                    }}
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                {suggestedCategory && (
                                    <button
                                        type="button"
                                        onClick={() => setCategory(suggestedCategory)}
                                        aria-label={`Use suggested category ${suggestedCategory}`}
                                        style={{
                                            alignSelf: 'flex-start',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            background: 'none',
                                            border: '1px dashed var(--border-2)',
                                            borderRadius: '999px',
                                            padding: '0.1875rem 0.5rem',
                                            color: 'var(--amber)',
                                            fontSize: '0.6875rem',
                                            fontFamily: 'var(--font-ui), sans-serif',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <span style={{ color: 'var(--muted)' }}>Use</span>
                                        {suggestedCategory}
                                    </button>
                                )}
                            </div>

                            <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                                    <label className="field-label" style={{ margin: 0 }}>Paid by</label>
                                    <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                        {(['single', 'multiple'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setPayMode(mode)}
                                                style={{
                                                    padding: '0.2rem 0.5rem',
                                                    fontSize: '0.7rem',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontFamily: 'var(--font-ui), sans-serif',
                                                    background: payMode === mode ? 'var(--surface-3)' : 'none',
                                                    color: payMode === mode ? 'var(--heading)' : 'var(--dim)',
                                                    transition: 'background 0.15s, color 0.15s',
                                                }}
                                            >
                                                {mode === 'single' ? 'One' : 'Multiple'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {payMode === 'single' ? (
                                    <select
                                        className="field-select"
                                        value={paidByUserId}
                                        onChange={(e) => setPaidByUserId(e.target.value)}
                                    >
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        {users.map((user) => (
                                            <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--body)' }}>{user.name}</span>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={payAmounts[user.id] || ''}
                                                    onChange={(e) =>
                                                        setPayAmounts({
                                                            ...payAmounts,
                                                            [user.id]: parseFloat(e.target.value) || 0,
                                                        })
                                                    }
                                                    className="font-mono no-spinner"
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
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                                            {amount > 0 && Math.abs(payRemaining) < 0.01 ? (
                                                <span style={{ color: 'var(--green)' }}>All assigned</span>
                                            ) : amount > 0 ? (
                                                <span style={{ color: Math.abs(payRemaining) < 0.005 ? 'var(--green)' : 'var(--muted)' }}>
                                                    {currency} {Math.abs(payRemaining).toFixed(2)} {payRemaining > 0 ? 'remaining' : 'over'}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                )}
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
                                    {scannedLineItems.length > 0 ? 'Receipt items' : 'Items'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setLineItems(scannedLineItems.map((item) => ({ ...item, participantIds: [] })))}
                                    style={{
                                        background: 'none', border: '1px solid var(--border-2)',
                                        borderRadius: '6px', padding: '0.3125rem 0.625rem',
                                        color: 'var(--dim)', fontSize: '0.75rem',
                                        fontFamily: 'var(--font-ui), sans-serif',
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
                                                fontFamily: 'var(--font-ui), sans-serif',
                                                fontSize: initials.length > 1 ? '0.5625rem' : '0.625rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'background 0.15s, color 0.15s',
                                                background: included ? 'var(--amber)' : 'var(--surface-3)',
                                                color: included ? 'var(--ink)' : 'var(--muted)',
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
                                            aria-label="Item name"
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
                                                fontFamily: 'var(--font-ui), sans-serif',
                                            }}
                                        />
                                        {/* Amount — fixed width, no spinners */}
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            step="0.01"
                                            aria-label="Item amount"
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
                                                            fontFamily: 'var(--font-ui), sans-serif',
                                                            fontSize: initials.length > 1 ? '0.5625rem' : '0.625rem',
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            transition: 'background 0.15s, color 0.15s',
                                                            background: selected ? 'var(--amber)' : 'var(--surface-3)',
                                                            color: selected ? 'var(--ink)' : 'var(--muted)',
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
                                    fontSize: '0.75rem', fontFamily: 'var(--font-ui), sans-serif',
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
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                    Split between
                                </div>
                                <div className="section-sub">{splitSummary()}</div>
                            </div>
                            {/* Mode toggle — hidden when line items are active */}
                            {!hasLineItems && (
                                <div style={{ display: 'flex', border: '1px solid var(--border-2)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                                    {SPLIT_MODES.map(({ key, label, title }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => selectMode(key)}
                                            title={title}
                                            aria-pressed={splitMode === key}
                                            style={{
                                                padding: '0.25rem 0.625rem',
                                                fontSize: '0.75rem',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontFamily: 'var(--font-ui), sans-serif',
                                                background: splitMode === key ? 'var(--surface-3)' : 'none',
                                                color: splitMode === key ? 'var(--heading)' : 'var(--dim)',
                                                transition: 'background 0.15s, color 0.15s',
                                                whiteSpace: 'nowrap',
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
                                    >
                                        <input
                                            type="checkbox"
                                            id={`split-${user.id}`}
                                            checked={!!isChecked[user.id]}
                                            onChange={() =>
                                                setIsChecked({ ...isChecked, [user.id]: !isChecked[user.id] })
                                            }
                                        />
                                        <label htmlFor={`split-${user.id}`} style={{ flex: 1 }}>{user.name}</label>
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
                            : splitMode === 'portions'
                                ? users.map((user, i) => {
                                    const portion = portions[user.id] ?? 0
                                    const share = weightedAmounts[i] ?? 0
                                    return (
                                        <div
                                            key={user.id}
                                            className="check-row"
                                            style={{ cursor: 'default' }}
                                        >
                                            <label style={{ flex: 1, opacity: portion > 0 ? 1 : 0.45 }}>{user.name}</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.75rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setPortion(user.id, portion - 1)}
                                                    disabled={portion <= 0}
                                                    aria-label={`Fewer portions for ${user.name}`}
                                                    style={{ ...stepperButton, opacity: portion <= 0 ? 0.4 : 1 }}
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="0.5"
                                                    placeholder="0"
                                                    aria-label={`Portions for ${user.name}`}
                                                    value={portion || ''}
                                                    onChange={(e) => setPortion(user.id, parseFloat(e.target.value) || 0)}
                                                    className="font-mono no-spinner"
                                                    style={{
                                                        width: '2.75rem',
                                                        background: 'none',
                                                        border: 'none',
                                                        borderBottom: '1px solid var(--border-2)',
                                                        color: portion > 0 ? 'var(--heading)' : 'var(--muted)',
                                                        fontSize: '0.875rem',
                                                        textAlign: 'center',
                                                        outline: 'none',
                                                        padding: '0.125rem 0',
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setPortion(user.id, portion + 1)}
                                                    aria-label={`More portions for ${user.name}`}
                                                    style={stepperButton}
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span
                                                className="font-mono"
                                                style={{
                                                    fontSize: '0.875rem',
                                                    color: share > 0 ? 'var(--heading)' : 'var(--muted)',
                                                    minWidth: '4.5rem',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {share > 0 ? `$${share.toFixed(2)}` : '—'}
                                            </span>
                                        </div>
                                    )
                                })
                            : splitMode === 'percent'
                                ? (
                                    <>
                                        {users.map((user, i) => {
                                            const percent = percents[user.id] ?? 0
                                            const share = weightedAmounts[i] ?? 0
                                            return (
                                                <div
                                                    key={user.id}
                                                    className="check-row"
                                                    style={{ cursor: 'default' }}
                                                >
                                                    <label style={{ flex: 1, opacity: percent > 0 ? 1 : 0.45 }}>{user.name}</label>
                                                    <span
                                                        className="font-mono"
                                                        style={{
                                                            fontSize: '0.8125rem',
                                                            color: 'var(--muted)',
                                                            marginRight: '0.75rem',
                                                        }}
                                                    >
                                                        {share > 0 ? `$${share.toFixed(2)}` : '—'}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        placeholder="0"
                                                        aria-label={`Percentage for ${user.name}`}
                                                        value={percent || ''}
                                                        onChange={(e) => setPercent(user.id, parseFloat(e.target.value) || 0)}
                                                        className="font-mono no-spinner"
                                                        style={{
                                                            width: '3.5rem',
                                                            background: 'none',
                                                            border: 'none',
                                                            borderBottom: '1px solid var(--border-2)',
                                                            color: percent > 0 ? 'var(--heading)' : 'var(--muted)',
                                                            fontSize: '0.875rem',
                                                            textAlign: 'right',
                                                            outline: 'none',
                                                            padding: '0.125rem 0',
                                                        }}
                                                    />
                                                    <span style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginLeft: '0.25rem' }}>%</span>
                                                </div>
                                            )
                                        })}
                                        {users.length > 0 && Math.abs(percentRemaining) >= 0.01 && (
                                            <button
                                                type="button"
                                                onClick={balancePercents}
                                                style={{
                                                    marginTop: '0.5rem',
                                                    background: 'none', border: 'none',
                                                    color: 'var(--dim)', cursor: 'pointer',
                                                    fontSize: '0.75rem', fontFamily: 'var(--font-ui), sans-serif',
                                                    padding: '0.25rem 0',
                                                }}
                                            >
                                                Balance to 100%
                                            </button>
                                        )}
                                    </>
                                )
                                : users.map((user) => (
                                    <div
                                        key={user.id}
                                        className="check-row"
                                        style={{ cursor: 'default' }}
                                    >
                                        <label style={{ flex: 1 }}>{user.name}</label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
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
