import { test, expect } from '@playwright/test'

test.describe('MCP auth guard', () => {
    test('rejects missing Authorization header with 401', async ({ request }) => {
        const res = await request.post('/api/mcp/mcp', {
            data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status()).toBe(401)
        expect(await res.text()).toContain('missing Authorization header')
    })

    test('rejects malformed Authorization header with 401', async ({ request }) => {
        const res = await request.post('/api/mcp/mcp', {
            data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            headers: { 'Content-Type': 'application/json', Authorization: 'NotBearer abc' },
        })
        expect(res.status()).toBe(401)
        expect(await res.text()).toContain('malformed Authorization header')
    })

    test('rejects wrong token with 401', async ({ request }) => {
        const res = await request.post('/api/mcp/mcp', {
            data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer thisisnotthetoken',
            },
        })
        expect(res.status()).toBe(401)
        expect(await res.text()).toContain('invalid token')
    })
})
