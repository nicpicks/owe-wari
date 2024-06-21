const SettingsTab = () => {
    return (
        <div className="flex flex-col max-w-screen-md w-full mx-auto">
            <div className="flex justify-center py-6">
                <div className="card w-full bg-gray-200 text-primary-content">
                    <div className="card-body">
                        <h2 className="card-title text-primary text-2xl">
                            Settings
                        </h2>
                        <p className="mb-6 text-gray-500 text-s">
                            Personalise your group settings.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsTab
