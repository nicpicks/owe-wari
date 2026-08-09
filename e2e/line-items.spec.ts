import { test, expect } from './fixtures'
import { setTotal } from './helpers/expense-form'
import { identifyAs } from './helpers/identity'

test.describe('Line items feed the expense total', () => {
  test.beforeEach(async ({ page, groupId }) => {
    await page.goto(`/groups/${groupId}/expenses/create`)
    await identifyAs(page, 'Alice')
    await page.locator('.check-row label').first().waitFor({ state: 'visible', timeout: 10_000 })
  })

  const total = (page: import('@playwright/test').Page) =>
    page.locator('input[type="text"][placeholder="0.00"]').first()
  const addItems = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: '+ Items' })
  const offer = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /Items add up to/ })

  test('keying items in adds them up into the total', async ({ page }) => {
    await expect(total(page)).toHaveValue('')

    await addItems(page).click()
    await page.getByLabel('Item amount').first().fill('18.50')
    await expect(total(page)).toHaveValue('18.50')

    await page.locator('button', { hasText: 'Add item' }).click()
    await page.getByLabel('Item amount').nth(1).fill('7.25')
    await expect(total(page)).toHaveValue('25.75')

    // Removing an item takes its amount back out again.
    await page.locator('button[title="Remove item"]').nth(1).click()
    await expect(total(page)).toHaveValue('18.50')
  })

  test('the + Items button is hidden once items exist', async ({ page }) => {
    await addItems(page).click()
    await expect(addItems(page)).toHaveCount(0)
  })

  test('a hand-typed total wins over the item sum', async ({ page }) => {
    await addItems(page).click()
    await page.getByLabel('Item amount').first().fill('18.50')
    await expect(total(page)).toHaveValue('18.50')

    await setTotal(page, '30')
    await page.getByLabel('Item amount').first().fill('20.00')

    await expect(total(page)).toHaveValue('30')
    await expect(offer(page)).toHaveText(/20\.00/)
  })

  test('the item-sum offer applies the sum and then goes away', async ({ page }) => {
    await addItems(page).click()
    await page.getByLabel('Item amount').first().fill('18.50')
    await setTotal(page, '30')

    await offer(page).click()

    await expect(total(page)).toHaveValue('18.50')
    await expect(offer(page)).toHaveCount(0)
  })

  test('no offer is shown while the total already matches the items', async ({ page }) => {
    await addItems(page).click()
    await page.getByLabel('Item amount').first().fill('18.50')
    await expect(offer(page)).toHaveCount(0)
  })
})
