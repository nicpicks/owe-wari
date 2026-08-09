import { test, expect } from './fixtures'
import { setTotal } from './helpers/expense-form'
import { identifyAs } from './helpers/identity'

const TRPC_CREATE_PATTERN = '**/api/trpc/expense.create**'

test.describe('Portions split mode', () => {
  test.beforeEach(async ({ page, groupId }) => {
    await page.goto(`/groups/${groupId}/expenses/create`)
    await identifyAs(page, 'Alice')
    await page.locator('.check-row label').first().waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('switching to Portions shows a stepper per member, seeded at 1', async ({ page }) => {
    await page.locator('button', { hasText: 'Portions' }).click()

    await expect(page.locator('.check-row input[type="checkbox"]')).toHaveCount(0)
    const steppers = page.locator('.check-row input[aria-label^="Portions for"]')
    await expect(steppers).toHaveCount(3)
    for (const inp of await steppers.all()) {
      await expect(inp).toHaveValue('1')
    }
  })

  test('portion counts drive each share of the total', async ({ page }) => {
    await setTotal(page, '120')
    await page.locator('button', { hasText: 'Portions' }).click()

    // Alice eats double, Charlie sits this one out → 2 : 1 : 0 over $120.
    await page.locator('button[aria-label="More portions for Alice"]').click()
    await page.locator('button[aria-label="Fewer portions for Charlie"]').click()

    await expect(page.locator('.section-sub')).toContainText('3 portions')
    await expect(page.locator('.section-sub')).toContainText('$40.00 per portion')

    const rowFor = (name: string) => page.locator('.check-row').filter({ hasText: name })
    await expect(rowFor('Alice')).toContainText('$80.00')
    await expect(rowFor('Bob')).toContainText('$40.00')
    await expect(rowFor('Charlie')).toContainText('—')
  })

  test('the minus button stops at zero portions', async ({ page }) => {
    await page.locator('button', { hasText: 'Portions' }).click()
    const minus = page.locator('button[aria-label="Fewer portions for Alice"]')
    await minus.click()
    await expect(page.locator('.check-row input[aria-label="Portions for Alice"]')).toHaveValue('')
    await expect(minus).toBeDisabled()
  })

  test('Add expense is blocked until someone has a portion', async ({ page }) => {
    await setTotal(page, '60')
    await page.locator('button', { hasText: 'Portions' }).click()

    for (const inp of await page.locator('.check-row input[aria-label^="Portions for"]').all()) {
      await inp.fill('0')
    }
    await expect(page.locator('button[type="submit"]')).toBeDisabled()

    await page.locator('button[aria-label="More portions for Alice"]').click()
    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('submitting portions sends amounts that add up to the total', async ({ page }) => {
    await setTotal(page, '100')
    await page.locator('input[placeholder="Dinner at Shinjuku"]').fill('Test portions split')
    await page.locator('button', { hasText: 'Portions' }).click()
    await page.locator('button[aria-label="More portions for Alice"]').click()

    let capturedBody: Record<string, unknown> | null = null
    await page.route(TRPC_CREATE_PATTERN, async (route) => {
      capturedBody = (await route.request().postDataJSON()) as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { json: { success: true, id: 'mock-group' } } } }]),
      })
    })

    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(1_000)

    expect(capturedBody).not.toBeNull()
    const input = (capturedBody as unknown as Record<string, { json: Record<string, unknown> }>)['0']?.json
    const splitAmounts = input?.splitAmounts as { userId: string; amount: number }[] | undefined
    expect(input).not.toHaveProperty('splitUserIds')
    expect(splitAmounts).toBeDefined()
    // 2 : 1 : 1 over $100 → 50 / 25 / 25, summing to the total exactly
    expect(splitAmounts?.map((s) => s.amount).sort((a, b) => a - b)).toEqual([25, 25, 50])
  })
})

test.describe('Percentage split mode', () => {
  test.beforeEach(async ({ page, groupId }) => {
    await page.goto(`/groups/${groupId}/expenses/create`)
    await identifyAs(page, 'Alice')
    await page.locator('.check-row label').first().waitFor({ state: 'visible', timeout: 10_000 })
    await setTotal(page, '100')
    await page.locator('button', { hasText: '%' }).first().click()
  })

  test('percentages are seeded to an even split summing to 100', async ({ page }) => {
    const inputs = page.locator('.check-row input[aria-label^="Percentage for"]')
    await expect(inputs).toHaveCount(3)
    await expect(page.locator('.section-sub')).toContainText('All assigned')
    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('a short total blocks submission and reports what is left', async ({ page }) => {
    const inputs = page.locator('.check-row input[aria-label^="Percentage for"]')
    await inputs.nth(0).fill('50')
    await inputs.nth(1).fill('20')
    await inputs.nth(2).fill('20')

    await expect(page.locator('.section-sub')).toContainText('10% left')
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
    // Rows preview the literal share, not a normalised one.
    await expect(page.locator('.check-row').nth(0)).toContainText('$50.00')
  })

  test('going over 100% is reported as over', async ({ page }) => {
    await page.locator('.check-row input[aria-label^="Percentage for"]').nth(0).fill('80')
    await expect(page.locator('.section-sub')).toContainText('over')
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('Balance to 100% fixes an unbalanced split', async ({ page }) => {
    const inputs = page.locator('.check-row input[aria-label^="Percentage for"]')
    await inputs.nth(0).fill('10')
    await expect(page.locator('button[type="submit"]')).toBeDisabled()

    await page.locator('button', { hasText: 'Balance to 100%' }).click()

    await expect(page.locator('.section-sub')).toContainText('All assigned')
    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('submitting percentages sends amounts that add up to the total', async ({ page }) => {
    await page.locator('input[placeholder="Dinner at Shinjuku"]').fill('Test percent split')
    const inputs = page.locator('.check-row input[aria-label^="Percentage for"]')
    await inputs.nth(0).fill('50')
    await inputs.nth(1).fill('30')
    await inputs.nth(2).fill('20')

    let capturedBody: Record<string, unknown> | null = null
    await page.route(TRPC_CREATE_PATTERN, async (route) => {
      capturedBody = (await route.request().postDataJSON()) as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { json: { success: true, id: 'mock-group' } } } }]),
      })
    })

    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(1_000)

    const input = (capturedBody as unknown as Record<string, { json: Record<string, unknown> }>)['0']?.json
    const splitAmounts = input?.splitAmounts as { userId: string; amount: number }[] | undefined
    expect(splitAmounts?.map((s) => s.amount).sort((a, b) => a - b)).toEqual([20, 30, 50])
  })
})
