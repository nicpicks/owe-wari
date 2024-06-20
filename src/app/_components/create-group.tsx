'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '~/trpc/react'

export default function CreateGroup() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [currency, setCurrency] = useState('SGD')
    const [members, setMembers] = useState(['Alice', 'Bob', 'Carlsten'])

    const createGroup = api.group.create.useMutation({
        onSuccess: () => {
            router.refresh()
            setName('')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        createGroup.mutate({
            name,
            currency,
            description,
        })
    }

    const addMember = () => {
        setMembers([...members, ''])
    }

    const removeMember = (index: number) => {
        setMembers(members.filter((_, i) => i !== index))
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="mx-auto flex w-full max-w-screen-md flex-1 flex-col bg-white p-6">
                <div className="mb-8 rounded-lg bg-primary p-4">
                    <h2 className="mb-2 text-xl">Group Information</h2>
                    <div className="mb-4 flex space-x-4">
                        <input
                            className="mb-2 w-full rounded border p-2 text"
                            type="text"
                            placeholder="Group Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="rounde mb-2 w-full border p-2 text"
                        >
                            <option value="" disabled selected>
                                Currency
                            </option>
                            <option value="SGD">SGD</option>
                            <option value="AUD">AUD</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="JPY">JPY</option>
                            <option value="KRW">KRW</option>
                            <option value="MYR">MYR</option>
                            <option value="IDR">IDR</option>
                            <option value="VND">VND</option>
                        </select>
                    </div>
                    <textarea
                        className="w-full rounded border p-2"
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    ></textarea>
                </div>

                <div className="mb-8 rounded-lg bg-primary p-4">
                    <h2 className="mb-2 text-xl">Members</h2>
                    {members.map((_, index) => (
                        <div key={index} className="mb-2 flex items-center">
                            <input
                                className="flex-grow rounded border p-2"
                                type="text"
                                placeholder={`Participant ${index + 1}`}
                            />
                            <button
                                className="ml-2 rounded border p-2"
                                onClick={() => removeMember(index)}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button
                        className="rounded border p-2 text-white hover:bg-accent"
                        onClick={addMember}
                    >
                        Add Member
                    </button>
                </div>

                <div className="mb-8 rounded-lg bg-primary p-4">
                    <h2 className="mb-2 text-xl">Payment Settings</h2>
                    <select className="w-full rounded border p-2">
                        {members.map((_, index) => (
                            <option key={index} value={index}>
                                Participant {index + 1}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    className="rounded bg-primary px-4 py-2 font-bold text-white hover:bg-accent"
                    disabled={createGroup.isPending}
                >
                    {createGroup.isPending ? 'Creating...' : 'Create Group'}
                </button>
            </div>
        </form>
    )
}
