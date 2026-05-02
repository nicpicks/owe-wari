'use client'

import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'
import { formatAmount } from '~/lib/format-currency'
import { formatRelative, formatAbsolute } from '~/lib/format-date'

const HistoryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString() ?? ''

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: events, isLoading } = api.expense.getHistory.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const hasEvents = !!events && events.length > 0

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                <div className="section-title anim-fade-up d-0" style={{ marginBottom: '1.5rem' }}>History</div>

                {isLoading && (
                    <div className="card-dark anim-fade-up d-1">
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '0.5rem 0' }}>Loading…</p>
                    </div>
                )}

                {!isLoading && !hasEvents && (
                    <div
                        className="card-dark anim-fade-up d-1"
                        style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}
                    >
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border-2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.25rem',
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="8.5" stroke="var(--muted)" strokeWidth="1.25" />
                                <path d="M10 6v4.5l2.5 2.5" stroke="var(--muted)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <p className="section-sub">No activity yet.</p>
                    </div>
                )}

                {hasEvents && (
                    <div className="card-dark anim-fade-up d-1">
                        {events.map((event, i) => {
                            const initial = event.actorName.charAt(0).toUpperCase()
                            const amount = formatAmount(parseFloat(event.amount), event.currency)
                            const relative = formatRelative(event.at)
                            const absolute = formatAbsolute(event.at)

                            return (
                                <div
                                    key={`${event.type}-${event.id}`}
                                    className={`ledger-row anim-fade-up d-${Math.min(i + 1, 8)}`}
                                    style={{ alignItems: 'center', gap: '0.625rem' }}
                                >
                                    {/* Type icon */}
                                    <div
                                        aria-hidden
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '4px',
                                            background: event.type === 'expense' ? 'rgba(242,160,7,0.12)' : 'rgba(52,211,153,0.12)',
                                            color: event.type === 'expense' ? 'var(--amber)' : 'var(--green)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {event.type === 'expense' ? '+' : '↔'}
                                    </div>

                                    {/* Avatar */}
                                    <div
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: 'var(--surface-3)',
                                            border: '1px solid var(--border-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                            color: 'var(--dim)',
                                            textTransform: 'uppercase',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {initial}
                                    </div>

                                    {/* Description */}
                                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', color: 'var(--body)' }}>
                                        {event.type === 'expense' ? (
                                            <>
                                                <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
                                                {' added '}
                                                <span style={{ fontStyle: 'italic' }}>&quot;{event.title}&quot;</span>{' '}
                                                <span className="font-mono" style={{ color: 'var(--amber)' }}>{amount}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.actorName}</span>
                                                {' settled '}
                                                <span className="font-mono" style={{ color: 'var(--amber)' }}>{amount}</span>
                                                {' with '}
                                                <span style={{ fontWeight: 600, color: 'var(--heading)' }}>{event.receiverName}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <span
                                        title={absolute}
                                        style={{ color: 'var(--muted)', fontSize: '0.75rem', flexShrink: 0 }}
                                    >
                                        {relative}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default HistoryTab
