'use client'

import { useEffect, useState } from 'react'
import { api } from '~/trpc/react'
import { useGroupIdentity } from './use-group-identity'

interface IdentifySelfModalProps {
    groupId: string
}

export function IdentifySelfModal({ groupId }: IdentifySelfModalProps) {
    const { identity, setIdentity, isLoaded } = useGroupIdentity(groupId)
    const [dismissed, setDismissed] = useState(false)

    const { data: users } = api.group.getUsers.useQuery(
        { groupId },
        { enabled: !!groupId }
    )

    const open = isLoaded && identity === null && !dismissed && !!users && users.length > 0

    useEffect(() => {
        if (!open) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDismissed(true)
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [open])

    if (!open) return null

    return (
        <div className="modal-overlay" onClick={() => setDismissed(true)}>
            <div
                className="card-dark modal-card"
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    padding: '1.5rem',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
                        <div
                            aria-hidden
                            style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                background: 'var(--vermillion)',
                                color: '#FFF6E6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-display), serif',
                                fontWeight: 800,
                                fontSize: '0.9375rem',
                                transform: 'rotate(-5deg)',
                                flexShrink: 0,
                            }}
                        >
                            君
                        </div>
                        <div
                            style={{
                                fontFamily: 'var(--font-display), serif',
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: 'var(--heading)',
                            }}
                        >
                            Who are you?
                        </div>
                    </div>
                    <div className="section-sub" style={{ fontSize: '0.8125rem' }}>
                        Pick yourself from the group. We&apos;ll remember on this device so new expenses are logged under your name.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {users?.map((u, i) => (
                        <button
                            key={u.id}
                            type="button"
                            onClick={() => setIdentity(u.id)}
                            className={`anim-fade-up d-${Math.min(i + 1, 8)}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6875rem',
                                background: 'var(--surface-3)',
                                border: '1px solid var(--border-2)',
                                color: 'var(--heading)',
                                borderRadius: '10px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                                fontFamily: 'var(--font-ui), sans-serif',
                            }}
                        >
                            <span
                                aria-hidden
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border-2)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    color: 'var(--dim)',
                                    flexShrink: 0,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {u.name.charAt(0)}
                            </span>
                            I&apos;m {u.name}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    Not now
                </button>
            </div>
        </div>
    )
}
