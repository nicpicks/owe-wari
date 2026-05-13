'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'dark' | 'light'>('dark')

    useEffect(() => {
        const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
        const initial = saved ?? 'dark'
        setTheme(initial)
        document.documentElement.setAttribute('data-theme', initial)
    }, [])

    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        document.documentElement.setAttribute('data-theme', next)
        localStorage.setItem('theme', next)
    }

    return (
        <button
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            style={{
                position: 'fixed',
                bottom: '1.25rem',
                right: '1.25rem',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '99px',
                border: '1px solid var(--border-2)',
                background: 'var(--surface-2)',
                color: 'var(--dim)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--body)'
                e.currentTarget.style.borderColor = 'var(--muted)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--dim)'
                e.currentTarget.style.borderColor = 'var(--border-2)'
            }}
        >
            {theme === 'dark' ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
            )}
            {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
    )
}
