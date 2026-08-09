import type { Page } from '@playwright/test'

/**
 * Set the expense total — the hero field at the top of the create form. It's a
 * text input (it accepts arithmetic like `12+8`), so it can't be located by
 * type="number" the way the per-member amount inputs can.
 */
export async function setTotal(page: Page, value: string) {
  const amountInput = page.locator('input[type="text"][placeholder="0.00"]').first()
  await amountInput.fill(value)
  await amountInput.blur()
}
