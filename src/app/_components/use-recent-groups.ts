'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'owe-wari:recent-groups'
const MAX_RECENT = 12

export interface RecentGroup {
    id: string
    name: string
    lastVisited: number
}

function read(): RecentGroup[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(
            (g): g is RecentGroup =>
                !!g && typeof g === 'object'
                && typeof (g as RecentGroup).id === 'string'
                && typeof (g as RecentGroup).name === 'string'
                && typeof (g as RecentGroup).lastVisited === 'number'
        )
    } catch {
        return []
    }
}

function write(groups: RecentGroup[]) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
    } catch {
        /* ignore quota / private mode */
    }
}

export function useRecentGroups() {
    const [groups, setGroups] = useState<RecentGroup[]>([])
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        setGroups(read())
        setIsLoaded(true)
    }, [])

    const recordVisit = useCallback((id: string, name: string) => {
        const now = Date.now()
        setGroups((prev) => {
            const next = [
                { id, name, lastVisited: now },
                ...prev.filter((g) => g.id !== id),
            ].slice(0, MAX_RECENT)
            write(next)
            return next
        })
    }, [])

    const removeGroup = useCallback((id: string) => {
        setGroups((prev) => {
            const next = prev.filter((g) => g.id !== id)
            write(next)
            return next
        })
    }, [])

    return { groups, isLoaded, recordVisit, removeGroup }
}
