'use client'

import { useRouter, usePathname } from 'next/navigation'
import Tabs from '~/app/_components/tabs'

const HistoryTab = () => {
    const router = useRouter()
    const pathname = usePathname()
    const groupId = pathname.split('/')[2]?.toString()

    const navigateToTab = (tab: string) => {
        router.push(`/groups/${groupId}/${tab}`)
    }

    return (
        <div className="page-shell">
            <Tabs pathname={pathname} navigateToTab={navigateToTab} />

            <div className="page-container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
                <div className="card-dark anim-fade-up d-0" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <div
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="8.5" stroke="var(--muted)" strokeWidth="1.25"/>
                            <path d="M10 6v4.5l2.5 2.5" stroke="var(--muted)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div className="section-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>History</div>
                    <p className="section-sub">
                        A full activity log is coming soon.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default HistoryTab
