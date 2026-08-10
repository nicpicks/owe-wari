import { test, expect } from './fixtures'
import { makeMinimalJpeg } from './helpers/fake-image'
import { identifyAs } from './helpers/identity'
import { trpcMutation } from './helpers/trpc'
import { mockScanSuccess } from './helpers/trpc-stream'

const chip = (page: import('@playwright/test').Page) =>
  page.locator('button[aria-label^="Use suggested category"]')
const categorySelect = (page: import('@playwright/test').Page) =>
  page.locator('select.field-select').first()
const titleField = (page: import('@playwright/test').Page) =>
  page.locator('input[placeholder="Dinner at Shinjuku"]')

test.describe('Category suggestions', () => {
  test.beforeEach(async ({ page, groupId }) => {
    await page.goto(`/groups/${groupId}/expenses/create`)
    await identifyAs(page, 'Alice')
    await page.locator('.check-row label').first().waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('a recognised title offers a category', async ({ page }) => {
    await titleField(page).fill('Grab to airport')
    await expect(chip(page)).toHaveText(/Transport/)
    // Offered only — the field itself is untouched until you tap.
    await expect(categorySelect(page)).toHaveValue('General')
  })

  test('the more specific phrase wins', async ({ page }) => {
    await titleField(page).fill('Grab dinner')
    await expect(chip(page)).toHaveText(/Food/)
  })

  test('tapping the chip applies the category', async ({ page }) => {
    await titleField(page).fill('Museum tickets')
    await chip(page).click()

    await expect(categorySelect(page)).toHaveValue('Activities')
    await expect(chip(page)).toHaveCount(0)
  })

  test('an ambiguous title is left alone', async ({ page }) => {
    await titleField(page).fill('Hotel bar')
    await expect(chip(page)).toHaveCount(0)
    await expect(categorySelect(page)).toHaveValue('General')
  })

  test('an unrecognised title is left alone', async ({ page }) => {
    await titleField(page).fill('Zzzzz thing')
    await expect(chip(page)).toHaveCount(0)
  })

  test('choosing a category yourself stops the suggestions', async ({ page }) => {
    await titleField(page).fill('Ramen')
    await expect(chip(page)).toHaveText(/Food/)

    await categorySelect(page).selectOption('Others')
    await titleField(page).fill('Taxi to the airport')

    await expect(chip(page)).toHaveCount(0)
    await expect(categorySelect(page)).toHaveValue('Others')
  })

  test('a scanned receipt offers its own category', async ({ page }) => {
    await page.route('**/api/trpc/receipt.scan**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: mockScanSuccess({ total: 24.8, category: 'Groceries' }),
      })
    })

    await page.locator('input[type="file"]').setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: makeMinimalJpeg(),
    })

    await expect(chip(page)).toHaveText(/Groceries/)
    await chip(page).click()
    await expect(categorySelect(page)).toHaveValue('Groceries')
  })
})

test.describe('Category suggestions from group history', () => {
  // "Konbini" is deliberately absent from the built-in rules — a convenience
  // store is Groceries to some groups and Food to others. Once this group has
  // called it twice, its own answer is the one that gets offered.
  test.beforeEach(async ({ page, groupId, userIds }) => {
    for (const amount of [12, 13]) {
      await trpcMutation('expense.create', {
        groupId,
        paidByUserId: userIds[0],
        title: 'Konbini',
        amount,
        currency: 'USD',
        category: 'Groceries',
      })
    }
    await page.goto(`/groups/${groupId}/expenses/create`)
    await identifyAs(page, 'Alice')
    await page.locator('.check-row label').first().waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('a title the group has categorised before is offered back', async ({ page }) => {
    await titleField(page).fill('Konbini')
    await expect(chip(page)).toHaveText(/Groceries/)
  })

  test('a past title carries over to a longer one containing it', async ({ page }) => {
    await titleField(page).fill('Konbini run before the train')
    await expect(chip(page)).toHaveText(/Groceries/)
  })
})
