import { test, expect } from '@playwright/test'
import { trpcMutation, trpcQuery } from './helpers/trpc'
import { identifyAs } from './helpers/identity'

/**
 * A four-person trip with debts in two currencies, arranged so that:
 *   net (in SGD) → Ana +275, Ben −25, Cara −95, Dan −155
 * which is three transfers person-by-person, and one when Ana & Ben and
 * Cara & Dan settle as households.
 */
let groupId: string
let userIds: Record<string, string>

test.beforeAll(async () => {
  const group = await trpcMutation<{ id: string }>('group.create', {
    name: 'Households Test Group',
    currency: 'SGD',
    currencies: ['SGD', 'IDR'],
    description: 'Auto-created by the households spec',
    userNames: ['Ana', 'Ben', 'Cara', 'Dan'],
    defaultPayee: 'Ana',
  })
  groupId = group.id

  const members = await trpcQuery<Array<{ id: string; name: string }>>('group.getUsers', {
    groupId,
  })
  userIds = Object.fromEntries(members.map((m) => [m.name, m.id]))
  const all = members.map((m) => m.id)

  await trpcMutation('group.setRate', { groupId, code: 'IDR', rate: 12_000 })

  // Ana fronts S$400 for everyone
  await trpcMutation('expense.create', {
    groupId,
    paidByUserId: userIds.Ana,
    title: 'Villa',
    amount: 400,
    currency: 'SGD',
    splitUserIds: all,
  })
  // Ben fronts Rp1,200,000 (= S$100) for everyone
  await trpcMutation('expense.create', {
    groupId,
    paidByUserId: userIds.Ben,
    title: 'Warung dinners',
    amount: 1_200_000,
    currency: 'IDR',
    splitUserIds: all,
  })
  // Cara covers Dan's scooter
  await trpcMutation('expense.create', {
    groupId,
    paidByUserId: userIds.Cara,
    title: 'Scooter hire',
    amount: 60,
    currency: 'SGD',
    splitUserIds: [userIds.Cara, userIds.Dan],
  })
})

const owedRows = (page: import('@playwright/test').Page) =>
  page.locator('.card-dark').filter({ hasText: 'Who owes whom' }).locator('.ledger-row')

test.describe.serial('Settling by household', () => {
  test('cross-currency debts between a pair net into one transfer', async ({ page }) => {
    await page.goto(`/groups/${groupId}/balances`)
    await identifyAs(page, 'Ana')

    // Ana is up in SGD and down in IDR against Ben — one row, not two
    await expect(owedRows(page)).toHaveCount(3)
    await expect(owedRows(page).filter({ hasText: 'Ben' })).toHaveCount(1)
    await expect(owedRows(page).filter({ hasText: 'Ben' })).toContainText('$25.00')

    // Nothing to toggle until households exist
    await expect(page.locator('[aria-label="Settle as"]')).toHaveCount(0)
  })

  test('households can be paired up in settings', async ({ page }) => {
    await page.goto(`/groups/${groupId}/settings`)
    await identifyAs(page, 'Ana')

    const card = page.locator('.card-dark').filter({ hasText: 'Households' })

    for (const [first, second] of [
      ['Ana', 'Ben'],
      ['Cara', 'Dan'],
    ]) {
      await card.locator('button', { hasText: 'New household' }).click()
      await card.locator('.check-row').filter({ hasText: first! }).click()
      await card.locator('.check-row').filter({ hasText: second! }).click()
      // The name tracks the picks until it is typed over
      await expect(card.locator('#household-name')).toHaveValue(`${first} & ${second}`)
      await card.locator('button', { hasText: 'Save household' }).click()
      await expect(card.locator('.ledger-row').filter({ hasText: `${first} & ${second}` })).toBeVisible()
    }
  })

  test('a couple hands over one figure through the member deepest in debt', async ({ page }) => {
    await page.goto(`/groups/${groupId}/balances`)
    await identifyAs(page, 'Ana')

    // Households are the group's agreement, so the view starts on them
    await expect(owedRows(page)).toHaveCount(1)
    const row = owedRows(page).first()
    await expect(row).toContainText('Cara & Dan')
    await expect(row).toContainText('Ana & Ben')
    await expect(row).toContainText('$250.00')
    await expect(row).toContainText('Dan pays Ana')
    await expect(
      page.locator('.card-dark').filter({ hasText: 'Who owes whom' })
    ).toContainText('2 fewer transfers')

    // …and the individual books are still one tap away
    await page.locator('[aria-label="Settle as"] button', { hasText: 'People' }).click()
    await expect(owedRows(page)).toHaveCount(3)
    await expect(owedRows(page).first()).not.toContainText('&')
  })

  test('settling a household transfer records it between the two representatives', async ({ page }) => {
    await page.goto(`/groups/${groupId}/balances`)
    await identifyAs(page, 'Ana')

    await owedRows(page).first().locator('button', { hasText: 'Settle' }).click()
    const modal = page.locator('.modal-card')
    await expect(modal).toContainText('Dan pays Ana')
    await expect(modal).toContainText('Settles Cara & Dan → Ana & Ben')
    await modal.locator('button', { hasText: 'Confirm' }).click()

    // Dan's S$250 clears the couples; Cara and Dan square up at home
    await expect(page.locator('.stamp-seal')).toBeVisible()
    await expect(owedRows(page).filter({ hasText: 'Settle' })).toHaveCount(0)
  })
})
