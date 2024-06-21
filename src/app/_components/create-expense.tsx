'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

import { api } from '~/trpc/react'

export default function CreateExpense() {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState(0)
    const [expenseDate, setExpenseDate] = useState(new Date())
    const [category, setCategory] = useState('General')
    const [paidByUserId, setPaidByUserId] = useState(0)
    const [notes, setNotes] = useState('')

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
        const groupIdNumber: number = Number(groupId)
        createExpense.mutate({
            title,
            groupId: groupIdNumber,
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
                                className="mb-2 w-full rounded border p-2 text"
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
                                className="mb-2 w-full rounded border p-2 text"
                                type="number"
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
                                className="mb-2 w-full rounded border p-2 text"
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
                                className="rounde mb-2 w-full border p-2 text"
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
                            <input
                                className="mb-2 w-full rounded border p-2 text"
                                type="text"
                                value={paidByUserId}
                                onChange={(e) =>
                                    setPaidByUserId(Number(e.target.value))
                                }
                                placeholder="Paid by"
                            />
                        </div>
                        <div className="w-full">
                            <label
                                htmlFor="title"
                                className="block p-1 text-m font-medium text-black"
                            >
                                Notes
                            </label>
                            <textarea
                                className="w-full rounded border p-2"
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
