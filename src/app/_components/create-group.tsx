'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { api } from '~/trpc/react'

export default function CreateGroup() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [currency, setCurrency] = useState('SGD')
    const [members, setMembers] = useState([''])

    const createGroup = api.group.create.useMutation({
        onSuccess: (data) => {
            const groupId = data.id
            router.push(`/groups/${groupId}/summary`)
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        createGroup.mutate({
            name,
            currency,
            description,
            userNames: members,
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
                <div className="mb-4 rounded-lg bg-gray-200 p-4">
                    <h2 className="mb-4 font-bold text-primary text-xl">
                        Group Information
                    </h2>
                    <div className="mb-4 flex space-x-4">
                        <div className="w-full">
                            <label
                                htmlFor="Group Name"
                                className="block p-1 text-m font-medium text-gray-600"
                            >
                                Group Name
                            </label>
                            <input
                                className="mb-2 w-full rounded border p-2 text input input-bordered"
                                type="text"
                                placeholder="Group Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="w-full">
                            <label
                                htmlFor="Currency"
                                className="block p-1 text-m font-medium text-gray-600"
                            >
                                Currency
                            </label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="rounde mb-2 w-full border p-2 text select select-bordered"
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
                    </div>
                    <div className="w-full">
                        <label
                            htmlFor="Description"
                            className="block p-1 text-m font-medium text-gray-600"
                        >
                            Description
                        </label>
                        <textarea
                            className="w-full rounded border p-2 input input-bordered"
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                <div className="mb-4 rounded-lg bg-gray-200 p-4">
                    <h2 className="mb-4 font-bold text-primary text-xl">
                        Members
                    </h2>
                    <div className="w-full">
                        <label
                            htmlFor="Group Members"
                            className="block p-1 text-m font-medium text-gray-600"
                        >
                            Who will be in this group?
                        </label>
                        {members.map((member, index) => (
                            <div key={index} className="mb-2 flex items-center">
                                <input
                                    className="flex-grow rounded border p-2 input input-bordered"
                                    type="text"
                                    placeholder={`Participant ${index + 1}`}
                                    value={member}
                                    onChange={(e) => {
                                        const newMembers = [...members]
                                        newMembers[index] = e.target.value
                                        setMembers(newMembers)
                                    }}
                                />
                                <button
                                    className="ml-2 rounded bg-primary border p-2"
                                    onClick={() => removeMember(index)}
                                >
                                    <img
                                        style={{
                                            width: '22px',
                                            height: '22px',
                                        }}
                                        src="/icons/delete.png"
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        className="mt-2 rounded bg-primary border p-2 text-white hover:bg-accent"
                        onClick={addMember}
                    >
                        Add Member
                    </button>
                </div>

                <div className="mb-8 rounded-lg bg-gray-200 p-4">
                    <h2 className="mb-4 font-bold text-primary text-xl">
                        Payment Settings
                    </h2>
                    <div className="w-full">
                        <label
                            htmlFor="Default Payee"
                            className="block p-1 text-m font-medium text-gray-600"
                        >
                            Nominated Cash Cow
                        </label>
                        <select className="w-full rounded border p-2 select select-bordered">
                            {members.map((_, index) => (
                                <option key={index} value={index}>
                                    Participant {index + 1}
                                </option>
                            ))}
                        </select>
                    </div>
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
