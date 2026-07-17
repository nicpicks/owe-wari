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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            style={{ padding: '1rem' }}
            onClick={() => setDismissed(true)}
        >
            <div
                className="card-dark"
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    padding: '1.5rem',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ marginBottom: '1rem' }}>
                    <div
                        style={{
                            fontFamily: 'var(--font-display), serif',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'var(--heading)',
                            marginBottom: '0.25rem',
                        }}
                    >
                        Who are you?
                    </div>
                    <div className="section-sub" style={{ fontSize: '0.8125rem' }}>
                        Pick yourself from the group. We&apos;ll remember on this device so new expenses are logged under your name.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {users?.map((u) => (
                        <button
                            key={u.id}
                            type="button"
                            onClick={() => setIdentity(u.id)}
                            style={{
                                background: 'var(--surface-3)',
                                border: '1px solid var(--border-2)',
                                color: 'var(--heading)',
                                borderRadius: '8px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                fontFamily: 'var(--font-ui), sans-serif',
                            }}
                        >
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
