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

                    {/* Default payee */}
                    <div className="card-dark anim-fade-up d-1" style={{ marginBottom: '1rem' }}>
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
                    <div className="card-dark anim-fade-up d-2">
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
