import { test, expect } from '@playwright/test'
import { trpcMutation, trpcQuery } from './helpers/trpc'
import { identifyAs } from './helpers/identity'

/** A group with a single debt, so one tap clears the board. */
let groupId: string

test.beforeAll(async () => {
  const group = await trpcMutation<{ id: string }>('group.create', {
    name: 'Last Round',
    currency: 'SGD',
    currencies: ['SGD'],
    description: 'Auto-created by the celebration spec',
    userNames: ['Mei', 'Tomo'],
    defaultPayee: 'Mei',
  })
  groupId = group.id

  const members = await trpcQuery<Array<{ id: string; name: string }>>('group.getUsers', {
    groupId,
  })
  await trpcMutation('expense.create', {
    groupId,
    paidByUserId: members.find((m) => m.name === 'Mei')!.id,
    title: 'Yakitori counter',
    amount: 84,
    currency: 'SGD',
    splitUserIds: members.map((m) => m.id),
  })
})

const card = (page: import('@playwright/test').Page) =>
  page.locator('.card-dark').filter({ hasText: 'Who owes whom' })

test.describe.serial('Clearing the last debt', () => {
  test('settling the final transfer sets off the confetti', async ({ page }) => {
    await page.goto(`/groups/${groupId}/balances`)
    await identifyAs(page, 'Tomo')

    await page.locator('.ledger-row button', { hasText: 'Settle' }).first().click()
    await page.locator('.modal-card button', { hasText: 'Confirm' }).click()

    await expect(page.locator('.kamifubuki-piece').first()).toBeVisible()
    await expect(card(page)).toContainText('All square')
    await expect(card(page)).toContainText('Every debt in this group is cleared')

    // The storm clears itself up afterwards
    await expect(page.locator('.kamifubuki')).toHaveCount(0, { timeout: 10_000 })
  })

  test('reopening a settled group is calm — seal, no confetti', async ({ page }) => {
    await page.goto(`/groups/${groupId}/balances`)
    await identifyAs(page, 'Tomo')

    await expect(page.locator('.stamp-seal-lg')).toBeVisible()
    await expect(page.locator('.kamifubuki')).toHaveCount(0)
  })

  test('the storm stays away when the visitor asks for less motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto(`/groups/${groupId}/balances`)
    await identifyAs(page, 'Mei')

    await expect(page.locator('.stamp-seal-lg')).toBeVisible()
    const hidden = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'kamifubuki'
      document.body.appendChild(probe)
      const display = getComputedStyle(probe).display
      probe.remove()
      return display
    })
    expect(hidden).toBe('none')
    await context.close()
  })
})
