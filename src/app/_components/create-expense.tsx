'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { api } from '~/trpc/react'

interface User {
    id: string
    name: string
}

export default function CreateExpense() {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()

    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState(0)
    const [expenseDate, setExpenseDate] = useState(new Date())
    const [category, setCategory] = useState('General')
    const [paidByUserId, setPaidByUserId] = useState('')
    const [notes, setNotes] = useState('')
    const [users, setUsers] = useState<User[]>([])
    const [isChecked, setIsChecked] = useState<Record<string, boolean>>({})

    // to-do: fetch default payee from group settings
    const defaultPayee = users[0]

    const {
        data: usersData,
        error: usersError,
        isLoading: usersLoading,
    } = api.group.getUsers.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    useEffect(() => {
        if (usersData) {
            setUsers(usersData)
            const initialCheckedStatus: Record<string, boolean> = {}
            users.forEach((user) => {
                initialCheckedStatus[user.id] = true
            })
            setIsChecked(initialCheckedStatus)
        }
        if (usersError) {
            console.error('Error fetching users:', usersError)
        }
    }, [usersData, usersError])

    const createExpense = api.expense.create.useMutation({
        onSuccess: (data) => {
            const groupId = data.id
            router.push(`/groups/${groupId}/expenses`)
        },
        onError: (error) => {
            console.error('Error creating expense:', error)
            alert('Failed to create expense')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()

        createExpense.mutate({
            title,
            groupId: groupId ?? '',
            paidByUserId,
            amount,
            category,
            notes,
            expenseDate,
        })
    }

    const handleCancel = () => {
        router.back()
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="mx-auto flex w-full max-w-screen-md flex-1 flex-col bg-white p-6">
                <div className="mb-4 rounded-lg bg-gray-200 p-4">
                    <h2 className="mb-4 font-bold text-primary text-2xl">
                        Create Expense
                    </h2>
                    <div className="mb-4 flex space-x-4">
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Expense title
                            </label>
                            <input
                                className="mb-2 w-full rounded border p-2 text input input-bordered text-lg"
                                type="text"
                                placeholder="Grab ride from airport"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Amount
                            </label>
                            <input
                                className="mb-2 w-full rounded border p-2 text input input-bordered"
                                type="text"
                                placeholder="Amount"
                                value={amount}
                                onChange={(e) =>
                                    setAmount(Number(e.target.value))
                                }
                            />
                        </div>
                    </div>
                    <div className="mb-4 flex space-x-4">
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Expense date
                            </label>
                            <input
                                className="mb-2 w-full rounded border p-2 text input input-bordered"
                                type="date"
                                value={expenseDate.toISOString().split('T')[0]}
                                onChange={(e) =>
                                    setExpenseDate(new Date(e.target.value))
                                }
                            />
                        </div>
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Category
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="mb-2 w-full rounded border p-2 text select select-black text-lg"
                            >
                                <option value="General" disabled selected>
                                    General
                                </option>
                                <option value="Food">Food</option>
                                <option value="Transport">Transport</option>
                                <option value="Accomodation">
                                    Accomodation
                                </option>
                                <option value="Groceries">Groceries</option>
                                <option value="Others">Others</option>
                            </select>
                        </div>
                    </div>
                    <div className="mb-4 flex space-x-4">
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Paid by
                            </label>
                            <select
                                className="mb-2 w-full rounded border p-2 text select select-black text-lg"
                                value={paidByUserId}
                                onChange={(e) =>
                                    setPaidByUserId(e.target.value)
                                }
                            >
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Notes
                            </label>
                            <textarea
                                className="w-full rounded border p-2 textarea textarea-bordered text-lg"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div className="mb-4 rounded-lg bg-gray-200 p-4">
                    <h2 className="mb-4 font-bold text-primary text-2xl">
                        Paid for
                    </h2>
                    {usersLoading && <p>Loading group members...</p>}
                    {users.map((user, index) => (
                        <div
                            key={user.id}
                            className={`flex items-center py-3 ${index !== users.length - 1 ? 'border-b border-gray-300' : ''}`}
                        >
                            <input
                                type="checkbox"
                                id={user.id}
                                name={user.name}
                                value={user.id}
                                className="mr-3 checkbox checkbox-primary"
                                checked={isChecked[user.id]}
                                onChange={() =>
                                    setIsChecked({
                                        ...isChecked,
                                        [user.id]: !isChecked[user.id],
                                    })
                                }
                            />
                            <label htmlFor={user.id}>{user.name}</label>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={createExpense.isPending}
                    >
                        {createExpense.isPending ? 'Creating...' : 'Create'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-gray"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </form>
    )
}
