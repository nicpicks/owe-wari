import { toDefaultCurrency, type GroupRate } from './fx-rates'

export interface Balance {
    userId: string
    name: string
    currency: string
    netBalance: number
}

/** A couple, family or flat that settles the group's books as one wallet. */
export interface Household {
    id: number
    name: string
    members: { userId: string; name: string }[]
}

/** The household behind one side of a transfer, when households are on. */
export interface TransferParty {
    name: string
    memberNames: string[]
}

export interface Transfer {
    from: string
    fromName: string
    to: string
    toName: string
    currency: string
    amount: number
    /** Set only when this side is a household paying through `from`. */
    fromHousehold?: TransferParty
    /** Set only when this side is a household collecting through `to`. */
    toHousehold?: TransferParty
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Fold every currency into `settleCurrency` at the group's agreed rates and
 * net each person down to a single number.
 *
 * Simplifying currency by currency is what leaves a pair owing each other in
 * opposite directions — one Rp debt one way, an S$ debt the other. Once the
 * group has agreed a rate, those are the same money, so they subtract.
 */
export function netBalances(
    balances: Balance[],
    settleCurrency: string,
    rates: GroupRate[] | undefined
): Balance[] {
    const byUser = new Map<string, Balance>()

    for (const b of balances) {
        const converted = toDefaultCurrency(b.netBalance, b.currency, settleCurrency, rates)
        const row = byUser.get(b.userId)
        if (row) {
            row.netBalance += converted
        } else {
            byUser.set(b.userId, {
                userId: b.userId,
                name: b.name,
                currency: settleCurrency,
                netBalance: converted,
            })
        }
    }

    const out: Balance[] = []
    for (const row of byUser.values()) {
        const netBalance = round2(row.netBalance)
        if (Math.abs(netBalance) < 0.005) continue
        out.push({ ...row, netBalance })
    }
    return out
}

/** One side of the ledger: a person, or a household standing in for several. */
interface Party {
    id: string
    netBalance: number
    /** Who actually hands over or pockets the cash for this party. */
    payer: { userId: string; name: string }
    household?: TransferParty
}

/**
 * Greedy min-cash-flow algorithm: reduces N debts to at most N-1 transfers.
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
    const parties: Party[] = balances.map((b) => ({
        id: b.userId,
        netBalance: b.netBalance,
        payer: { userId: b.userId, name: b.name },
    }))
    return settleParties(parties, balances[0]?.currency ?? '')
}

/**
 * The same min-cash-flow pass, run over households instead of people: members
 * of a household net out against each other first, so a couple hands over (or
 * collects) one figure and squares up between themselves at home.
 *
 * Each household pays through the member deepest in debt and collects through
 * the member owed most — the person already carrying the balance.
 */
export function simplifyHouseholdDebts(
    balances: Balance[],
    households: Household[]
): Transfer[] {
    const byUser = new Map(balances.map((b) => [b.userId, b]))
    const householdOf = new Map<string, Household>()
    for (const h of households) {
        for (const m of h.members) householdOf.set(m.userId, h)
    }

    const parties: Party[] = []
    const done = new Set<number>()

    for (const b of balances) {
        const household = householdOf.get(b.userId)
        if (!household) {
            parties.push({
                id: b.userId,
                netBalance: b.netBalance,
                payer: { userId: b.userId, name: b.name },
            })
            continue
        }
        if (done.has(household.id)) continue
        done.add(household.id)

        const netBalance = household.members.reduce(
            (sum, m) => sum + (byUser.get(m.userId)?.netBalance ?? 0),
            0
        )
        const payer = pickRepresentative(household, byUser, netBalance)
        if (!payer) continue

        parties.push({
            id: `household:${household.id}`,
            netBalance,
            payer,
            household: {
                name: household.name,
                memberNames: household.members.map((m) => m.name),
            },
        })
    }

    return settleParties(parties, balances[0]?.currency ?? '')
}

/**
 * The member who settles for the household: the one furthest into debt when
 * the household owes, the one owed most when it collects. Members who are
 * already square never get handed the errand.
 */
function pickRepresentative(
    household: Household,
    byUser: Map<string, Balance>,
    netBalance: number
): { userId: string; name: string } | null {
    const owing = netBalance < 0
    let best: Balance | null = null
    for (const m of household.members) {
        const balance = byUser.get(m.userId)
        if (!balance) continue
        if (!best) {
            best = balance
            continue
        }
        best = owing
            ? balance.netBalance < best.netBalance
                ? balance
                : best
            : balance.netBalance > best.netBalance
                ? balance
                : best
    }
    if (!best) return null
    return { userId: best.userId, name: best.name }
}

function settleParties(parties: Party[], currency: string): Transfer[] {
    const creditors: Array<Party & { amount: number }> = []
    const debtors: Array<Party & { amount: number }> = []

    for (const party of parties) {
        const rounded = round2(party.netBalance)
        if (rounded > 0) {
            creditors.push({ ...party, amount: rounded })
        } else if (rounded < 0) {
            debtors.push({ ...party, amount: -rounded })
        }
    }

    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    // Normalize: if split-rounding caused sum(debtors) != sum(creditors),
    // absorb the difference into the largest creditor so every debtor pays
    // exactly their displayed balance.
    const sumCreditors = round2(creditors.reduce((s, c) => s + c.amount, 0))
    const sumDebtors = round2(debtors.reduce((s, d) => s + d.amount, 0))
    const imbalance = round2(sumDebtors - sumCreditors)
    if (imbalance !== 0 && creditors[0]) {
        creditors[0].amount = round2(creditors[0].amount + imbalance)
    }

    const transfers: Transfer[] = []

    let ci = 0
    let di = 0
    while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci]!
        const debtor = debtors[di]!
        if (creditor.amount <= 0) {
            ci++
            continue
        }
        if (debtor.amount <= 0) {
            di++
            continue
        }
        const amount = round2(Math.min(creditor.amount, debtor.amount))

        transfers.push({
            from: debtor.payer.userId,
            fromName: debtor.payer.name,
            to: creditor.payer.userId,
            toName: creditor.payer.name,
            currency,
            amount,
            ...(debtor.household ? { fromHousehold: debtor.household } : {}),
            ...(creditor.household ? { toHousehold: creditor.household } : {}),
        })

        creditor.amount = round2(creditor.amount - amount)
        debtor.amount = round2(debtor.amount - amount)
    }

    return transfers
}
