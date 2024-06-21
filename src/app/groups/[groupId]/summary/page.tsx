'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'

const SummaryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [totalExpenses, setTotalExpenses] = useState<number>(0)
    const [currentShare, setCurrentShare] = useState<number>(0)
    const [remainingOwed, setRemainingOwed] = useState<number>(0)

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

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
                            <div className="font-bold"> {totalExpenses}</div>
                        </div>
                        <div className="mb-4">
                            <div className="text-primary mb-1">
                                Your Current Share:
                            </div>
                            <div className="font-bold"> {currentShare}</div>
                        </div>
                        <div className="mb-4">
                            <div className="text-primary mb-1">
                                Remaining Owed:
                            </div>
                            <div className="font-bold"> {remainingOwed}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SummaryTab
