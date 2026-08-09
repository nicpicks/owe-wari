import type { Page } from '@playwright/test'

/**
 * On the first visit to a group the "Who are you?" sheet covers the page and
 * swallows clicks. It renders once the member list arrives, so wait for it
 * before picking a member (and move on if it never shows).
 */
export async function identifyAs(page: Page, name: string) {
  const overlay = page.locator('.modal-overlay')
  try {
    await overlay.waitFor({ state: 'visible', timeout: 10_000 })
  } catch {
    return // identity already stored on this context — nothing to dismiss
  }

  const pick = overlay.locator('button', { hasText: `I'm ${name}` })
  if (await pick.count()) {
    await pick.first().click()
  } else {
    await overlay.locator('button', { hasText: 'Not now' }).click()
  }
  await overlay.waitFor({ state: 'detached', timeout: 10_000 })
}
