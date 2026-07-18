import Link from 'next/link'
import { RecentGroupsList } from './groups/recent-groups-list'
import { ClipboardGroupOpener } from './_components/clipboard-group-opener'

/* Paper lantern — cord, caps, glowing ribbed body with a kanji, tassel */
const Lantern = ({
    kanji,
    size,
    cordHeight,
    side,
    offset,
    duration,
    delay,
    opacity = 1,
}: {
    kanji: string
    size: number
    cordHeight: number
    side: 'left' | 'right'
    offset: string
    duration: string
    delay?: string
    opacity?: number
}) => (
    <div
        aria-hidden
        style={{
            position: 'absolute',
            top: 0,
            [side]: offset,
            zIndex: 0,
            transformOrigin: '50% 0',
            animation: `sway ${duration} ease-in-out ${delay ?? '0s'} infinite`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            opacity,
        }}
    >
        <div style={{ width: '2px', height: `${cordHeight}px`, background: 'var(--border-2)' }} />
        <div style={{ width: `${size * 0.45}px`, height: '7px', background: '#3A2B1A', borderRadius: '3px' }} />
        <div
            style={{
                width: `${size}px`,
                height: `${size * 1.2}px`,
                borderRadius: '50% / 42%',
                background:
                    'repeating-linear-gradient(to bottom, rgba(0,0,0,0.16) 0 2px, transparent 2px 9px), radial-gradient(circle at 50% 35%, #FFC85C, var(--amber) 72%)',
                boxShadow: '0 0 48px 8px var(--amber-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <span
                style={{
                    fontFamily: 'var(--font-display), serif',
                    fontWeight: 800,
                    color: 'rgba(64,32,4,0.55)',
                    fontSize: `${size * 0.4}px`,
                }}
            >
                {kanji}
            </span>
        </div>
        <div style={{ width: `${size * 0.38}px`, height: '6px', background: '#3A2B1A', borderRadius: '3px' }} />
        <div style={{ width: '2px', height: `${size * 0.26}px`, background: 'var(--vermillion)' }} />
    </div>
)

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
                    background: 'radial-gradient(circle, rgba(255,174,31,0.07) 0%, transparent 70%)',
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
                    fontFamily: 'var(--font-display), serif',
                    fontWeight: 700,
                    color: 'transparent',
                    WebkitTextStroke: '1px rgba(255,174,31,0.06)',
                    lineHeight: 1,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    letterSpacing: '-0.04em',
                    animation: 'flicker 6s ease-in-out infinite',
                }}
            >
                割
            </div>

            {/* Hanging paper lanterns */}
            <Lantern kanji="割" size={58} cordHeight={52} side="right" offset="clamp(24px, 8vw, 120px)" duration="5.5s" />
            <Lantern kanji="酒" size={40} cordHeight={26} side="left" offset="clamp(20px, 7vw, 100px)" duration="6.5s" delay="-2.6s" opacity={0.85} />

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
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}
                >
                    <div
                        aria-hidden
                        style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '9px',
                            background: 'var(--vermillion)',
                            color: '#FFF6E6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-display), serif',
                            fontWeight: 800,
                            fontSize: '26px',
                            transform: 'rotate(-5deg)',
                            boxShadow: '0 6px 18px var(--vermillion-dim), inset 0 0 0 2px rgba(255,246,230,0.25)',
                        }}
                    >
                        割
                    </div>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
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
                    <div style={{ textAlign: 'center' }}>
                        <h1
                            style={{
                                fontFamily: 'var(--font-display), serif',
                                fontSize: 'clamp(3.5rem, 12vw, 6rem)',
                                fontWeight: 700,
                                color: 'var(--heading)',
                                letterSpacing: '-0.015em',
                                lineHeight: 0.9,
                                margin: 0,
                            }}
                        >
                            owe-wari
                        </h1>
                        <div
                            style={{
                                fontSize: '0.8125rem',
                                color: 'var(--dim)',
                                marginTop: '0.625rem',
                                letterSpacing: '0.5em',
                                fontWeight: 500,
                            }}
                        >
                            割り勘台帳
                        </div>
                    </div>
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

                <ClipboardGroupOpener />
                <RecentGroupsList />

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
