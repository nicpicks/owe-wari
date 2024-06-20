import { useEffect, useState } from 'react'

const GroupSummaryPage = () => {
    const [totalExpenses, setTotalExpenses] = useState<number>(0)
    const [currentShare, setCurrentShare] = useState<number>(0)
    const [remainingOwed, setRemainingOwed] = useState<number>(0)

    useEffect(() => {
        // Fetch the total expenses, current share, and remaining owe from the API
        // to-do: Replace the API endpoint with actual API endpoint
        fetch('/api/group-summary')
            .then((response) => response.json())
            .then((data) => {
                setTotalExpenses(data.totalExpenses)
                setCurrentShare(data.currentShare)
                setRemainingOwed(data.remainingOwe)
            })
            .catch((error) => {
                console.error('Error fetching group summary:', error)
            })
    }, [])

    return (
        <div className="card w-96 bg-primary text-primary-content">
            <div className="card-body">
                <h2 className="card-title">Group Summary</h2>
                <p className="mb-4">Spending summary of the entire group.</p>
                <div className="mb-4">
                    <div className="text-muted-foreground">Total Expenses:</div>
                    <div className="font-bold"> {totalExpenses}</div>
                </div>
                <div className="mb-4">
                    <div className="text-muted-foreground">
                        Your Current Share:
                    </div>
                    <div className="font-bold"> {currentShare}</div>
                </div>
                <div className="mb-4">
                    <div className="text-muted-foreground">Remaining Owed:</div>
                    <div className="font-bold"> {remainingOwed}</div>
                </div>
            </div>
        </div>
    )
}

export default GroupSummaryPage
