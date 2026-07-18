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
        { key: 'summary',  label: 'Summary',  glyph: '帳' },
        { key: 'expenses', label: 'Expenses', glyph: '費' },
        { key: 'totals',   label: 'Totals',   glyph: '計' },
        { key: 'balances', label: 'Balances', glyph: '割' },
        { key: 'history',  label: 'History',  glyph: '歴' },
        { key: 'settings', label: 'Settings', glyph: '設' },
    ]

    return (
        <div>
            {group?.name && (
                <div style={{ textAlign: 'center', padding: '1rem 1rem 0', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {group.name}
                    {group.tripUrl && (
                        <>
                            {' · '}
                            <a
                                href={group.tripUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--green)', textDecoration: 'none' }}
                            >
                                Itinerary ↗
                            </a>
                        </>
                    )}
                </div>
            )}
            <nav className="tab-bar" style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}>
                <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', width: '100%', padding: '0 1rem' }}>
                    {tabs.map(({ key, label, glyph }) => {
                        const active = pathname.includes(key)
                        return (
                            <button
                                key={key}
                                className={`tab-item${active ? ' active' : ''}`}
                                onClick={() => navigateToTab(key)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4375rem' }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        fontFamily: 'var(--font-display), serif',
                                        fontSize: '0.9375rem',
                                        lineHeight: 1,
                                        textShadow: active ? '0 0 14px var(--amber)' : 'none',
                                    }}
                                >
                                    {glyph}
                                </span>
                                {label}
                            </button>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}

export default Tabs
