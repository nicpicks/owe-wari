import { test, expect } from '@playwright/test'
import {
  netBalances,
  simplifyDebts,
  simplifyHouseholdDebts,
  type Balance,
  type Household,
  type Transfer,
} from '~/lib/simplify-debts'

const balance = (userId: string, name: string, currency: string, netBalance: number): Balance => ({
  userId,
  name,
  currency,
  netBalance,
})

// S$1 = Rp12,000 — the rate the group agreed on
const rates = [{ code: 'IDR', rate: 12_000 }]

test.describe('netBalances', () => {
  test('folds every currency into the settle currency, one row per person', () => {
    const netted = netBalances(
      [
        balance('a', 'Ana', 'SGD', 300),
        balance('a', 'Ana', 'IDR', -300_000),
        balance('b', 'Ben', 'SGD', -300),
        balance('b', 'Ben', 'IDR', 300_000),
      ],
      'SGD',
      rates
    )

    expect(netted).toEqual([
      { userId: 'a', name: 'Ana', currency: 'SGD', netBalance: 275 },
      { userId: 'b', name: 'Ben', currency: 'SGD', netBalance: -275 },
    ])
  })

  test('drops people whose currencies cancel out', () => {
    const netted = netBalances(
      [balance('a', 'Ana', 'SGD', -50), balance('a', 'Ana', 'IDR', 600_000)],
      'SGD',
      rates
    )
    expect(netted).toEqual([])
  })
})

test.describe('simplifyDebts', () => {
  test('a pair owing each other in two currencies settles with one transfer', () => {
    // Ana is up S$300 but down Rp300,000; per-currency simplification used to
    // bill this as Ben → Ana S$300 *and* Ana → Ben S$25 worth of rupiah.
    const netted = netBalances(
      [
        balance('a', 'Ana', 'SGD', 300),
        balance('a', 'Ana', 'IDR', -300_000),
        balance('b', 'Ben', 'SGD', -300),
        balance('b', 'Ben', 'IDR', 300_000),
      ],
      'SGD',
      rates
    )

    const transfers = simplifyDebts(netted)

    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      from: 'b',
      to: 'a',
      currency: 'SGD',
      amount: 275,
    })
  })

  test('every debtor pays exactly their balance', () => {
    const netted = netBalances(
      [
        balance('a', 'Ana', 'SGD', 275),
        balance('b', 'Ben', 'SGD', -25),
        balance('c', 'Cara', 'SGD', -95),
        balance('d', 'Dan', 'SGD', -155),
      ],
      'SGD',
      rates
    )
    const transfers = simplifyDebts(netted)

    expect(transfers).toHaveLength(3)
    for (const userId of ['b', 'c', 'd']) {
      const paid = transfers
        .filter((t) => t.from === userId)
        .reduce((sum, t) => sum + t.amount, 0)
      const owed = -netted.find((b) => b.userId === userId)!.netBalance
      expect(paid).toBeCloseTo(owed, 2)
    }
  })
})

test.describe('simplifyHouseholdDebts', () => {
  const netted = [
    balance('a', 'Ana', 'SGD', 275),
    balance('b', 'Ben', 'SGD', -25),
    balance('c', 'Cara', 'SGD', -95),
    balance('d', 'Dan', 'SGD', -155),
  ]
  const households: Household[] = [
    {
      id: 1,
      name: 'Ana & Ben',
      members: [
        { userId: 'a', name: 'Ana' },
        { userId: 'b', name: 'Ben' },
      ],
    },
    {
      id: 2,
      name: 'Cara & Dan',
      members: [
        { userId: 'c', name: 'Cara' },
        { userId: 'd', name: 'Dan' },
      ],
    },
  ]

  test('two couples settle with a single transfer', () => {
    expect(simplifyDebts(netted)).toHaveLength(3)

    const transfers = simplifyHouseholdDebts(netted, households)

    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      // The member deepest in debt pays; the member owed most collects
      from: 'd',
      fromName: 'Dan',
      to: 'a',
      toName: 'Ana',
      amount: 250,
      fromHousehold: { name: 'Cara & Dan', memberNames: ['Cara', 'Dan'] },
      toHousehold: { name: 'Ana & Ben', memberNames: ['Ana', 'Ben'] },
    })
  })

  test('people outside a household still settle for themselves', () => {
    const withSolo = [...netted, balance('e', 'Eve', 'SGD', -100), balance('f', 'Fay', 'SGD', 100)]
    const transfers = simplifyHouseholdDebts(withSolo, households)

    const eve = transfers.find((t) => t.from === 'e')
    expect(eve).toBeTruthy()
    expect(eve!.fromHousehold).toBeUndefined()
  })

  test('a household that nets to zero drops out entirely', () => {
    const squared = [
      balance('a', 'Ana', 'SGD', 100),
      balance('b', 'Ben', 'SGD', -100),
      balance('c', 'Cara', 'SGD', 60),
      balance('d', 'Dan', 'SGD', -60),
    ]
    expect(simplifyHouseholdDebts(squared, households)).toHaveLength(0)
  })
})

