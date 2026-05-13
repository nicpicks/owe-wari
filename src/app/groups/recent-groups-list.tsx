'use client'

import Link from 'next/link'
import { useRecentGroups } from '~/app/_components/use-recent-groups'

function formatRelative(ts: number): string {
    const diff = Date.now() - ts
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < minute) return 'just now'
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`
    if (diff < day) return `${Math.floor(diff / hour)}h ago`
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function RecentGroupsList() {
    const { groups, isLoaded, removeGroup } = useRecentGroups()

    if (!isLoaded) return null
    if (groups.length === 0) return null

    return (
        <div
            className="anim-fade-up d-4"
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
            }}
        >
            <div
                style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    textAlign: 'center',
                }}
            >
                Recent groups
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0.5rem',
                }}
            >
                {groups.map((g) => (
                    <div
                        key={g.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <Link
                            href={`/groups/${g.id}`}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.625rem 0.875rem',
                                borderRadius: '8px',
                                background: 'var(--surface-3)',
                                color: 'var(--heading)',
                                textDecoration: 'none',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                transition: 'background 0.15s',
                            }}
                        >
                            <span
                                style={{
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    minWidth: 0,
                                }}
                            >
                                {g.name}
                            </span>
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--muted)',
                                    flexShrink: 0,
                                    marginLeft: '0.75rem',
                                }}
                            >
                                {formatRelative(g.lastVisited)}
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => removeGroup(g.id)}
                            aria-label={`Remove ${g.name} from recent`}
                            title="Remove from recent"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--muted)',
                                cursor: 'pointer',
                                padding: '0.25rem 0.5rem',
                                fontSize: '1rem',
                                lineHeight: 1,
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
