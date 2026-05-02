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

    const settleUp = api.expense.settleUp.useMutation({
        onSuccess: async () => {
            await utils.expense.getBalances.invalidate({ groupId })
            setPending(null)
        },
        onError: (error) => {
            console.error('Error settling up:', error)
            alert('Failed to settle up')
            setPending(null)
        },
    })

    // Group transfers by currency, then by (from, to) pair across currencies.
    const { transfersByCurrency, transfersByPair } = useMemo(() => {
        const byCurrency = new Map<string, Transfer[]>()
        const byPair = new Map<string, Transfer[]>()
        if (!balances) return { transfersByCurrency: byCurrency, transfersByPair: byPair }

        const currencies = Array.from(new Set(balances.map((b) => b.currency)))
        for (const code of currencies) {
            const subset = balances.filter((b) => b.currency === code)
            const transfers = simplifyDebts(subset)
            byCurrency.set(code, transfers)
            for (const t of transfers) {
                const key = `${t.from}|${t.to}`
                const arr = byPair.get(key) ?? []
                arr.push(t)
                byPair.set(key, arr)
            }
        }
        return { transfersByCurrency: byCurrency, transfersByPair: byPair }
    }, [balances])

    const allTransferKeys = Array.from(transfersByPair.keys())

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                {/* Per-currency balances */}
                <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Balances</div>
                        <div className="section-sub">Net position — positive means you&apos;re owed</div>
                    </div>

                    {isLoading && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Loading…</p>
                    )}

                    {isError && (
                        <p style={{ color: 'var(--red)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                            {error.message ?? 'Could not load balances — try refreshing.'}
                        </p>
                    )}

                    {Array.from(transfersByCurrency.entries()).length === 0 && !isLoading && !isError && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Everyone is all square</p>
                    )}

                    {Array.from(transfersByCurrency.entries()).map(([code, transfers]) => (
                        <div key={code} style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                {code}
                            </div>
                            {transfers.length === 0 && (
                                <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Settled</p>
                            )}
                            {transfers.map((t) => (
                                <div key={`${t.from}-${t.to}-${code}`} className="ledger-row">
                                    <div style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--body)' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{t.fromName}</span>
                                        <span style={{ color: 'var(--muted)', margin: '0 0.375rem' }}>→</span>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{t.toName}</span>
                                    </div>
                                    <span className="font-mono" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)' }}>
                                        {formatAmount(t.amount, code)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Settle up — one button per (from, to) pair */}
                <div className="card-dark anim-fade-up d-2">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Settle up</div>
                        <div className="section-sub">
                            {allTransferKeys.length === 0
                                ? 'No outstanding debts'
                                : `${allTransferKeys.length} pair${allTransferKeys.length !== 1 ? 's' : ''} to settle`}
                        </div>
                    </div>

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
                                    Settle
                                </button>
                            </div>
                        )
                    })}
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