test.describe('rounding dust', () => {
  const rates314 = [{ code: 'MYR', rate: 3.14 }]
  const couple: Household[] = [
    {
      id: 1,
      name: 'wy & wq',
      members: [
        { userId: 'wy', name: 'wy' },
        { userId: 'wq', name: 'wq' },
      ],
    },
  ]

  test('a household square to within a cent is not billed one', () => {
    // wy and wq are 0.005 apart — square, as far as money goes. Rounding each
    // of them to cents first and summing afterwards used to manufacture a
    // S$0.01 debt out of that, and bill it to whoever else carried dust.
    const netted = netBalances(
      [
        balance('wy', 'wy', 'MYR', -134.826 * 3.14),
        balance('wq', 'wq', 'MYR', 134.821 * 3.14),
        balance('yc', 'yc', 'MYR', 0.012 * 3.14),
      ],
      'SGD',
      rates314
    )

    expect(simplifyHouseholdDebts(netted, couple)).toEqual([])
  })

  test('sub-cent balances left by a conversion are not debts', () => {
    const netted = netBalances(
      [balance('a', 'Ana', 'MYR', 0.006 * 3.14), balance('b', 'Ben', 'MYR', -0.006 * 3.14)],
      'SGD',
      rates314
    )

    expect(simplifyDebts(netted)).toEqual([])
  })

  test('a real cent is still owed', () => {
    const netted = netBalances(
      [balance('a', 'Ana', 'SGD', 0.01), balance('b', 'Ben', 'SGD', -0.01)],
      'SGD',
      rates314
    )

    expect(simplifyDebts(netted)).toHaveLength(1)
    expect(simplifyDebts(netted)[0]).toMatchObject({ from: 'b', to: 'a', amount: 0.01 })
  })

  test('settling every transfer on offer leaves nothing behind', () => {
    // Tap Settle down the list, recomputing after each one, the way the page
    // does — then check the board is genuinely clear rather than showing a
    // phantom cent.
    const settle = (rows: Balance[], transfer: Transfer): Balance[] => {
      const out = rows.map((r) => ({ ...r }))
      const bump = (userId: string, name: string, delta: number) => {
        const hit = out.find((r) => r.userId === userId && r.currency === transfer.currency)
        if (hit) hit.netBalance += delta
        else out.push({ userId, name, currency: transfer.currency, netBalance: delta })
      }
      bump(transfer.from, transfer.fromName, transfer.amount)
      bump(transfer.to, transfer.toName, -transfer.amount)
      // getBalances drops per-currency rows under half a cent
      return out.filter((r) => Math.abs(r.netBalance) >= 0.005)
    }

    const cast = ['yc', 'wy', 'wq', 'dd']
    for (let seed = 0; seed < 500; seed++) {
      // A ledger shaped like real expenses: a payer, a share each, in ringgit
      let rows: Balance[] = []
      const add = (userId: string, delta: number) => {
        const hit = rows.find((r) => r.userId === userId)
        if (hit) hit.netBalance += delta
        else rows.push(balance(userId, userId, 'MYR', delta))
      }
      for (let e = 0; e < 6; e++) {
        const payer = cast[Math.floor(Math.random() * cast.length)]!
        const amount = Math.round(Math.random() * 40_000) / 100
        const sharers = cast.filter(() => Math.random() < 0.75)
        if (sharers.length === 0) continue
        add(payer, amount)
        for (const s of sharers) add(s, -amount / sharers.length)
      }
      rows = rows.filter((r) => Math.abs(r.netBalance) >= 0.005)

      for (const households of [null, couple]) {
        const run = (current: Balance[]) => {
          const netted = netBalances(current, 'SGD', rates314)
          return households ? simplifyHouseholdDebts(netted, households) : simplifyDebts(netted)
        }
        let current = rows
        for (let tap = 0; tap < 20; tap++) {
          const transfers = run(current)
          if (transfers.length === 0) break
          current = settle(current, transfers[0]!)
        }
        expect(run(current)).toEqual([])
      }
    }
  })
})
