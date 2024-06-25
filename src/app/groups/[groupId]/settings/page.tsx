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

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    const { data: defaultPayeeData } = api.group.getDefaultPayee.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    const {
        data: usersData,
        error: usersError,
        isLoading: usersLoading,
    } = api.group.getUsers.useQuery(
        { groupId: groupId ?? '' },
        { enabled: !!groupId }
    )

    useEffect(() => {
        if (defaultPayeeData) {
            setDefaultPayee(defaultPayeeData)
        }
        if (usersData) {
            setUsers(usersData)
        }
    }, [defaultPayeeData, usersData])

    const updateDefaultPayee = api.group.updateDefaultPayee.useMutation({
        onSuccess: (data) => {
            alert('Default payee has been updated successfully')
        },
        onError: (error) => {
            console.error('Error updating default payee', error)
            alert('Failed to update default payee')
        },
    })

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()

        if (groupId) {
            updateDefaultPayee.mutate({ groupId, defaultPayee })
        } else {
            alert('Group ID is missing')
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col max-w-screen-md w-full mx-auto">
                <div className="flex py-6">
                    <Tabs pathname={pathname} navigateToTab={navigateToTab} />
                </div>
                <div className="flex justify-center">
                    <div className="card w-full bg-gray-200 text-primary-content">
                        <div className="card-body">
                            <h2 className="card-title text-primary text-2xl">
                                Settings
                            </h2>
                            <p className="mb-6 text-gray-500 text-s">
                                Personalise your group settings.
                            </p>
                            <div className="w-full">
                                <label
                                    htmlFor="title"
                                    className="block p-1 text-m font-medium text-black"
                                >
                                    Nominated Cash Cow
                                </label>
                                <select
                                    className="mb-2 w-full rounded border p-2 text select select-bordered text-lg"
                                    value={defaultPayee}
                                    onChange={(e) =>
                                        setDefaultPayee(e.target.value)
                                    }
                                >
                                    {users.map((user) => (
                                        <option
                                            key={user.id}
                                            value={user.id}
                                            selected={user.id === defaultPayee}
                                        >
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex mt-4 gap-2">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={updateDefaultPayee.isPending}
                    >
                        {updateDefaultPayee.isPending
                            ? 'Updating...'
                            : 'Update'}
                    </button>
                </div>
            </div>
        </form>
    )
}

export default SettingsTab
