'use client'

import { use } from 'react'
import { IdentifySelfModal } from '~/app/_components/identify-self-modal'

export default function GroupLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ groupId: string }>
}) {
    const { groupId } = use(params)
    return (
        <>
            {children}
            {groupId && <IdentifySelfModal groupId={groupId} />}
        </>
    )
}
