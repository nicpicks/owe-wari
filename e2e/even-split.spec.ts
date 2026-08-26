import { test, expect } from '@playwright/test'
import { trpcMutation, trpcQuery } from './helpers/trpc'

interface ExpenseDetail {
  id: number
  amount: string
  splits: { userId: string; amount: string }[]
}

/**
 * An even split has to land on whole cents. Storing amount/n raw wrote shares
 * like 33.333333333333336, and those thousandths outlive every settlement —
 * a squared-up group ends up owing itself a phantom cent.
 */
test('an even split is stored in whole cents that add up to the total', async () => {
  const group = await trpcMutation<{ id: string }>('group.create', {
    name: 'Even Split Group',
    currency: 'SGD',
    currencies: ['SGD'],
    description: 'Auto-created by the even-split spec',
    userNames: ['Mei', 'Tomo', 'Rin'],
    defaultPayee: 'Mei',
  })
  const members = await trpcQuery<Array<{ id: string; name: string }>>('group.getUsers', {
    groupId: group.id,
  })

  // 100 / 3 is the awkward case: 33.33 + 33.33 + 33.34
  await trpcMutation('expense.create', {
    groupId: group.id,
    paidByUserId: members[0]!.id,
    title: 'Awkward three-way',
    amount: 100,
    currency: 'SGD',
    splitUserIds: members.map((m) => m.id),
  })

  const list = await trpcQuery<Array<{ id: number }>>('expense.getExpenses', { groupId: group.id })
  const detail = await trpcQuery<ExpenseDetail>('expense.getExpense', { expenseId: list[0]!.id })

  const shares = detail.splits.map((s) => parseFloat(s.amount))
  expect(shares).toHaveLength(3)
  for (const share of shares) {
    expect(Math.round(share * 100)).toBeCloseTo(share * 100, 9) // whole cents
  }
  expect(shares.reduce((sum, s) => sum + s, 0)).toBeCloseTo(100, 9)
  expect(shares.slice().sort()).toEqual([33.33, 33.33, 33.34])

  // …and the balances that fall out of it are cent-clean too
  const balances = await trpcQuery<Array<{ netBalance: number }>>('expense.getBalances', {
    groupId: group.id,
  })
  for (const b of balances) {
    expect(Math.round(b.netBalance * 100)).toBeCloseTo(b.netBalance * 100, 9)
  }
})
