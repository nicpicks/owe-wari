'use client'

import { api } from '~/trpc/react'

const Tabs = ({
    pathname,
    navigateToTab,
}: {
    pathname: string
    navigateToTab: (tab: string) => void
}) => {
    const groupId = pathname.split('/')[2] ?? ''

    const { data: group } = api.group.getGroup.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const tabs = [
        { key: 'summary',  label: 'Summary' },
        { key: 'expenses', label: 'Expenses' },
        { key: 'balances', label: 'Balances' },
        { key: 'history',  label: 'History' },
        { key: 'settings', label: 'Settings' },
    ]

    return (
        <div>
            {group?.name && (
                <div style={{ textAlign: 'center', padding: '1rem 1rem 0', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {group.name}
                </div>
            )}
            <nav className="tab-bar" style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}>
                <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', width: '100%', padding: '0 1rem' }}>
                    {tabs.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`tab-item${pathname.includes(key) ? ' active' : ''}`}
                            onClick={() => navigateToTab(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    )
}

export default Tabs
