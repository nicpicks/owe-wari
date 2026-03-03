export interface Balance {
    userId: string
    name: string
    netBalance: number
}

export interface Transfer {
    from: string
    fromName: string
    to: string
    toName: string
    amount: number
}

/**
 * Greedy min-cash-flow algorithm: reduces N debts to at most N-1 transfers.
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
    const creditors: Array<{ userId: string; name: string; amount: number }> = []
    const debtors: Array<{ userId: string; name: string; amount: number }> = []

    for (const { userId, name, netBalance } of balances) {
        if (netBalance > 0.005) {
            creditors.push({ userId, name, amount: netBalance })
        } else if (netBalance < -0.005) {
            debtors.push({ userId, name, amount: -netBalance })
        }
    }

    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    const transfers: Transfer[] = []

    let ci = 0
    let di = 0
    while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci]!
        const debtor = debtors[di]!
        const amount = Math.min(creditor.amount, debtor.amount)

        transfers.push({
            from: debtor.userId,
            fromName: debtor.name,
            to: creditor.userId,
            toName: creditor.name,
            amount: Math.round(amount * 100) / 100,
        })

        creditor.amount -= amount
        debtor.amount -= amount

        if (creditor.amount < 0.005) ci++
        if (debtor.amount < 0.005) di++
    }

    return transfers
}
