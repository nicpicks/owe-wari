import Link from 'next/link'

export default function Home() {
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
            {/* Radial background glow */}
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
                    background: 'radial-gradient(circle, rgba(242,160,7,0.05) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Decorative kanji — 割 (split) */}
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
                割
            </div>

            {/* Content */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2rem',
                    maxWidth: '560px',
                    width: '100%',
                }}
            >
                {/* Wordmark */}
                <div
                    className="anim-fade-up d-0"
                    style={{ textAlign: 'center' }}
                >
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                        }}
                    >
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'var(--amber)',
                                display: 'inline-block',
                            }}
                        />
                        <span
                            style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: 'var(--amber)',
                            }}
                        >
                            Group Expense Tracker
                        </span>
                    </div>
                    <h1
                        style={{
                            fontFamily: 'var(--font-cormorant), serif',
                            fontSize: 'clamp(3.5rem, 12vw, 6rem)',
                            fontWeight: 600,
                            fontStyle: 'italic',
                            color: 'var(--heading)',
                            letterSpacing: '-0.03em',
                            lineHeight: 0.9,
                            margin: 0,
                        }}
                    >
                        owe-wari
                    </h1>
                </div>

                {/* Tagline */}
                <p
                    className="anim-fade-up d-1"
                    style={{
                        fontSize: '1rem',
                        color: 'var(--dim)',
                        textAlign: 'center',
                        lineHeight: 1.6,
                        maxWidth: '340px',
                        margin: 0,
                    }}
                >
                    Split expenses with friends. Track who paid. Settle up with zero awkwardness.
                </p>

                {/* Preview cards */}
                <div
                    className="anim-fade-up d-2"
                    style={{
                        display: 'flex',
                        gap: '0.75rem',
                        width: '100%',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    {[
                        { name: 'Alice', paid: '+$48.00', label: 'Airport taxi' },
                        { name: 'Bob', paid: '–$16.00', owe: true, label: 'owes' },
                        { name: 'Clara', paid: '+$29.50', label: 'Dinner' },
                    ].map((item, i) => (
                        <div
                            key={i}
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                padding: '0.875rem 1rem',
                                flex: '1 1 120px',
                                maxWidth: '160px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '0.6875rem',
                                    color: 'var(--muted)',
                                    marginBottom: '0.375rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    fontWeight: 600,
                                }}
                            >
                                {item.name}
                            </div>
                            <div
                                style={{
                                    fontFamily: 'var(--font-mono), monospace',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: item.owe ? 'var(--red)' : 'var(--green)',
                                }}
                            >
                                {item.paid}
                            </div>
                            <div
                                style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--muted)',
                                    marginTop: '0.25rem',
                                }}
                            >
                                {item.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="anim-fade-up d-3" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link href="/groups/create">
                        <button className="btn-amber" style={{ fontSize: '0.9375rem', padding: '0.75rem 2rem' }}>
                            Start a group
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </Link>
                </div>

                {/* Footer note */}
                <p
                    className="anim-fade-in d-4"
                    style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        textAlign: 'center',
                    }}
                >
                    No accounts. No tracking. Just math.
                </p>
            </div>
        </main>
    )
}
