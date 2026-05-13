'use client'

import { useEffect, useState, useCallback } from 'react'

const storageKey = (groupId: string) => `owe-wari:identity:${groupId}`

export function useGroupIdentity(groupId: string | undefined) {
    const [identity, setIdentityState] = useState<string | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        if (!groupId) return
        try {
            const stored = window.localStorage.getItem(storageKey(groupId))
            setIdentityState(stored)
        } catch {
            setIdentityState(null)
        }
        setIsLoaded(true)
    }, [groupId])

    const setIdentity = useCallback((userId: string) => {
        if (!groupId) return
        try {
            window.localStorage.setItem(storageKey(groupId), userId)
        } catch {
            /* ignore quota / private mode errors */
        }
        setIdentityState(userId)
    }, [groupId])

    const clearIdentity = useCallback(() => {
        if (!groupId) return
        try {
            window.localStorage.removeItem(storageKey(groupId))
        } catch {
            /* ignore */
        }
        setIdentityState(null)
    }, [groupId])

    return { identity, setIdentity, clearIdentity, isLoaded }
}
