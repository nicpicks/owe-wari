'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Tabs from '~/app/_components/tabs'
import { api } from '~/trpc/react'

interface Expense {
    id: number
    title: string
    amount: string
    category: string | null
    notes: string | null
    expenseDate: Date
}

const ExpensesTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [totalExpenses, setTotalExpenses] = useState<number>(0)
    const [expenses, setExpenses] = useState<Expense[]>([])

    const {
        data: expensesData,
        error: expensesError,
        isLoading: expensesIsLoading,
    } = api.expense.getExpenses.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    useEffect(() => {
        if (expensesData) {
            setExpenses(expensesData)
            setTotalExpenses(expensesData.length)
        }
        if (expensesError) {
            console.error('Error fetching expenses', expensesError)
        }
    }, [expensesData, expensesError])

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    return (
        <div className="flex flex-col max-w-screen-md w-full mx-auto">
            <div className="flex py-6">
                <Tabs pathname={pathname} navigateToTab={navigateToTab} />
            </div>
            <div className="flex justify-center">
                <div className="card w-full bg-gray-200 text-primary-content">
                    <div className="card-body">
                        <div className="flex flex-1">
                            <div className="flex flex-col flex-1">
                                <h2 className="card-title text-primary text-2xl">
                                    Group Expenses
                                </h2>
                                <p className="mt-2 mb-6 text-gray-500 text-s">
                                    List of expenses for your group.
                                </p>
                            </div>
                            <div className="flex flex-row">
                                <Link
                                    href={`/groups/${groupId}/expenses/create`}
                                >
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '5px' }}
                                    >
                                        <img
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                            }}
                                            src="/icons/add.png"
                                            alt="Add"
                                        />
                                    </button>
                                </Link>
                            </div>
                        </div>

                        <div>
                            {expenses.length === 0 ? (
                                <>
                                    <div className="mb-4">
                                        <span>No expenses created yet. </span>
                                        <Link
                                            href={`/groups/${groupId}/expenses/create`}
                                        >
                                            <span className="text-primary">
                                                Create one?
                                            </span>
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-lg">
                                        Total Expenses:
                                    </div>
                                    <div className="text-primary mb-4">
                                        {' '}
                                        {totalExpenses}
                                    </div>
                                    {expenses.map((expense, index) => (
                                        <div
                                            key={index}
                                            className="card w-full bg-gray-300 text-black mb-2"
                                        >
                                            <div className="card-body">
                                                <div>
                                                    Title: {expense.title}
                                                </div>
                                                <div>
                                                    Amount: {expense.amount}
                                                </div>
                                                <div>
                                                    Category: {expense.category}
                                                </div>
                                                <div>
                                                    Expense Date:{' '}
                                                    {expense.expenseDate.toLocaleDateString()}
                                                </div>
                                                <div>
                                                    Notes: {expense.notes ?? ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ExpensesTab
