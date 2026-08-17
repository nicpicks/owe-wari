'use client'

import { useMemo, useState } from 'react'
import { api } from '~/trpc/react'

interface Member {
    id: string
    name: string
}

interface Props {
    groupId: string
    members: Member[]
}

interface Draft {
    /** Undefined while creating a household that has not been saved yet. */
    householdId?: number
    name: string
    userIds: string[]
    /** True once the name has been typed, so it stops tracking the picks. */
    nameTouched: boolean
}

const joinNames = (names: string[]) => names.join(' & ')

/**
 * Couples, families and flats that settle the group's books as one wallet.
 * Membership is exclusive — picking someone here takes them out of whatever
 * household they were in before, which the server enforces too.
 */
export default function HouseholdsCard({ groupId, members }: Props) {
    const utils = api.useUtils()
    const { data: households } = api.group.getHouseholds.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    const [draft, setDraft] = useState<Draft | null>(null)

    const nameById = useMemo(
        () => new Map(members.map((m) => [m.id, m.name])),
        [members]
    )

    // Who is already spoken for, ignoring the household being edited
    const takenBy = useMemo(() => {
        const map = new Map<string, string>()
        for (const household of households ?? []) {
            if (household.id === draft?.householdId) continue
            for (const member of household.members) map.set(member.userId, household.name)
        }
        return map
    }, [households, draft?.householdId])

    const close = () => setDraft(null)

    const save = api.group.saveHousehold.useMutation({
        onSuccess: async () => {
            await utils.group.getHouseholds.invalidate({ groupId })
            close()
        },
        onError: (error) => {
            console.error('Error saving household', error)
            alert(error.message || 'Failed to save household')
        },
    })

    const remove = api.group.deleteHousehold.useMutation({
        onSuccess: async () => {
            await utils.group.getHouseholds.invalidate({ groupId })
        },
        onError: (error) => {
            console.error('Error removing household', error)
            alert('Failed to remove household')
        },
    })

    const toggleMember = (userId: string) => {
        setDraft((prev) => {
            if (!prev) return prev
            const userIds = prev.userIds.includes(userId)
                ? prev.userIds.filter((id) => id !== userId)
                : [...prev.userIds, userId]
            return {
                ...prev,
                userIds,
                // The name keeps tracking the picks until it is typed over
                name: prev.nameTouched
                    ? prev.name
                    : joinNames(userIds.map((id) => nameById.get(id) ?? '')),
            }
        })
    }

    const canSave = (draft?.userIds.length ?? 0) >= 2

    return (
        <div className="card-dark anim-fade-up d-2" style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                    家 Households
                </div>
                <div className="section-sub">
                    Couples, families and flats who share a wallet. On the balances tab they
                    settle as one, so a household hands over a single figure instead of two.
                </div>
            </div>

            {(households ?? []).length === 0 && !draft && (
                <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
                    No households yet — everyone settles for themselves.
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(households ?? []).map((household) => (
                    <div key={household.id} className="ledger-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: '0.9375rem' }}>
                                {household.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                                {household.members.map((m) => m.name).join(' · ')}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                                type="button"
                                className="btn-ghost"
                                style={{ padding: '0.3125rem 0.75rem', fontSize: '0.75rem' }}
                                onClick={() =>
                                    setDraft({
                                        householdId: household.id,
                                        name: household.name,
                                        userIds: household.members.map((m) => m.userId),
                                        nameTouched: true,
                                    })
                                }
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                className="btn-ghost"
                                style={{ padding: '0.3125rem 0.75rem', fontSize: '0.75rem' }}
                                disabled={remove.isPending}
                                onClick={() => {
                                    if (!confirm(`Break up ${household.name}?`)) return
                                    remove.mutate({ groupId, householdId: household.id })
                                }}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {draft ? (
                <div
                    style={{
                        marginTop: '1.25rem',
                        padding: '1rem',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                    }}
                >
                    <div className="field-group" style={{ marginBottom: '0.75rem' }}>
                        <label className="field-label" htmlFor="household-name">
                            Household name
                        </label>
                        <input
                            id="household-name"
                            className="field-input"
                            type="text"
                            placeholder="Wei Yong & Wei Qing"
                            value={draft.name}
                            onChange={(e) =>
                                setDraft({ ...draft, name: e.target.value, nameTouched: true })
                            }
                            // The settings page is one big form — Enter here
                            // should not submit the default-payer field
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.preventDefault()
                            }}
                        />
                    </div>

                    <div className="field-label" style={{ marginBottom: '0.25rem' }}>
                        Who is in it
                    </div>
                    {members.map((member) => {
                        const checked = draft.userIds.includes(member.id)
                        const otherHousehold = takenBy.get(member.id)
                        return (
                            <label key={member.id} className="check-row">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleMember(member.id)}
                                />
                                <span style={{ color: 'var(--body)', fontSize: '0.9375rem' }}>
                                    {member.name}
                                </span>
                                {otherHousehold && (
                                    <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                                        {checked ? `moves out of ${otherHousehold}` : `in ${otherHousehold}`}
                                    </span>
                                )}
                            </label>
                        )
                    })}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="button" className="btn-ghost" onClick={close}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-amber"
                            disabled={!canSave || save.isPending}
                            onClick={() =>
                                save.mutate({
                                    groupId,
                                    householdId: draft.householdId,
                                    name: draft.name.trim(),
                                    userIds: draft.userIds,
                                })
                            }
                        >
                            {save.isPending ? 'Saving…' : '記 Save household'}
                        </button>
                    </div>
                    {!canSave && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                            Pick at least two people.
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ marginTop: '1.25rem' }}>
                    <button
                        type="button"
                        className="btn-ghost"
                        disabled={members.length < 2}
                        onClick={() =>
                            setDraft({ name: '', userIds: [], nameTouched: false })
                        }
                    >
                        + New household
                    </button>
                </div>
            )}
        </div>
    )
}
