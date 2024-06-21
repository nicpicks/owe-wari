'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import SummaryTab from '~/app/groups/[groupId]/summary/page'
import ExpensesTab from './expenses/page'
import BalancesTab from './balances/page'
import HistoryTab from './history/page'
import SettingsTab from './settings/page'

export default function GroupPage() {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()

    const tabs = ['summary', 'expenses', 'balances', 'history', 'settings']

    const navigateToTab = (tab: string) => {
        debugger
        router.push(`/groups/${groupId}/${tab}`)
    }

    useEffect(() => {
        if (groupId && pathname.endsWith(groupId)) {
            router.push(`/groups/${groupId}/expenses`)
        }
    }, [pathname, groupId, router])

    return (
        <div className="flex-1 flex w-full max-w-screen-md mx-auto p-6 justify-center items-center">
            <div role="tablist" className="tabs tabs-boxed">
                {tabs.map((tab) => (
                    <a
                        key={tab}
                        role="tab"
                        className={`tab ${pathname.includes(tab) ? 'tab-active' : ''}`}
                        onClick={() => navigateToTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </a>
                ))}
            </div>
            <div className="tab-content">
                {groupId ? (
                    <>
                        {pathname.includes('summary') && <SummaryTab />}
                        {pathname.includes('expenses') && <ExpensesTab />}
                        {pathname.includes('balances') && <BalancesTab />}
                        {pathname.includes('history') && <HistoryTab />}
                        {pathname.includes('settings') && <SettingsTab />}
                    </>
                ) : null}
            </div>
        </div>
    )
}
