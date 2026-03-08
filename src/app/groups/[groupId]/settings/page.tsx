'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'

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

    useEffect(() => {
        if (defaultPayeeData) setDefaultPayee(defaultPayeeData)
        if (usersData) setUsers(usersData)
    }, [defaultPayeeData, usersData])

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

                    {/* Default payee */}
                    <div className="card-dark anim-fade-up d-2" style={{ marginBottom: '1rem' }}>
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

                    {/* Invite link */}
                    <div className="card-dark anim-fade-up d-3">
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
