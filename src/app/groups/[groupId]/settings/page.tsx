'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'
import { useGroupIdentity } from '~/app/_components/use-group-identity'
import { SUPPORTED_CURRENCIES } from '~/lib/currencies'

interface User {
    id: string
    name: string
}

const SettingsTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [defaultPayee, setDefaultPayee] = useState('')
    const [users, setUsers] = useState<User[]>([])
    const [copied, setCopied] = useState(false)
    const [newMemberName, setNewMemberName] = useState('')
    const [tripUrl, setTripUrl] = useState('')
    const [currencies, setCurrencies] = useState<string[]>([])
    const { identity, setIdentity, clearIdentity } = useGroupIdentity(groupId)
    const identityName = users.find((u) => u.id === identity)?.name

    const handleCopyLink = () => {
        if (!groupId) return
        void navigator.clipboard.writeText(`${window.location.origin}/groups/${groupId}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: defaultPayeeData } = api.group.getDefaultPayee.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const { data: usersData } = api.group.getUsers.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const { data: groupData } = api.group.getGroup.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const { data: groupCurrenciesData } = api.group.getCurrencies.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )
    const defaultCurrency = groupCurrenciesData?.find((c) => c.isDefault)?.code

    useEffect(() => {
        if (defaultPayeeData) setDefaultPayee(defaultPayeeData)
        if (usersData) setUsers(usersData)
    }, [defaultPayeeData, usersData])

    useEffect(() => {
        if (groupCurrenciesData) setCurrencies(groupCurrenciesData.map((c) => c.code))
    }, [groupCurrenciesData])

    useEffect(() => {
        setTripUrl(groupData?.tripUrl ?? '')
    }, [groupData?.tripUrl])

    const utils = api.useUtils()

    const addMember = api.group.addMember.useMutation({
        onSuccess: async () => {
            setNewMemberName('')
            await utils.group.getUsers.invalidate({ groupId: groupId ?? '' })
        },
        onError: (error) => {
            console.error('Error adding member', error)
            alert('Failed to add member')
        },
    })

    const handleAddMember = () => {
        const name = newMemberName.trim()
        if (!name || !groupId) return
        addMember.mutate({ groupId, name })
    }

    const updateDefaultPayee = api.group.updateDefaultPayee.useMutation({
        onSuccess: () => alert('Default payee updated'),
        onError: (error) => {
            console.error('Error updating default payee', error)
            alert('Failed to update default payee')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (groupId) updateDefaultPayee.mutate({ groupId, defaultPayee })
    }

    const updateTripLink = api.group.updateTripLink.useMutation({
        onSuccess: async () => {
            await utils.group.getGroup.invalidate({ groupId: groupId ?? '' })
        },
        onError: (error) => {
            console.error('Error updating trip link', error)
            alert('Failed to save trip link — make sure it is a valid URL')
        },
    })

    const handleSaveTripLink = () => {
        if (!groupId) return
        updateTripLink.mutate({ groupId, tripUrl: tripUrl.trim() })
    }

    const updateCurrencies = api.group.updateCurrencies.useMutation({
        onSuccess: async () => {
            await utils.group.getCurrencies.invalidate({ groupId: groupId ?? '' })
            alert('Currencies updated')
        },
        onError: (error) => {
            console.error('Error updating currencies', error)
            alert('Failed to update currencies')
        },
    })

    const handleSaveCurrencies = () => {
        if (!groupId || currencies.length === 0) return
        updateCurrencies.mutate({ groupId, currencies })
    }

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <form onSubmit={handleSubmit}>
                <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                    <div className="section-title anim-fade-up d-0" style={{ marginBottom: '1.5rem' }}>Settings</div>

                    {/* Members */}
                    <div className="card-dark anim-fade-up d-1" style={{ marginBottom: '1rem' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                Members
                            </div>
                            <div className="section-sub">People in this group</div>
                        </div>

                        <ul style={{ margin: '0 0 1.25rem', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {users.map((user) => (
                                <li key={user.id} style={{ color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                    {user.name}
                                </li>
                            ))}
                        </ul>

                        <div className="copy-row">
                            <input
                                type="text"
                                placeholder="New member name…"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember() } }}
                            />
                            <button
                                type="button"
                                className="btn-amber"
                                onClick={handleAddMember}
                                disabled={addMember.isPending}
                                style={{ flexShrink: 0 }}
                            >
                                {addMember.isPending ? 'Adding…' : 'Add'}
                            </button>
                        </div>
                    </div>

                    {/* You on this device */}
                    <div className="card-dark anim-fade-up d-2" style={{ marginBottom: '1rem' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                You on this device
                            </div>
                            <div className="section-sub">
                                {identity && identityName
                                    ? `New expenses you add here will be logged under ${identityName}.`
                                    : 'Pick yourself so new expenses are logged under your name on this device.'}
                            </div>
                        </div>

                        <div className="field-group">
                            <label className="field-label">I am</label>
                            <select
                                className="field-select"
                                value={identity ?? ''}
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (value) setIdentity(value)
                                    else clearIdentity()
                                }}
                            >
                                <option value="">Not set</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {identity && (
                            <div style={{ marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={clearIdentity}
                                >
                                    Forget me on this device
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Default payee */}
                    <div className="card-dark anim-fade-up d-3" style={{ marginBottom: '1rem' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                Default Payer
                            </div>
                            <div className="section-sub">Who typically pays upfront for the group</div>
                        </div>

                        <div className="field-group">
                            <label className="field-label">Nominated Cash Cow</label>
                            <select
                                className="field-select"
                                value={defaultPayee}
                                onChange={(e) => setDefaultPayee(e.target.value)}
                            >
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginTop: '1.25rem' }}>
                            <button
                                type="submit"
                                className="btn-amber"
                                disabled={updateDefaultPayee.isPending}
                            >
                                {updateDefaultPayee.isPending ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>

                    {/* Currencies */}
                    <div className="card-dark anim-fade-up d-4" style={{ marginBottom: '1rem' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                Currencies
                            </div>
                            <div className="section-sub">
                                Which currencies expenses can be logged in. Removing one keeps existing expenses intact.
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '0.5rem',
                            }}
                        >
                            {SUPPORTED_CURRENCIES.map((c) => {
                                const isDefault = c === defaultCurrency
                                const checked = currencies.includes(c)
                                return (
                                    <label
                                        key={c}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 0.625rem',
                                            border: `1px solid ${checked ? 'var(--amber)' : 'var(--border)'}`,
                                            borderRadius: '6px',
                                            background: checked ? 'var(--amber-dim)' : 'var(--surface-2)',
                                            cursor: isDefault ? 'not-allowed' : 'pointer',
                                            opacity: isDefault ? 0.85 : 1,
                                            fontSize: '0.8125rem',
                                            color: 'var(--body)',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={isDefault}
                                            onChange={(e) => {
                                                if (isDefault) return
                                                setCurrencies((prev) =>
                                                    e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)
                                                )
                                            }}
                                            style={{ accentColor: 'var(--amber)' }}
                                        />
                                        <span style={{ fontWeight: 600 }}>{c}</span>
                                        {isDefault && (
                                            <span style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}>(default)</span>
                                        )}
                                    </label>
                                )
                            })}
                        </div>

                        <div style={{ marginTop: '1.25rem' }}>
                            <button
                                type="button"
                                className="btn-amber"
                                onClick={handleSaveCurrencies}
                                disabled={updateCurrencies.isPending}
                            >
                                {updateCurrencies.isPending ? 'Saving…' : 'Save currencies'}
                            </button>
                        </div>
                    </div>

                    {/* Trip itinerary link */}
                    <div className="card-dark anim-fade-up d-5" style={{ marginBottom: '1rem' }}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                Trip Itinerary
                            </div>
                            <div className="section-sub">
                                Link a Jiogo trip so the group can jump straight to the itinerary
                            </div>
                        </div>

                        <div className="copy-row">
                            <input
                                type="url"
                                placeholder="https://jiogo.vercel.app/trips/…"
                                value={tripUrl}
                                onChange={(e) => setTripUrl(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTripLink() } }}
                            />
                            <button
                                type="button"
                                className="btn-amber"
                                onClick={handleSaveTripLink}
                                disabled={updateTripLink.isPending}
                                style={{ flexShrink: 0 }}
                            >
                                {updateTripLink.isPending ? 'Saving…' : 'Save'}
                            </button>
                        </div>

                        {groupData?.tripUrl && (
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <a
                                    href={groupData.tripUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--green)', fontSize: '0.875rem', textDecoration: 'underline' }}
                                >
                                    Open itinerary ↗
                                </a>
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={() => {
                                        if (groupId) updateTripLink.mutate({ groupId, tripUrl: '' })
                                    }}
                                >
                                    Unlink
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Invite link */}
                    <div className="card-dark anim-fade-up d-6">
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                                Invite Link
                            </div>
                            <div className="section-sub">Share this to let others access the group</div>
                        </div>

                        <div className="copy-row">
                            <input
                                readOnly
                                value={groupId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/groups/${groupId}` : ''}
                            />
                            <button
                                type="button"
                                className="btn-amber"
                                onClick={handleCopyLink}
                                style={{ flexShrink: 0 }}
                            >
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default SettingsTab
