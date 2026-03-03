const Tabs = ({
    pathname,
    navigateToTab,
}: {
    pathname: string
    navigateToTab: (tab: string) => void
}) => {
    const tabs = [
        { key: 'summary',  label: 'Summary' },
        { key: 'expenses', label: 'Expenses' },
        { key: 'balances', label: 'Balances' },
        { key: 'history',  label: 'History' },
        { key: 'settings', label: 'Settings' },
    ]

    return (
        <nav className="tab-bar" style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}>
            <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', width: '100%', padding: '0 1rem' }}>
                {tabs.map(({ key, label }) => (
                    <button
                        key={key}
                        className={`tab-item${pathname.includes(key) ? ' active' : ''}`}
                        onClick={() => navigateToTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </nav>
    )
}

export default Tabs
