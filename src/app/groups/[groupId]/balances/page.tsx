'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import Tabs from '~/app/_components/tabs'
import SettleUpModal from '~/app/_components/settle-up-modal'
import { api } from '~/trpc/react'
import { simplifyDebts, type Transfer } from '~/lib/simplify-debts'
import { formatAmount } from '~/lib/format-currency'

interface PendingSettle {
    fromUserId: string
    fromName: string
    toUserId: string
    toName: string
    lines: { currency: string; amount: number }[]
}

const BalancesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => router.push(`/groups/${groupId}/${tab}`)

    const utils = api.useUtils()

    const { data: balances, isLoading, isError, error } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    const { data: group } = api.group.getGroup.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const defaultCurrency = group?.currency ?? 'SGD'

    const [pending, setPending] = useState<PendingSettle | null>(null)
    // Pairs settled during this visit — kept on screen, dimmed, with a 済 stamp
    const [justSettled, setJustSettled] = useState<
        { key: string; fromName: string; toName: string; amountStr: string }[]
    >([])

    const settleUp = api.expense.settleUp.useMutation({
        onSuccess: async (_data, vars) => {
            if (pending) {
                setJustSettled((prev) => [
                    ...prev,
                    {
                        key: `${vars.payerId}|${vars.receiverId}`,
                        fromName: pending.fromName,
                        toName: pending.toName,
                        amountStr: vars.lines
                            .map((l) => formatAmount(l.amount, l.currency))
                            .join(' + '),
                    },
                ])
            }
            await utils.expense.getBalances.invalidate({ groupId })
            setPending(null)
        },
        onError: (error) => {
            console.error('Error settling up:', error)
            alert('Failed to settle up')
            setPending(null)
        },
    })

    // Group transfers by (from, to) pair, with one or more per-currency lines per pair.
    const transfersByPair = useMemo(() => {
        const byPair = new Map<string, Transfer[]>()
        if (!balances) return byPair
        const currencies = Array.from(new Set(balances.map((b) => b.currency)))
        for (const code of currencies) {
            const subset = balances.filter((b) => b.currency === code)
            const transfers = simplifyDebts(subset)
            for (const t of transfers) {
                const key = `${t.from}|${t.to}`
                const arr = byPair.get(key) ?? []
                arr.push(t)
                byPair.set(key, arr)
            }
        }
        return byPair
    }, [balances])

    const allTransferKeys = Array.from(transfersByPair.keys())
    const stampedRows = justSettled.filter((s) => !transfersByPair.has(s.key))

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                {/* Who owes whom — one row per (from, to) pair with an inline Settle CTA */}
                <div className="card-dark anim-fade-up d-0">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Who owes whom</div>
                        <div className="section-sub">
                            {isLoading
                                ? 'Loading…'
                                : isError
                                    ? 'Could not load — try refreshing'
                                    : allTransferKeys.length === 0
                                        ? 'Everyone is all square'
                                        : `${allTransferKeys.length} pair${allTransferKeys.length !== 1 ? 's' : ''} to settle · tap to stamp it paid`}
                        </div>
                    </div>

                    {isError && (
                        <p style={{ color: 'var(--red)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            {error.message ?? 'Could not load balances — try refreshing.'}
                        </p>
                    )}

                    {allTransferKeys.map((key) => {
                        const transfers = transfersByPair.get(key)!
                        const first = transfers[0]!
                        const lines = transfers.map((t) => ({ currency: t.currency, amount: t.amount }))
                        return (
                            <div key={key} className="ledger-row">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.9375rem', color: 'var(--body)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{first.fromName}</span>
                                        <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→</span>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{first.toName}</span>
                                    </div>
                                    <div className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                                        {transfers.map((t) => formatAmount(t.amount, t.currency)).join(' + ')}
                                    </div>
                                </div>
                                <button
                                    className="btn-sm-settle"
                                    onClick={() =>
                                        setPending({
                                            fromUserId: first.from,
                                            fromName: first.fromName,
                                            toUserId: first.to,
                                            toName: first.toName,
                                            lines,
                                        })
                                    }
                                >
                                    済 Settle
                                </button>
                            </div>
                        )
                    })}

                    {/* Freshly settled pairs — dimmed with a hanko stamp */}
                    {stampedRows.map((s) => (
                        <div key={s.key} className="ledger-row" style={{ opacity: 0.45, transition: 'opacity 0.35s' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.9375rem', color: 'var(--body)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{s.fromName}</span>
                                    <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→</span>
                                    <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{s.toName}</span>
                                </div>
                                <div className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                                    {s.amountStr}
                                </div>
                            </div>
                            <div className="stamp-seal" aria-label="Settled">済</div>
                        </div>
                    ))}
                </div>
            </div>

            <SettleUpModal
                open={!!pending}
                fromName={pending?.fromName ?? ''}
                toName={pending?.toName ?? ''}
                defaultCurrency={defaultCurrency}
                lines={pending?.lines ?? []}
                onClose={() => setPending(null)}
                isSubmitting={settleUp.isPending}
                onConfirm={(lines) => {
                    if (!pending) return
                    settleUp.mutate({
                        groupId,
                        payerId: pending.fromUserId,
                        receiverId: pending.toUserId,
                        lines,
                    })
                }}
            />
        </div>
    )
}

export default BalancesTab
