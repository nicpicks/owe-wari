'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Crockford base32 ULID — 26 chars
const GROUP_PATH_RE = /\/groups\/([0-9A-HJKMNP-TV-Z]{26})/i

function isPWA() {
    if (typeof window === 'undefined') return false
    return (
        (window.navigator as { standalone?: boolean }).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches
    )
}

function extractGroupId(text: string): string | null {
    const m = GROUP_PATH_RE.exec(text)
    return m ? m[1]!.toUpperCase() : null
}

type State = 'idle' | 'checking' | 'not-found'

export function ClipboardGroupOpener() {
    const router = useRouter()
    const [show, setShow] = useState(false)
    const [state, setState] = useState<State>('idle')

    useEffect(() => {
        setShow(isPWA())
    }, [])

    if (!show) return null

    async function handleCheck() {
        setState('checking')
        try {
            const text = await navigator.clipboard.readText()
            const id = extractGroupId(text)
            if (id) {
                router.push(`/groups/${id}`)
                return
            }
        } catch {
            // clipboard read denied or unavailable
        }
        setState('not-found')
        setTimeout(() => setState('idle'), 2500)
    }

    const notFound = state === 'not-found'

    return (
        <div className="anim-fade-in" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <button
                onClick={handleCheck}
                disabled={state === 'checking'}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'transparent',
                    border: 'none',
                    padding: '0.25rem 0',
                    cursor: state === 'checking' ? 'default' : 'pointer',
                    fontSize: '0.8125rem',
                    color: notFound ? 'var(--red)' : 'var(--dim)',
                    transition: 'color 0.15s',
                    fontFamily: 'inherit',
                }}
            >
                {notFound ? (
                    <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        No group link in clipboard
                    </>
                ) : state === 'checking' ? (
                    <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Checking…
                    </>
                ) : (
                    <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3" />
                        </svg>
                        Open group from clipboard
                    </>
                )}
            </button>
        </div>
    )
}
