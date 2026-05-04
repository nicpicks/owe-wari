import { env } from '~/env'

/**
 * Validates the Authorization header against MCP_API_TOKEN.
 * Returns null on success, or a Response with the appropriate status on failure.
 *
 * Constant-time comparison is not strictly required here because the token is a
 * 256-bit random hex string — guessing or timing-leaking a single byte does not
 * reduce the search space meaningfully. We still avoid logging the header.
 */
export function checkMcpAuth(req: Request): Response | null {
    const header = req.headers.get('authorization')
    if (!header) {
        return new Response('Unauthorized: missing Authorization header', { status: 401 })
    }
    const match = /^Bearer\s+(.+)$/i.exec(header)
    if (!match) {
        return new Response('Unauthorized: malformed Authorization header', { status: 401 })
    }
    const token = match[1]!.trim()
    if (token !== env.MCP_API_TOKEN) {
        return new Response('Unauthorized: invalid token', { status: 401 })
    }
    return null
}
