const BalancesTab = () => {
    return (
        <>
            <div className="flex flex-col max-w-screen-md w-full mx-auto">
                <div className="flex justify-center py-6">
                    <div className="card w-full bg-gray-200 text-primary-content">
                        <div className="card-body">
                            <h2 className="card-title text-primary text-2xl">
                                Balances
                            </h2>
                            <p className="mb-6 text-gray-500 text-s">
                                Track how much you owe and are owed.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center">
                    <div className="card w-full bg-gray-200 text-primary-content">
                        <div className="card-body">
                            <h2 className="card-title text-primary text-2xl">
                                Settle up
                            </h2>
                            <p className="mb-6 text-gray-500 text-s">
                                You can use these suggestions to settle up with
                                your friends.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default BalancesTab
