'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '~/trpc/react'

export default function CreateGroup() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [currency, setCurrency] = useState('SGD')
    const [members, setMembers] = useState(['', ''])
    const [defaultPayee, setDefaultPayee] = useState('')
    const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const createGroup = api.group.create.useMutation({
        onSuccess: (data) => setCreatedGroupId(data.id ?? null),
    })

    const handleCopyLink = () => {
        if (!createdGroupId) return
        void navigator.clipboard.writeText(`${window.location.origin}/groups/${createdGroupId}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const validMembers = members.filter((m) => m.trim().length > 0)
        createGroup.mutate({ name, currency, description, userNames: validMembers, defaultPayee })
    }

    const addMember = () => setMembers([...members, ''])
    const removeMember = (i: number) => setMembers(members.filter((_, idx) => idx !== i))
    const updateMember = (i: number, val: string) =>
        setMembers(members.map((m, idx) => (idx === i ? val : m)))

    if (createdGroupId) {
        return (
            <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                    <div
                        className="card-dark anim-fade-up d-0"
                        style={{ textAlign: 'center', padding: '3rem 2rem' }}
                    >
                        <div
                            style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                background: 'var(--amber-dim)',
                                border: '1px solid rgba(242,160,7,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                fontSize: '1.5rem',
                            }}
                        >
                            ✓
                        </div>
                        <div
                            className="section-title"
                            style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-cormorant), serif', fontSize: '2rem', fontStyle: 'italic' }}
                        >
                            Group created!
                        </div>
                        <p className="section-sub" style={{ marginBottom: '2rem' }}>
                            Share this link with your group members so they can join.
                        </p>

                        <div className="copy-row" style={{ marginBottom: '1.5rem' }}>
                            <input
                                readOnly
                                value={`${window.location.origin}/groups/${createdGroupId}`}
                            />
                            <button type="button" className="btn-amber" onClick={handleCopyLink} style={{ flexShrink: 0 }}>
                                {copied ? '✓ Copied' : 'Copy link'}
                            </button>
                        </div>

                        <button
                            type="button"
                            className="btn-amber"
                            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                            onClick={() => router.push(`/groups/${createdGroupId}/summary`)}
                        >
                            Open group
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page-shell">
            {/* Minimal header */}
            <div
                style={{
                    borderBottom: '1px solid var(--border)',
                    padding: '1rem',
                }}
            >
                <div className="page-container">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--dim)',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <span
                            style={{
                                fontFamily: 'var(--font-cormorant), serif',
                                fontSize: '1.25rem',
                                fontStyle: 'italic',
                                color: 'var(--heading)',
                            }}
                        >
                            New group
                        </span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>

                    {/* Group info */}
                    <div className="card-dark anim-fade-up d-0" style={{ marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--heading)', marginBottom: '1.25rem', fontSize: '0.9375rem' }}>
                            Group info
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
                            <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="field-label">Group name</label>
                                <input
                                    className="field-input"
                                    type="text"
                                    placeholder="Tokyo trip 2024"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="field-group">
                                <label className="field-label">Currency</label>
                                <select
                                    className="field-select"
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                >
                                    {['SGD', 'USD', 'AUD', 'EUR', 'JPY', 'KRW', 'MYR', 'IDR', 'VND'].map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field-group">
                                <label className="field-label">Description</label>
                                <input
                                    className="field-input"
                                    type="text"
                                    placeholder="Optional"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Members */}
                    <div className="card-dark anim-fade-up d-1" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                Members
                            </div>
                            <button
                                type="button"
                                onClick={addMember}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--amber)',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                }}
                            >
                                + Add member
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {members.map((member, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: 'var(--surface-3)',
                                            border: '1px solid var(--border-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                            color: 'var(--dim)',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {i + 1}
                                    </div>
                                    <input
                                        className="field-input"
                                        type="text"
                                        placeholder={`Person ${i + 1}`}
                                        value={member}
                                        onChange={(e) => updateMember(i, e.target.value)}
                                    />
                                    {members.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeMember(i)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--muted)',
                                                cursor: 'pointer',
                                                padding: '0.25rem',
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                                <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Default payer */}
                    <div className="card-dark anim-fade-up d-2" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
                            Default Payer
                        </div>
                        <div className="section-sub" style={{ marginBottom: '1.25rem' }}>Who usually covers the bill</div>
                        <div className="field-group">
                            <label className="field-label">Nominated Cash Cow</label>
                            <select
                                className="field-select"
                                value={defaultPayee}
                                onChange={(e) => setDefaultPayee(e.target.value)}
                            >
                                {members.map((m, i) => (
                                    <option key={i} value={m}>
                                        {m || `Person ${i + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="anim-fade-up d-3" style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="submit"
                            className="btn-amber"
                            disabled={createGroup.isPending}
                            style={{ flex: 1, justifyContent: 'center', padding: '0.75rem' }}
                        >
                            {createGroup.isPending ? 'Creating…' : 'Create group'}
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => router.back()}>
                            Cancel
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
