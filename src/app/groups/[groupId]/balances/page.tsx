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
    const [settlingTransfer, setSettlingTransfer] = useState<string | null>(null)

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
            setSettlingTransfer(null)
        },
        onError: (error) => {
            console.error('Error settling up:', error)
            alert('Failed to settle up')
            setSettlingTransfer(null)
        },
    })

    const transfers = balances ? simplifyDebts(balances) : []

    const formatAmount = (amount: number) =>
        Math.abs(amount).toFixed(2)

    return (
        <>
            <div className="flex flex-col max-w-screen-md w-full mx-auto">
                <div className="flex py-6">
                    <Tabs pathname={pathname} navigateToTab={navigateToTab} />
                </div>
                <div className="flex justify-center">
                    <div className="card w-full bg-gray-200 text-primary-content">
                        <div className="card-body">
                            <h2 className="card-title text-primary text-2xl">
                                Balances
                            </h2>
                            <p className="mb-4 text-gray-500 text-s">
                                Track how much you owe and are owed.
                            </p>
                            {isLoading && <p>Loading...</p>}
                            {balances && balances.length === 0 && (
                                <p className="text-gray-500">No members found.</p>
                            )}
                            {balances?.map(({ userId, name, netBalance }) => (
                                <div
                                    key={userId}
                                    className="flex items-center justify-between py-2 border-b border-gray-300 last:border-0"
                                >
                                    <span className="font-medium">{name}</span>
                                    <span
                                        className={
                                            netBalance > 0.005
                                                ? 'font-bold text-green-600'
                                                : netBalance < -0.005
                                                  ? 'font-bold text-red-500'
                                                  : 'text-gray-500'
                                        }
                                    >
                                        {netBalance > 0.005
                                            ? `+${formatAmount(netBalance)}`
                                            : netBalance < -0.005
                                              ? `-${formatAmount(netBalance)}`
                                              : 'settled'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-center py-6">
                    <div className="card w-full bg-gray-200 text-primary-content">
                        <div className="card-body">
                            <h2 className="card-title text-primary text-2xl">
                                Settle up
                            </h2>
                            <p className="mb-4 text-gray-500 text-s">
                                Suggested transfers to settle all debts.
                            </p>
                            {isLoading && <p>Loading...</p>}
                            {!isLoading && transfers.length === 0 && (
                                <p className="text-gray-500">
                                    Everyone is settled up!
                                </p>
                            )}
                            {transfers.map((transfer) => {
                                const key = `${transfer.from}-${transfer.to}`
                                return (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between py-3 border-b border-gray-300 last:border-0"
                                    >
                                        <span>
                                            <span className="font-medium">
                                                {transfer.fromName}
                                            </span>{' '}
                                            pays{' '}
                                            <span className="font-medium">
                                                {transfer.toName}
                                            </span>{' '}
                                            <span className="font-bold text-primary">
                                                ${transfer.amount.toFixed(2)}
                                            </span>
                                        </span>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            disabled={
                                                settleUp.isPending &&
                                                settlingTransfer === key
                                            }
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        `Confirm: ${transfer.fromName} pays ${transfer.toName} $${transfer.amount.toFixed(2)}?`
                                                    )
                                                ) {
                                                    setSettlingTransfer(key)
                                                    settleUp.mutate({
                                                        groupId,
                                                        payerId: transfer.from,
                                                        receiverId: transfer.to,
                                                        amount: transfer.amount,
                                                    })
                                                }
                                            }}
                                        >
                                            {settleUp.isPending &&
                                            settlingTransfer === key
                                                ? 'Settling...'
                                                : 'Settle'}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default BalancesTab
