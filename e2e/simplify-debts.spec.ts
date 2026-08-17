import { test, expect } from '@playwright/test'
import {
  netBalances,
  simplifyDebts,
  simplifyHouseholdDebts,
  type Balance,
  type Household,
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
