import { test, expect } from './fixtures'
import { makeMinimalJpeg } from './helpers/fake-image'

const TRPC_ROUTE_PATTERN = '**/api/trpc/receipt.scan**'

// httpBatchStreamLink uses 2-line JSONL (superjson-serialized):
//   Line 1 (head):  {"json":{"0":[[0],[null,0,0]]}}   — promise placeholder [chunkId=0]
//   Line 2 (chunk): {"json":[0,0,[[<result>]]]}        — promise fulfilled [chunkId, STATUS_FULFILLED, dehydrated]
// The head "0":[[placeholder],[null, CHUNK_TYPE_PROMISE=0, chunkId=0]] signals a pending promise.
// The chunk [0, 0(fulfilled), [[data]]] resolves that promise with data.
const HEAD_LINE = JSON.stringify({ json: { '0': [[0], [null, 0, 0]] } }) + '\n'

function mockScanSuccess(amount: number | null): string {
  const chunk = JSON.stringify({ json: [0, 0, [[{ result: { data: { amount } } }]]] }) + '\n'
  return HEAD_LINE + chunk
}

function mockScanError(): string {
  const chunk =
    JSON.stringify({
      json: [
        0,
        0,
        [
          [
            {
              error: {
                message: 'Internal server error',
                code: -32603,
                data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
              },
            },
          ],
        ],
      ],
    }) + '\n'
  return HEAD_LINE + chunk
}

test.describe('Receipt scan feature', () => {
  test.beforeEach(async ({ page, groupId }) => {
    await page.goto(`/groups/${groupId}/expenses/create`)
    // Wait for the group members to load (users query resolved) — target the checkbox label specifically
    await page.locator('.check-row label', { hasText: 'Alice' }).waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('scan receipt button is visible on the create expense page', async ({ page }) => {
    const scanButton = page.locator('button[type="button"]', { hasText: 'Scan receipt' })
    await expect(scanButton).toBeVisible()
    await expect(scanButton).toBeEnabled()
  })

  test('successful scan populates the amount field', async ({ page }) => {
    await page.route(TRPC_ROUTE_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: mockScanSuccess(42.5),
      })
    })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: makeMinimalJpeg(),
    })

    // FileReader is async — wait for the amount field to update
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]')
    await expect(amountInput).toHaveValue('42.5', { timeout: 5_000 })
  })

  test('scan returning null amount shows cannot-detect alert', async ({ page }) => {
    await page.route(TRPC_ROUTE_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: mockScanSuccess(null),
      })
    })

    const dialogPromise = page.waitForEvent('dialog')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: makeMinimalJpeg(),
    })

    const dialog = await dialogPromise
    expect(dialog.message()).toContain('Could not detect a total')
    await dialog.accept()

    // Amount field should remain empty
    const amountInput = page.locator('input[type="number"][placeholder="0.00"]')
    await expect(amountInput).toHaveValue('')
  })

  test('scan error shows failure alert', async ({ page }) => {
    await page.route(TRPC_ROUTE_PATTERN, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: mockScanError(),
      })
    })

    const dialogPromise = page.waitForEvent('dialog')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: makeMinimalJpeg(),
    })

    const dialog = await dialogPromise
    expect(dialog.message()).toContain('Receipt scan failed')
    await dialog.accept()
  })

  test('button shows Scanning text while mutation is pending', async ({ page }) => {
    // Hold the request open for 2s to observe the pending UI state
    await page.route(TRPC_ROUTE_PATTERN, async (route) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 2_000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: mockScanSuccess(10.0),
      })
    })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: makeMinimalJpeg(),
    })

    // While the route is sleeping, the button should be disabled and say "Scanning…"
    const scanButton = page.locator('button[type="button"]', { hasText: /Scan receipt|Scanning/ })
    await expect(scanButton).toHaveText('Scanning…', { timeout: 1_000 })
    await expect(scanButton).toBeDisabled()

    // After the mock resolves, it should revert to "Scan receipt" and be enabled
    await expect(scanButton).toHaveText('Scan receipt', { timeout: 5_000 })
    await expect(scanButton).toBeEnabled()
  })
})
