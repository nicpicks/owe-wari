import { createMcpHandler } from '@vercel/mcp-adapter'
import { z } from 'zod'

import { checkMcpAuth } from '~/server/mcp/auth'
import { mcpTools } from '~/server/mcp/tools'

const handler = createMcpHandler(
    (server) => {
        for (const [name, def] of Object.entries(mcpTools)) {
            server.tool(
                name,
                def.description,
                def.inputSchema as Record<string, z.ZodTypeAny>,
                async (input: unknown) => {
                    const result = await def.handler(input as never)
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                    }
                }
            )
        }
    },
    {},
    { basePath: '/api/mcp' }
)

async function withAuth(req: Request): Promise<Response> {
    const authError = checkMcpAuth(req)
    if (authError) return authError
    return handler(req)
}

export { withAuth as GET, withAuth as POST, withAuth as DELETE }
