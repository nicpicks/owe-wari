'use client'

import { useEffect, useState } from 'react'

export function NetworkStatusBanner() {
    const [status, setStatus] = useState<'online' | 'offline' | 'restored' | null>(null)

    useEffect(() => {
        // Don't flash "restored" on initial mount if already online
        let restoreTimer: ReturnType<typeof setTimeout>

        function handleOffline() {
            clearTimeout(restoreTimer)
            setStatus('offline')
        }

        function handleOnline() {
            setStatus('restored')
            restoreTimer = setTimeout(() => setStatus(null), 2500)
        }

        window.addEventListener('offline', handleOffline)
        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('online', handleOnline)
            clearTimeout(restoreTimer)
        }
    }, [])

    if (!status) return null

    const isOffline = status === 'offline'

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                background: isOffline ? 'var(--surface-3)' : 'rgba(52,211,153,0.12)',
                borderBottom: `1px solid ${isOffline ? 'var(--border-2)' : 'rgba(52,211,153,0.25)'}`,
                color: isOffline ? 'var(--dim)' : 'var(--green)',
                transition: 'background 0.2s, color 0.2s',
            }}
        >
            {isOffline ? (
                <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                    </svg>
                    You&rsquo;re offline — changes won&rsquo;t save
                </>
            ) : (
                <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Back online
                </>
            )}
        </div>
    )
}
