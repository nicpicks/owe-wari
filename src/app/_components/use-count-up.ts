'use client'

import { useEffect, useRef, useState } from 'react'

// Eased 0→1 progress that restarts whenever `key` changes (e.g. when data
// arrives). Multiply amounts by this to get the design's count-up effect.
export function useCountUp(key: unknown, duration = 950) {
    const [progress, setProgress] = useState(0)
    const rafRef = useRef(0)

    useEffect(() => {
        cancelAnimationFrame(rafRef.current)
        const start = performance.now()
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration)
            setProgress(1 - Math.pow(1 - p, 3))
            if (p < 1) rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, duration])

    return progress
}
