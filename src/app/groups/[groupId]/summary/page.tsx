'use client'

import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'

const SummaryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: totalExpenses } = api.expense.getTotalExpenseCost.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const { data: balances } = api.expense.getBalances.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    return (
        <div className="flex flex-col max-w-screen-md w-full mx-auto">
            <div className="flex py-6">
                <Tabs pathname={pathname} navigateToTab={navigateToTab} />
            </div>
            <div className="flex justify-center">
                <div className="card w-full bg-gray-200 text-primary-content">
                    <div className="card-body">
                        <h2 className="card-title text-primary text-2xl">
                            Group Summary
                        </h2>
                        <p className="mb-6 text-gray-500">
                            Spending summary of the entire group.
                        </p>
                        <div className="mb-4">
                            <div className="text-primary mb-1">
                                Total Expenses:
                            </div>
                            <div className="font-bold">
                                {totalExpenses != null
                                    ? `$${Number(totalExpenses).toFixed(2)}`
                                    : '—'}
                            </div>
                        </div>
                        <div className="mb-2">
                            <div className="text-primary mb-2 font-medium">
                                Member Balances:
                            </div>
                            {!balances && <p className="text-gray-500">Loading...</p>}
                            {balances?.map(({ userId, name, netBalance }) => (
                                <div
                                    key={userId}
                                    className="flex items-center justify-between py-1"
                                >
                                    <span>{name}</span>
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
                                            ? `+$${netBalance.toFixed(2)}`
                                            : netBalance < -0.005
                                              ? `-$${Math.abs(netBalance).toFixed(2)}`
                                              : 'settled'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SummaryTab
