'use client'

import { useEffect, useMemo } from 'react'

interface Props {
    /** Mount the storm. Unmounts itself when the last piece lands. */
    active: boolean
    onDone: () => void
    pieces?: number
}

/** Paper slips in the group's own palette — no rainbow, no libraries. */
const COLORS = ['var(--amber)', 'var(--vermillion)', 'var(--green)', 'var(--dim)']
/** A few slips land face-up: 済 (settled), 完 (done), 祝 (congratulations). */
const GLYPHS = ['済', '完', '祝']

const LONGEST_MS = 3400

interface Piece {
    left: number
    delay: number
    fall: number
    spin: number
    drift: number
    rx: number
    ry: number
    width: number
    height: number
    color: string
    glyph: string | null
    round: boolean
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

function makePieces(count: number): Piece[] {
    return Array.from({ length: count }, (_, i) => {
        const glyph = i % 7 === 3 ? GLYPHS[Math.floor(rand(0, GLYPHS.length))]! : null
        const width = glyph ? 22 : rand(6, 11)
        return {
            left: rand(-2, 100),
            // A tight stagger reads as a burst that settles into a shower
            delay: rand(0, 0.85),
            fall: rand(1.8, 2.6),
            spin: rand(0.5, 1.3),
            drift: rand(-14, 14),
            // Slips tumble in 3D; a glyph spins flat so it never lands mirrored
            rx: glyph ? 0 : Math.round(rand(0, 1)),
            ry: glyph ? 0 : 1,
            width,
            height: glyph ? 22 : width * rand(1.4, 2.6),
            color: COLORS[Math.floor(rand(0, COLORS.length))]!,
            glyph,
            round: !glyph && Math.random() < 0.18,
        }
    })
}

export default function Kamifubuki({ active, onDone, pieces = 70 }: Props) {
    // Regenerated per burst; only ever runs after a tap, so no SSR mismatch
    const slips = useMemo(() => (active ? makePieces(pieces) : []), [active, pieces])

    useEffect(() => {
        if (!active) return
        const timer = setTimeout(onDone, LONGEST_MS)
        return () => clearTimeout(timer)
    }, [active, onDone])

    if (!active) return null

    return (
        <div className="kamifubuki" aria-hidden>
            {slips.map((p, i) => (
                <div
                    key={i}
                    className="kamifubuki-piece"
                    style={{
                        left: `${p.left}%`,
                        ['--delay' as string]: `${p.delay}s`,
                        ['--fall' as string]: `${p.fall}s`,
                        ['--spin' as string]: `${p.spin}s`,
                        ['--drift' as string]: `${p.drift}vw`,
                    }}
                >
                    <span
                        style={{
                            ['--rx' as string]: p.rx,
                            ['--ry' as string]: p.ry,
                            width: `${p.width}px`,
                            height: `${p.height}px`,
                            borderRadius: p.round ? '50%' : '1px',
                            background: p.glyph ? 'none' : p.color,
                            color: p.color,
                            fontFamily: 'var(--font-display), serif',
                            fontSize: '1.25rem',
                            lineHeight: 1,
                            textAlign: 'center',
                        }}
                    >
                        {p.glyph}
                    </span>
                </div>
            ))}
        </div>
    )
}
