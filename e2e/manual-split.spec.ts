import { test, expect } from './fixtures'

const TRPC_CREATE_PATTERN = '**/api/trpc/expense.create**'

test.describe('Manual split mode', () => {
  test.beforeEach(async ({ page, groupId }) => {
    await page.goto(`/groups/${groupId}/expenses/create`)
    // Wait for group members to load
    await page.locator('.check-row label').first().waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('Even mode is selected by default', async ({ page }) => {
    const evenBtn = page.locator('button', { hasText: 'Even' })
    const manualBtn = page.locator('button', { hasText: 'Manual' })
    await expect(evenBtn).toBeVisible()
    await expect(manualBtn).toBeVisible()
    // Even mode shows checkboxes
    await expect(page.locator('.check-row input[type="checkbox"]').first()).toBeVisible()
  })

  test('switching to Manual replaces checkboxes with number inputs', async ({ page }) => {
    await page.locator('button', { hasText: 'Manual' }).click()
    // Checkboxes should be gone
    await expect(page.locator('.check-row input[type="checkbox"]')).toHaveCount(0)
    // Number inputs should appear (one per member)
    const inputs = page.locator('.check-row input[type="number"]')
    await expect(inputs).not.toHaveCount(0)
  })

  test('Add expense is disabled when manual amounts are all zero', async ({ page }) => {
    await page.locator('button', { hasText: 'Manual' }).click()
    await page.locator('input[placeholder="0.00"]').first().fill('30')
    // Set the expense amount
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]').first()
    await amountInput.fill('60')
    // Leave manual amounts as zero → should be blocked
    const amountInputs = page.locator('.check-row input[type="number"]')
    for (const inp of await amountInputs.all()) {
      await inp.fill('0')
    }
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('Add expense is disabled when manual amounts do not sum to total', async ({ page }) => {
    // Set expense amount
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]').first()
    await amountInput.fill('90')

    await page.locator('button', { hasText: 'Manual' }).click()

    // Fill in amounts that don't add up (30 + 30 = 60, not 90)
    const rows = page.locator('.check-row input[type="number"]')
    const count = await rows.count()
    if (count >= 2) {
      await rows.nth(0).fill('30')
      await rows.nth(1).fill('30')
    }

    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })

  test('Add expense is enabled when manual amounts exactly match total', async ({ page }) => {
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]').first()
    await amountInput.fill('90')

    await page.locator('button', { hasText: 'Manual' }).click()

    // Distribute 90 across members
    const rows = page.locator('.check-row input[type="number"]')
    const count = await rows.count()
    const perPerson = 90 / count
    for (const inp of await rows.all()) {
      await inp.fill(perPerson.toFixed(2))
    }

    await expect(page.locator('button[type="submit"]')).toBeEnabled()
  })

  test('sub text shows remaining amount while manual inputs are incomplete', async ({ page }) => {
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]').first()
    await amountInput.fill('60')

    await page.locator('button', { hasText: 'Manual' }).click()

    // Fill only the first row
    const rows = page.locator('.check-row input[type="number"]')
    await rows.first().fill('20')

    await expect(page.locator('.section-sub')).toContainText('remaining')
  })

  test('sub text shows "All assigned" when amounts sum correctly', async ({ page }) => {
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]').first()
    await amountInput.fill('60')

    await page.locator('button', { hasText: 'Manual' }).click()

    const rows = page.locator('.check-row input[type="number"]')
    const count = await rows.count()
    const perPerson = 60 / count
    for (const inp of await rows.all()) {
      await inp.fill(perPerson.toFixed(2))
    }

    await expect(page.locator('.section-sub')).toContainText('All assigned')
  })

  test('switching back to Even mode restores checkboxes', async ({ page }) => {
    await page.locator('button', { hasText: 'Manual' }).click()
    await expect(page.locator('.check-row input[type="checkbox"]')).toHaveCount(0)

    await page.locator('button', { hasText: 'Even' }).click()
    await expect(page.locator('.check-row input[type="checkbox"]').first()).toBeVisible()
  })

  test('submitting with manual amounts sends splitAmounts to the server', async ({ page }) => {
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]').first()
    await amountInput.fill('90')
    await page.locator('input[placeholder="Dinner at Shinjuku"]').fill('Test manual split')

    await page.locator('button', { hasText: 'Manual' }).click()

    const rows = page.locator('.check-row input[type="number"]')
    const count = await rows.count()
    const perPerson = 90 / count
    for (const inp of await rows.all()) {
      await inp.fill(perPerson.toFixed(2))
    }

    // Intercept the create mutation and verify it contains splitAmounts (not splitUserIds)
    let capturedBody: Record<string, unknown> | null = null
    await page.route(TRPC_CREATE_PATTERN, async (route) => {
      const req = route.request()
      const body = await req.postDataJSON() as Record<string, unknown>
      capturedBody = body
      // Mock a successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { json: { success: true, id: 'mock-group' } } } }]),
      })
    })

    await page.locator('button[type="submit"]').click()

    // Give the request time to fire
    await page.waitForTimeout(1_000)

    expect(capturedBody).not.toBeNull()
    const input = (capturedBody as unknown as Record<string, { json: Record<string, unknown> }>)['0']?.json
    expect(input).toHaveProperty('splitAmounts')
    expect(input).not.toHaveProperty('splitUserIds')
    expect(Array.isArray(input?.splitAmounts)).toBe(true)
  })
})
