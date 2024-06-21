'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const ExpensesTab = () => {
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()
    const [totalExpenses, setTotalExpenses] = useState<number>(0)
    const [expenses, setExpenses] = useState<number[]>([])

    return (
        <div className="flex flex-col max-w-screen-md w-full mx-auto">
            <div className="flex justify-center py-6">
                <div className="card w-full bg-gray-200 text-primary-content">
                    <div className="card-body">
                        <div className="flex flex-1">
                            <div className="flex flex-col flex-1">
                                <h2 className="card-title text-primary text-2xl">
                                    Group Expenses
                                </h2>
                                <p className="mb-6 text-gray-500 text-s">
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

                        <div className="mb-4">
                            {expenses.length === 0 ? (
                                <>
                                    <div>
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
                                    <div className="text-muted-foreground">
                                        Total Expenses:
                                    </div>
                                    <div className="font-bold">
                                        {' '}
                                        {totalExpenses}
                                    </div>
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
