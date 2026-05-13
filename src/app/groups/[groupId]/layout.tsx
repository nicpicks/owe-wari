'use client'

import { useEffect } from 'react'
import { api } from '~/trpc/react'
import { IdentifySelfModal } from '~/app/_components/identify-self-modal'
import { useRecentGroups } from '~/app/_components/use-recent-groups'

function RecordVisit({ groupId }: { groupId: string }) {
    const { recordVisit } = useRecentGroups()
    const { data: group } = api.group.getGroup.useQuery(
        { groupId },
        { enabled: !!groupId }
    )
    useEffect(() => {
        if (group?.id && group.name) recordVisit(group.id, group.name)
    }, [group?.id, group?.name, recordVisit])
    return null
}

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
            {groupId && <RecordVisit groupId={groupId} />}
        </>
    )
}
