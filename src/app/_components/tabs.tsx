const Tabs = ({
    pathname,
    navigateToTab,
}: {
    pathname: string
    navigateToTab: (tab: string) => void
}) => {
    const tabs = ['summary', 'expenses', 'balances', 'history', 'settings']

    return (
        <div role="tablist" className="tabs tabs-boxed">
            {tabs.map((tab) => (
                <a
                    key={tab}
                    role="tab"
                    className={`tab ${pathname.includes(tab) ? 'tab-active' : ''}`}
                    onClick={() => navigateToTab(tab)}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </a>
            ))}
        </div>
    )
}

export default Tabs
