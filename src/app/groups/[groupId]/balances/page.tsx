'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'
import { simplifyDebts } from '~/lib/simplify-debts'

const BalancesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''
    const [settlingKey, setSettlingKey] = useState<string | null>(null)

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const utils = api.useUtils()

    const { data: balances, isLoading } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const settleUp = api.expense.settleUp.useMutation({
        onSuccess: async () => {
            await utils.expense.getBalances.invalidate({ groupId })
            setSettlingKey(null)
        },
        onError: (error) => {
            console.error('Error settling up:', error)
            alert('Failed to settle up')
            setSettlingKey(null)
        },
    })

    const transfers = balances ? simplifyDebts(balances) : []

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                {/* Balances card */}
                <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Balances</div>
                        <div className="section-sub">Net position — positive means you're owed</div>
                    </div>

                    {isLoading && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Loading…</p>
                    )}

                    {balances?.map(({ userId, name, netBalance }, i) => (
                        <div
                            key={userId}
                            className={`ledger-row anim-fade-up d-${Math.min(i + 1, 8)}`}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <div
                                    style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        background: netBalance > 0.005
                                            ? 'rgba(52,211,153,0.1)'
                                            : netBalance < -0.005
                                            ? 'rgba(248,113,113,0.1)'
                                            : 'var(--surface-3)',
                                        border: `1px solid ${netBalance > 0.005 ? 'rgba(52,211,153,0.2)' : netBalance < -0.005 ? 'rgba(248,113,113,0.2)' : 'var(--border-2)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        color: netBalance > 0.005 ? 'var(--green)' : netBalance < -0.005 ? 'var(--red)' : 'var(--muted)',
                                        textTransform: 'uppercase',
                                        flexShrink: 0,
                                    }}
                                >
                                    {name.charAt(0)}
                                </div>
                                <span style={{ color: 'var(--body)', fontSize: '0.9375rem' }}>{name}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
                                <span
                                    className="font-mono"
                                    style={{
                                        fontSize: '0.9375rem',
                                        fontWeight: 600,
                                        color: netBalance > 0.005
                                            ? 'var(--green)'
                                            : netBalance < -0.005
                                            ? 'var(--red)'
                                            : 'var(--muted)',
                                    }}
                                >
                                    {netBalance > 0.005
                                        ? `+$${netBalance.toFixed(2)}`
                                        : netBalance < -0.005
                                        ? `–$${Math.abs(netBalance).toFixed(2)}`
                                        : '—'}
                                </span>
                                {Math.abs(netBalance) < 0.005 && (
                                    <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>settled</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Settle up card */}
                <div className="card-dark anim-fade-up d-2">
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div className="section-title">Settle up</div>
                        <div className="section-sub">
                            {transfers.length > 0
                                ? `${transfers.length} transfer${transfers.length !== 1 ? 's' : ''} to clear all debts`
                                : 'No outstanding debts'}
                        </div>
                    </div>

                    {isLoading && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Loading…</p>
                    )}

                    {!isLoading && transfers.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 0' }}>
                            <div
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: 'var(--green)',
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{ color: 'var(--green)', fontSize: '0.875rem', fontWeight: 500 }}>
                                Everyone is all square
                            </span>
                        </div>
                    )}

                    {transfers.map((transfer, i) => {
                        const key = `${transfer.from}-${transfer.to}`
                        const isSettling = settleUp.isPending && settlingKey === key
                        return (
                            <div
                                key={key}
                                className={`ledger-row anim-fade-up d-${Math.min(i + 3, 8)}`}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.9375rem', color: 'var(--body)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{transfer.fromName}</span>
                                        <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>→</span>
                                        <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{transfer.toName}</span>
                                    </div>
                                    <div
                                        className="font-mono"
                                        style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', marginTop: '0.125rem' }}
                                    >
                                        ${transfer.amount.toFixed(2)}
                                    </div>
                                </div>
                                <button
                                    className="btn-sm-settle"
                                    disabled={isSettling}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `Confirm: ${transfer.fromName} pays ${transfer.toName} $${transfer.amount.toFixed(2)}?`
                                            )
                                        ) {
                                            setSettlingKey(key)
                                            settleUp.mutate({
                                                groupId,
                                                payerId: transfer.from,
                                                receiverId: transfer.to,
                                                amount: transfer.amount,
                                            })
                                        }
                                    }}
                                >
                                    {isSettling ? '…' : 'Settle'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default BalancesTab
