'use client'

export default function OfflinePage() {
    return (
        <main
            style={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Radial glow */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: '30%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(242,160,7,0.04) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Decorative kanji watermark */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 'clamp(280px, 40vw, 480px)',
                    fontFamily: 'var(--font-cormorant), serif',
                    fontWeight: 700,
                    color: 'transparent',
                    WebkitTextStroke: '1px rgba(242,160,7,0.04)',
                    lineHeight: 1,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    letterSpacing: '-0.04em',
                }}
            >
                圏
            </div>

            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.5rem',
                    maxWidth: '420px',
                    width: '100%',
                    textAlign: 'center',
                }}
            >
                {/* Icon */}
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                    }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                    </svg>
                </div>

                <div>
                    <h1
                        style={{
                            fontFamily: 'var(--font-cormorant), serif',
                            fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
                            fontWeight: 600,
                            fontStyle: 'italic',
                            color: 'var(--heading)',
                            letterSpacing: '-0.03em',
                            lineHeight: 1,
                            margin: '0 0 0.75rem',
                        }}
                    >
                        You&rsquo;re offline
                    </h1>
                    <p style={{ color: 'var(--dim)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
                        This page couldn&rsquo;t load without a connection. Check your network and try again.
                    </p>
                </div>

                <button
                    className="btn-ghost"
                    onClick={() => window.location.reload()}
                >
                    Try again
                </button>
            </div>
        </main>
    )
}
