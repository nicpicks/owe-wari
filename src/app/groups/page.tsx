import Link from 'next/link'
import { Metadata } from 'next'
import { RecentGroupsList } from './recent-groups-list'

export const metadata: Metadata = {
    title: 'Recently managed groups',
}

export default async function Groups() {
    return (
        <>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <h1 className="flex-1 text-3xl font-bold">Recent Groups</h1>
                <div className="flex gap-2">
                    <Link href="/groups/create">
                        <button className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded mr-2">
                            Create
                        </button>
                    </Link>
                </div>
            </div>
            <div>{/* <RecentGroupsList /> */}</div>
        </>
    )
}
