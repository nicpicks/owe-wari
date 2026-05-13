'use client'

import { IdentifySelfModal } from '~/app/_components/identify-self-modal'

export default function GroupLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: { groupId: string }
}) {
    const { groupId } = params
    return (
        <>
            {children}
            {groupId && <IdentifySelfModal groupId={groupId} />}
        </>
    )
}
